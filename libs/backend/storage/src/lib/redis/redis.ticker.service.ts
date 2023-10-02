import { Dictionary, Ticker } from 'ccxt';
import { Injectable, Logger } from '@nestjs/common';
import { EXCHANGE_TICKERS_EXPIRATION, REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { ExchangePrice, TickersType } from '@cupo/backend/interface';
import { tickerConfig } from '../config/redis.config';
import { RedisService } from './redis.service';

@Injectable()
export class RedisTickerService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.TICKERS, tickerConfig);
  }

  async getTickers(exchangeId: string, baseCurrencies?: string[]): Promise<TickersType | null> {
    const tickers = await this.getHash(this.getExchangeKey(exchangeId));
    if (tickers) {
      const res: TickersType = {};

      Object.keys(tickers).forEach((symbol) => {
        if ((tickers[symbol]?.length && !baseCurrencies) || baseCurrencies.some((base) => symbol.includes(base))) {
          res[symbol] = JSON.parse(tickers[symbol]);
        }
      });
      return res;
    }

    return null;
  }

  async getMarketPrice(exchangeId: string, symbol: string): Promise<ExchangePrice | null> {
    const tickerHash = await this.getHashValue(`${this.getExchangeKey(exchangeId)}`, symbol);

    const ticker = tickerHash ? JSON.parse(tickerHash) : null;

    return ticker
      ? ({
          exchangeId,
          symbol,
          timestamp: ticker.timestamp,
          datetime: new Date(ticker.datetime),
          bid: ticker.bid || ticker.close,
          ask: ticker.ask || ticker.close,
          close: ticker.close,
          bidVolume: ticker.bidVolume,
          askVolume: ticker.askVolume,
        } as ExchangePrice)
      : null;
  }

  async getTickerLastUpdate(exchangeId: string): Promise<number> {
    const tickerHash = (await this.getHashValue(`${this.getExchangeKey(exchangeId)}`, 'update')) || '0';
    return +tickerHash;
  }

  async getTicker(exchangeId: string, symbol: string): Promise<TickersType | null> {
    const tickerHash = await this.getHashValue(`${this.getExchangeKey(exchangeId)}`, symbol);

    const ticker: Ticker | null = tickerHash?.length ? JSON.parse(tickerHash) : null;

    return ticker
      ? {
          [ticker.symbol]: ticker,
        }
      : null;
  }

  async clearTickers(exchangeId: string): Promise<void> {
    const tickers = await this.getTickers(exchangeId);

    if (tickers) {
      Object.keys(tickers).forEach((symbol) => {
        if (tickers[symbol]?.timestamp && tickers[symbol]?.timestamp < Date.now() - EXCHANGE_TICKERS_EXPIRATION) {
          this.deleteTicker(exchangeId, symbol);

          Logger.warn(`Deleted ticker ${symbol} from ${exchangeId}`, 'RedisTickerService.clearTickers');
        }
      });
    }
  }

  async setTickers(exchangeId: string, tickers: TickersType): Promise<void> {
    const saveTickers = {} as Dictionary<string>;
    for (const symbol of Object.keys(tickers)) {
      saveTickers[symbol] = JSON.stringify(tickers[symbol]);
    }

    await this.addTickersLast(exchangeId, Object.keys(tickers));

    return this.setHash(this.getExchangeKey(exchangeId), saveTickers);
  }

  async setTicker(exchangeId: string, ticker: Ticker): Promise<void> {
    return this.setHash(`${this.getExchangeKey(exchangeId)}`, {
      [ticker.symbol]: JSON.stringify(ticker),
    });
  }

  async deleteTicker(exchangeId: string, symbol: string): Promise<void> {
    return this.deleteHash(`${this.getExchangeKey(exchangeId)}`, symbol);
  }

  async setTickersLast(exchangeId: string, tickers: string[]): Promise<void> {
    // const saved = await this.getTickersLast(exchangeId);
    //
    // tickers.forEach((symbol) => {
    //   if (!saved.includes(symbol)) {
    //     saved.push(symbol);
    //   }
    // });
    //
    // await this.setKey(`${this.getExchangeKey(exchangeId)}Last`, JSON.stringify(saved));

    await this.setKey(`${this.getExchangeKey(exchangeId)}Last`, JSON.stringify(tickers));
  }

  // *** exchange messages between tickers and orders applications

  async addTickersLast(exchangeId: string, tickers: string[]): Promise<void> {
    await this.pushKey(`${this.getExchangeKey(exchangeId)}Lasts`, ...tickers);
  }

  async removeTickersLast(exchangeId: string, count: number): Promise<string[] | null> {
    return this.popKey(`${this.getExchangeKey(exchangeId)}Lasts`, count);
  }

  subscribeTickers(exchangeId: string): void {
    this.subscribeChannel(`${exchangeId}_${REDIS_ENTITY_TYPE.TICKERS}`);
  }

  publishTickers(exchangeId: string, data: string): void {
    this.publishChannel(`${exchangeId}_${REDIS_ENTITY_TYPE.TICKERS}`, data);
  }

  subscribeAccumulateTickers(): void {
    this.subscribeChannel(REDIS_ENTITY_TYPE.TICKERS_ACCUMULATE);
  }

  publishAccumulateTickers(exchangeId: string, data: string): void {
    this.publishChannel(REDIS_ENTITY_TYPE.TICKERS_ACCUMULATE, data);
  }

  // *** get exchange to feed tickers ***

  // async canFeederConnectToExchange(exchangeId: string, id: string): Promise<boolean> {
  //   let alreadyHasFeeder = false;
  //   let count = 0;
  //
  //   const feeders = await this.getTickerFeeders();
  //   if (feeders) {
  //     Object.keys(feeders).forEach((exchId) => {
  //       if (exchId === exchangeId && feeders[exchId].id !== id) {
  //         alreadyHasFeeder = true;
  //       }
  //       if (feeders[exchId].id === id) {
  //         count++;
  //       }
  //     });
  //   }
  //
  //   if (alreadyHasFeeder) {
  //     return false;
  //   }
  //   if (count >= TICKER_EXCHANGES_COUNT) {
  //     return false;
  //   }
  //
  //   Logger.debug(`+++ Feeder ${id} [${exchangeId}] have connections: ${count}`);
  //   await this.setTickerFeeder(exchangeId, id);
  //
  //   return true;
  // }

  async isMeFeeder(exchangeId: string): Promise<boolean> {
    return !!(await this.getTickerFeeder(exchangeId));
  }

  async feederLostExchange(exchangeId: string, feederId: string): Promise<void> {
    Logger.warn(`Feeder ${feederId} [${exchangeId}] lost connection`);
    await this.deleteHash(REDIS_ENTITY_TYPE.TICKERS_FEED, exchangeId);
  }

  // publishHasExchangeToFeedTickers(exchangeId: string): void {
  //   try {
  //     this.publishChannel(REDIS_ENTITY_TYPE.TICKERS_FEED, exchangeId);
  //   } catch (e) {
  //     Logger.error(e.message, 'RedisTickerService.publishHasExchangeToFeedTickers');
  //   }
  // }

  // subscribeGetExchangeToFeedTickers(): void {
  //   this.subscribeChannel(REDIS_ENTITY_TYPE.TICKERS_FEED);
  // }

  async getTickerFeeders(): Promise<{ [exchangeId: string]: { timestamp: number; id: string } } | null> {
    const hash = await this.getHash(REDIS_ENTITY_TYPE.TICKERS_FEED);
    if (!hash) {
      return null;
    }

    const res = {};
    Object.keys(hash).forEach((exchangeId) => {
      try {
        res[exchangeId] = JSON.parse(hash[exchangeId]);
      } catch (e) {
        Logger.error(`getTickerFeeders: ${e.message}`);
      }
    });

    return res;
  }

  async getTickerFeeder(exchangeId: string): Promise<{ timestamp: number; id: string } | null> {
    const hasKey = await this.getHashValue(REDIS_ENTITY_TYPE.TICKERS_FEED, exchangeId);

    return hasKey ? JSON.parse(hasKey) : null;
  }

  async setTickerFeeder(exchangeId: string, feederId: string): Promise<void> {
    await this.setHash(REDIS_ENTITY_TYPE.TICKERS_FEED, {
      [exchangeId]: JSON.stringify({
        timestamp: Date.now().toString(),
        id: feederId,
      }),
    });
  }

  // *** main ticker feeder

  async resetMainTickerFeeder(): Promise<void> {
    await this.deleteKey(REDIS_ENTITY_TYPE.TICKERS_MAIN_FEEDER);
    await this.deleteKey(REDIS_ENTITY_TYPE.TICKERS_FEED);
    await this.deleteKey(REDIS_ENTITY_TYPE.TICKERS_AVAILABLE_FEEDER);
  }

  async getMainTickerFeeder(): Promise<string> {
    return this.getKey(REDIS_ENTITY_TYPE.TICKERS_MAIN_FEEDER);
  }

  async setMainTickerFeeder(feederId: string): Promise<boolean> {
    const mainFeeder = await this.getKey(REDIS_ENTITY_TYPE.TICKERS_MAIN_FEEDER);

    if (!mainFeeder?.length) {
      await this.setKey(REDIS_ENTITY_TYPE.TICKERS_MAIN_FEEDER, JSON.stringify({ id: feederId, timestamp: Date.now() }));

      return true;
    } else {
      const feeder = JSON.parse(mainFeeder);

      // reset old main feeder
      if (feeder.timestamp < Date.now() - 1000 * 60) {
        await this.resetMainTickerFeeder();
        return false;
      }

      if (feeder.id === feederId) {
        await this.setKey(
          REDIS_ENTITY_TYPE.TICKERS_MAIN_FEEDER,
          JSON.stringify({
            id: feederId,
            timestamp: Date.now(),
          })
        );
      }

      return feeder.id === feederId;
    }
  }

  async clearAvailableTickerFeeder(): Promise<void> {
    const hash = await this.getAvailableTickerFeeders();

    for (const id in hash || {}) {
      if (+hash[id] < Date.now() - 1000 * 15) {
        Logger.warn(`Feeder ${id} died`);

        await this.deleteHash(REDIS_ENTITY_TYPE.TICKERS_AVAILABLE_FEEDER, id);
        delete hash[id];

        const feeders = await this.getTickerFeeders();
        for (const exchangeId in feeders || {}) {
          if (feeders[exchangeId].id === id) {
            Logger.warn(`Feeder for ${exchangeId} removed`);

            await this.feederLostExchange(exchangeId, id);
          }
        }
      }
    }
  }

  async setAvailableTickerFeeder(id: string): Promise<void> {
    await this.setHash(REDIS_ENTITY_TYPE.TICKERS_AVAILABLE_FEEDER, { [id]: Date.now().toString() });
  }

  async getAvailableTickerFeeders(): Promise<Record<string, string> | null> {
    return this.getHash(REDIS_ENTITY_TYPE.TICKERS_AVAILABLE_FEEDER);
  }
}
