import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { RedisCandleService, RedisExchangeService, RedisTickerService } from '@cupo/backend/storage';
import {
  CandleObject,
  getCandleHumanTime,
  getCandleShift,
  GetCandlesParams,
  getCandleTime,
  HumanCandleObject,
  TIMEFRAME,
  TimeSeriesService,
} from '@cupo/timeseries';
import { TickersType } from '@cupo/backend/interface';
import { QueueService } from '@cupo/backend/queue';
import { CANDLE_LIMIT_VALUES } from '@cupo/backend/constant';

@Injectable()
export class TickersService {
  constructor(
    private readonly queueService: QueueService,
    private readonly timeSeries: TimeSeriesService,
    private readonly redisCandleService: RedisCandleService,
    private readonly redisTickers: RedisTickerService,
    private readonly redisExchange: RedisExchangeService
  ) {}

  async fetchCandles(fetchCandlesParams: GetCandlesParams): Promise<Job<GetCandlesParams>> {
    return this.queueService.addJob_FetchCandles({ ...fetchCandlesParams });
  }

  async getCandles(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<HumanCandleObject[]> {
    return (
      await this.redisCandleService.getCandles({
        exchangeId,
        symbol,
        timeframe,
        limit: CANDLE_LIMIT_VALUES,
        sort: -1,
      })
    ).map((candle) => ({
      ...candle,
      humanTime: getCandleHumanTime(timeframe, candle.time),
      shift: getCandleShift(timeframe, candle.time),
    }));
  }

  async getCandle(exchangeId: string, symbol: string, timeframe: TIMEFRAME, timestamp: number): Promise<CandleObject> {
    return await this.redisCandleService.getCandle(exchangeId, symbol, timeframe, getCandleTime(timeframe, timestamp));
  }

  async getTickers(exchangeId: string, baseCurrencies?: string[]): Promise<TickersType | null> {
    const markets = await this.redisExchange.getMarkets(exchangeId);
    Object.keys(markets).forEach((symbol) => {
      if (!markets[symbol].active || !markets[symbol].spot) {
        delete markets[symbol];
      }
    });

    const tickers = await this.redisTickers.getTickers(exchangeId, baseCurrencies);
    if (!tickers) {
      return null;
    }

    Object.keys(tickers).forEach((symbol) => {
      if (!markets[symbol]) {
        delete tickers[symbol];
      }
    });

    return tickers;
  }

  async getTicker(exchangeId: string, symbol: string): Promise<TickersType | null> {
    if (symbol) {
      const ticker = await this.redisTickers.getTicker(exchangeId, symbol);

      if (ticker) {
        return ticker;
      }
    }

    return null;
  }
}
