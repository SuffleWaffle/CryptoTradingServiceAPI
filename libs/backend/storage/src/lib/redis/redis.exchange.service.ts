import { Currency, Dictionary, Market } from 'ccxt';
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TIMEFRAME } from '@cupo/timeseries';
import { REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { MarketsType } from '@cupo/backend/interface';

@Injectable()
export class RedisExchangeService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.EXCHANGES);
  }

  async getExchangesList(): Promise<string[]> {
    const exchangesObj = await this.getHash(`${this.prefix}`);

    if (exchangesObj && exchangesObj.list) {
      return JSON.parse(exchangesObj.list);
    } else {
      return [];
    }
  }

  async setExchangesList(list: string[]): Promise<void> {
    await this.setHash(`${this.prefix}`, {
      list: JSON.stringify(list),
      update: new Date().getTime().toString(),
    });
  }

  async setRateLimit(exchangeId: string, limit: number): Promise<void> {
    await this.setHash(REDIS_ENTITY_TYPE.EXCHANGE_RATE_LIMITS, {
      [exchangeId]: String(limit),
    });
  }

  async getRateLimit(exchangeId: string): Promise<null | number> {
    const data = await this.getHash(REDIS_ENTITY_TYPE.EXCHANGE_RATE_LIMITS);

    if (data && data[exchangeId]) {
      return +data[exchangeId];
    }

    return null;
  }

  // *** SYMBOLS ***

  async getSymbols(exchangeId: string, supportedOnly = true): Promise<string[]> {
    const data = supportedOnly
      ? await this.getHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_SYMBOLS))
      : await this.getHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_SYMBOLS_ALL));

    return data?.list?.length ? JSON.parse(data.list) : [];
  }

  async setSymbols(exchangeId: string, symbols: string[], supportedOnly = true): Promise<void> {
    if (supportedOnly) {
      await this.setHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_SYMBOLS), {
        list: JSON.stringify(symbols),
        update: new Date().getTime().toString(),
      });
    } else {
      await this.setHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_SYMBOLS_ALL), {
        list: JSON.stringify(symbols),
        update: new Date().getTime().toString(),
      });
    }
  }

  async setBadSymbol(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<void> {
    const bad = await this.getHashValue(
      this.getExchangeKey(exchangeId, `${REDIS_ENTITY_TYPE.EXCHANGE_BAD_SYMBOLS}:${timeframe}`),
      symbol
    );
    const badSymbol = bad ? JSON.parse(bad) : { count: 0, timestamp: new Date().getTime() };

    await this.setHash(this.getExchangeKey(exchangeId, `${REDIS_ENTITY_TYPE.EXCHANGE_BAD_SYMBOLS}:${timeframe}`), {
      [symbol]: JSON.stringify({
        count: badSymbol.count + 1,
        timestamp: new Date().getTime(),
      }),
    });
  }

  async isBadSymbol(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<number> {
    const bad = await this.getHashValue(
      this.getExchangeKey(exchangeId, `${REDIS_ENTITY_TYPE.EXCHANGE_BAD_SYMBOLS}:${timeframe}`),
      symbol
    );
    const badSymbol = bad ? JSON.parse(bad) : { count: 0, timestamp: new Date().getTime() };

    if (badSymbol.count > 0 && badSymbol.timestamp < Date.now() - 1000 * 60 * 60 * 24) {
      await this.setHash(this.getExchangeKey(exchangeId, `${REDIS_ENTITY_TYPE.EXCHANGE_BAD_SYMBOLS}:${timeframe}`), {
        [symbol]: JSON.stringify({
          count: 0,
          timestamp: Date.now(),
        }),
      });

      return 0;
    }

    return badSymbol.count;
  }

  // *** CURRENCIES ***
  async getCurrencies(exchangeId: string, supportedOnly = true): Promise<Dictionary<Currency> | null> {
    const data = supportedOnly
      ? await this.getHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_CURRENCY))
      : await this.getHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_CURRENCY_ALL));

    return data?.list?.length ? JSON.parse(data.list) : null;
  }

  async setCurrencies(exchangeId: string, currencies: Dictionary<Currency>, supportedOnly = true): Promise<void> {
    if (supportedOnly) {
      await this.setHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_CURRENCY), {
        list: JSON.stringify(currencies),
        update: new Date().getTime().toString(),
      });
    } else {
      await this.setHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_CURRENCY_ALL), {
        list: JSON.stringify(currencies),
        update: new Date().getTime().toString(),
      });
    }
  }

  // *** MARKETS ***
  async setMarketsLastUpdate(exchangeId: string): Promise<void> {
    await this.setHash(REDIS_ENTITY_TYPE.EXCHANGE_MARKETS_UPDATE, { [exchangeId]: new Date().getTime().toString() });
  }

  async getMarketsLastUpdate(exchangeId: string): Promise<number> {
    const marketsUpdate = await this.getHashValue(REDIS_ENTITY_TYPE.EXCHANGE_MARKETS_UPDATE, exchangeId);
    return +(marketsUpdate || 0);
  }

  async getMarkets(exchangeId: string, baseCurrency?: string): Promise<MarketsType | null> {
    const markets = await this.getHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_MARKETS));
    if (!markets) {
      return null;
    }

    const res: MarketsType = {};

    Object.keys(markets).forEach((symbol) => {
      if (
        !baseCurrency ||
        (baseCurrency && (symbol.endsWith(`/${baseCurrency}`) || symbol.startsWith(`${baseCurrency}/`)))
      ) {
        res[symbol] = JSON.parse(markets[symbol]);
      }
    });

    return res;
  }

  async getMarket(exchangeId: string, symbol: string): Promise<Market | null> {
    const market = await this.getHashValue(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_MARKETS), symbol);

    return market?.length ? JSON.parse(market) : null;
  }

  async setMarkets(exchangeId: string, markets: Dictionary<Market>): Promise<void> {
    const saveMarkets = {} as Dictionary<string>;

    for (const symbol of Object.keys(markets)) {
      saveMarkets[symbol] = JSON.stringify(markets[symbol]);
    }

    await this.deleteKey(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_MARKETS));
    await this.setHash(this.getExchangeKey(exchangeId, REDIS_ENTITY_TYPE.EXCHANGE_MARKETS), saveMarkets);

    await this.setMarketsLastUpdate(exchangeId);
  }
}
