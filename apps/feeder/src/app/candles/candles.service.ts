import { Injectable, Logger } from '@nestjs/common';
import { OHLCV } from 'ccxt';
import { Job } from 'bull';
import { CandleArrayOrder, GetCandlesParams, getCandleTime, TIMEFRAME } from '@cupo/timeseries';
import { RedisCandleService, RedisExchangeService } from '@cupo/backend/storage';
import { QueueService } from '@cupo/backend/queue';
import { ExchangeLibService } from '@cupo/exchange';
import { getEnabledExchangeIds, INDICATOR_LIMIT_VALUES } from '@cupo/backend/constant';

@Injectable()
export class CandlesService {
  // https://www.epochconverter.com/
  // fetchCandlesSince = 1655251200000; // Wednesday, 1 June 2022 г., 0:00:00
  // fetchCandlesSince = undefined;

  constructor(
    private readonly queueService: QueueService,
    private readonly exchange: ExchangeLibService,
    private readonly redisExchange: RedisExchangeService,
    private readonly redisCandles: RedisCandleService
  ) {}

  async getSymbols(exchangeId: string): Promise<string[] | null> {
    const symbols: string[] = await this.redisExchange.getSymbols(exchangeId);
    return symbols?.length ? symbols : null;
  }

  async fetchTimeframesCandles(timeframe: TIMEFRAME, priority?: number): Promise<Array<Job<GetCandlesParams>>> {
    if (process.env.QUEUE_FETCH_CANDLES_ACTIVE !== '1') {
      return null;
    }

    const params: GetCandlesParams[] = [];

    const exchanges = getEnabledExchangeIds();
    for (const exchangeId of exchanges) {
      const tf = this.exchange.getTimeframes(exchangeId);
      if (!tf?.[timeframe]) {
        Logger.warn(`Exchange ${exchangeId} does not support ${timeframe} timeframe`);
        continue;
      }

      const symbols = await this.getSymbols(exchangeId);
      if (!symbols?.length) {
        Logger.warn(`No symbols for exchange [${exchangeId}] in fetchTimeframesCandles()`);
        return null;
      }

      for (const symbol of symbols) {
        params.push({
          exchangeId,
          symbol,
          timeframe,
        });

        // const update = await this.redisCandles.getCandlesLastRequest(exchangeId, symbol, timeframe);
        // if (Date.now() - update > CANDLE_UPDATE_TIMEOUT) {
        //   await this.redisCandles.setCandlesLastRequest(exchangeId, symbol, timeframe);
        //
        //   params.push({
        //     exchangeId,
        //     symbol,
        //     timeframe,
        //   });
        // }
      }
    }

    return this.queueService.addJobs_FetchCandles(params, {
      priority,
      // timeout: timeframeMSeconds(timeframe),
    });
  }

  // @Cron('2 */5 * * * *')
  async handleCronGetM5Candles(): Promise<void> {
    await this.fetchTimeframesCandles(TIMEFRAME.M5, 10)
      .then(() => {
        // Logger.log('Queue of fetching M5 timeframe candles started');
      })
      .catch((err) => {
        Logger.error(`Queue error: ${err.message}`);
      });
  }

  // @Cron('1 */15 * * * *')
  async handleCronGetM15Candles(): Promise<void> {
    await this.fetchTimeframesCandles(TIMEFRAME.M15, 5)
      .then(() => {
        // Logger.log('Queue of fetching M15 timeframe candles started');
      })
      .catch((err) => {
        Logger.error(`Queue error: ${err.message}`);
      });
  }

  // @Cron('5 0 * * * *')
  async handleCronGetH1Candles(): Promise<void> {
    await this.fetchTimeframesCandles(TIMEFRAME.H1, 1)
      .then(() => {
        // Logger.log('Queue of fetching H1 timeframe candles started');
      })
      .catch((err) => {
        Logger.error(`Queue error: ${err.message}`);
      });
  }

  glueCandles(candles: OHLCV[], timeframe: TIMEFRAME): OHLCV[] {
    const glue: { [timestamp: string]: { candle: OHLCV; times: number[]; count: number } } = {};

    for (const candle of candles) {
      const timestamp = getCandleTime(timeframe, candle[CandleArrayOrder.Time]);
      if (!glue[timestamp]) {
        glue[timestamp] = { candle, times: [candle[CandleArrayOrder.Time]], count: 1 };
        glue[timestamp].candle[CandleArrayOrder.Time] = timestamp;
      } else {
        // OPEN
        glue[timestamp].candle[CandleArrayOrder.Open] = glue[timestamp].times.every(
          (time) => time > candle[CandleArrayOrder.Time]
        )
          ? candle[CandleArrayOrder.Open]
          : glue[timestamp].candle[CandleArrayOrder.Open];

        // HIGH
        glue[timestamp].candle[CandleArrayOrder.High] = Math.max(
          glue[timestamp].candle[CandleArrayOrder.High],
          candle[CandleArrayOrder.High]
        );

        // LOW
        glue[timestamp].candle[CandleArrayOrder.Low] = Math.min(
          glue[timestamp].candle[CandleArrayOrder.Low],
          candle[CandleArrayOrder.Low]
        );

        // CLOSE
        glue[timestamp].candle[CandleArrayOrder.Close] = glue[timestamp].times.every(
          (time) => time < candle[CandleArrayOrder.Time]
        )
          ? candle[CandleArrayOrder.Close]
          : glue[timestamp].candle[CandleArrayOrder.Close];

        // VOLUME
        glue[timestamp].candle[CandleArrayOrder.Volume] =
          glue[timestamp].candle[CandleArrayOrder.Volume] + candle[CandleArrayOrder.Volume];

        glue[timestamp].times.push(candle[CandleArrayOrder.Volume]);
        glue[timestamp].count++;
      }
    }

    return Object.values(glue)
      .filter((candle) => {
        if (
          timeframe === TIMEFRAME.M30 &&
          (candle.count === 2 || candle.candle[CandleArrayOrder.Time] === getCandleTime(timeframe))
        ) {
          return true;
        }
        if (
          timeframe === TIMEFRAME.H2 &&
          (candle.count === 2 || candle.candle[CandleArrayOrder.Time] === getCandleTime(timeframe))
        ) {
          return true;
        }
        if (
          timeframe === TIMEFRAME.H4 &&
          (candle.count === 4 || candle.candle[CandleArrayOrder.Time] === getCandleTime(timeframe))
        ) {
          return true;
        }

        return false;
      })
      .map((item) => item.candle);
  }

  async addJob_CalculateIndicator(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    limit?: number
  ): Promise<void> {
    await this.queueService.addJob_CalculateIndicator({
      exchangeId,
      symbol,
      timeframe,
      limit: limit || INDICATOR_LIMIT_VALUES,
    });
  }

  // fixme: deprecated method
  async setCandlesLastRequest(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<void> {
    await this.redisCandles.setCandlesLastRequest(exchangeId, symbol, timeframe);
  }

  // fixme: deprecated method
  async getCandlesLastRequest(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<number> {
    return this.redisCandles.getCandlesLastRequest(exchangeId, symbol, timeframe);
  }

  async clearUpdateCandlesQueue(currentJob: Job<GetCandlesParams>): Promise<number> {
    return await this.queueService.clearUpdateCandlesQueue(currentJob);
  }
}
