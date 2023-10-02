import { Injectable, Logger } from '@nestjs/common';
import { CandleArray, CandleArrayOrder, CandleObject, TIMEFRAME } from '@cupo/timeseries';
import { REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCandleService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.CANDLES);
  }

  convertCandleToRedisObject(candle: CandleObject): Record<string, string> {
    return { [candle.time.toString()]: JSON.stringify(candle) };
  }

  // convertCandleToRedisObject(data: CandleObject): Dictionary<string> | undefined {
  //   return data
  //     ? {
  //         candle: data.candle && JSON.stringify(data.candle),
  //         time: data.time && data.time.toString(),
  //         open: data.open && data.open.toString(),
  //         high: data.high && data.high.toString(),
  //         low: data.low && data.low.toString(),
  //         close: data.close && data.close.toString(),
  //         volume: data.volume && data.volume.toString(),
  //         update: data.update && data.update.toString(),
  //         finished: data.finished ? data.finished.toString() : undefined,
  //       }
  //     : undefined;
  // }

  convertRedisObjectToCandle(candleHash: string): CandleObject | null {
    try {
      return JSON.parse(candleHash);
    } catch (err) {
      Logger.error(`convertRedisObjectToCandle(candleHash): ${err.message}`);

      return null;
    }
  }

  // convertRedisObjectToCandle(candle: Record<string, string>): CandleObject | undefined {
  //   return candle
  //     ? {
  //         candle: candle.candle && JSON.parse(candle.candle),
  //         time: candle.time && +candle.time,
  //         open: candle.open && +candle.open,
  //         high: candle.high && +candle.high,
  //         low: candle.low && +candle.low,
  //         close: candle.close && +candle.close,
  //         volume: candle.volume && +candle.volume,
  //         update: candle.update && +candle.update,
  //         finished: candle.finished === 'true',
  //       }
  //     : undefined;
  // }

  async deleteAllCandles(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<void> {
    await this.deleteKey(this.getTimeSeriesKey(exchangeId, symbol, timeframe));
  }

  async deleteCandles(exchangeId: string, symbol: string, timeframe: TIMEFRAME, times: string[]): Promise<void> {
    await this.deleteHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe), ...times);
  }

  async getOldCandles(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    minimumTime: number
  ): Promise<string[]> {
    const redisCandles = await this.getHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe));
    // const data = await this.getKeys(`${this.prefix}:${exchangeId}:${symbol}:${timeframe}*`);

    const res = [];

    for (const key in redisCandles) {
      if (parseInt(key, 10) < minimumTime) {
        res.push(key);
      }
    }

    return res;
  }

  // fixme: deprecated method
  async setCandlesLastRequest(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<void> {
    await this.setKey(`${this.getTimeSeriesKey(exchangeId, symbol, timeframe)}Update`, new Date().getTime().toString());
  }

  // fixme: deprecated method
  async getCandlesLastRequest(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<number> {
    const update = await this.getKey(`${this.getTimeSeriesKey(exchangeId, symbol, timeframe)}Update`);

    return update ? parseInt(update, 10) : 0;
  }

  async getCandle(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    time: number
  ): Promise<CandleObject | null> {
    const redisCandles = await this.getHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe));
    const candleHash = redisCandles ? redisCandles[time.toString()] : null;

    return candleHash ? this.convertRedisObjectToCandle(candleHash) : null;
  }

  async getCandles(params: {
    exchangeId: string;
    symbol: string;
    timeframe: TIMEFRAME;
    limit?: number;
    sort?: 1 | -1; // 1 - ascendant, -1 - descendant
    minimumTime?: number;
  }): Promise<CandleObject[]> {
    const { exchangeId, symbol, timeframe, limit, sort, minimumTime } = params;

    const candles = (await this.getHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe))) || {};

    return Object.keys(candles)
      .filter((key) => !minimumTime || (minimumTime && parseInt(key, 10) >= minimumTime))
      .sort((a, b) => {
        return (+a - +b) * (sort || -1); // sort by time
      })
      .slice(0, limit)
      .map((key) => {
        return this.convertRedisObjectToCandle(candles[key]);
      });

    // const res = [];
    //
    // // to-do: think about optimization complexity here
    // for (const key in candles) {
    //   const candle = this.convertRedisObjectToCandle(candles[key]);
    //
    //   // if (candle?.finished) {
    //   if (!minimumTime || (minimumTime && candle.time >= minimumTime)) {
    //     res.push(candle);
    //   }
    //   // }
    // }
    //
    // return res
    //   .sort((a, b) => {
    //     return !sort || sort === 'desc' ? b.time - a.time : a.time - b.time; // sort by time
    //   })
    //   .slice(0, limit);

    // return (await this.getHashesByPattern(`${this.prefix}:${exchangeId}:${symbol}:${timeframe}*`, limit || CANDLE_LIMIT_VALUES, sort, minimumTime))
    //   .map((candle) => this.convertRedisObjectToCandle(candle))
    //   .filter((candle) => !!candle)
    //   .sort((a, b) => {
    //     return !sort || sort === 'desc' ? b.time - a.time : a.time - b.time; // sort by time
    //   })
    //   .slice(0, limit);
  }

  async setCandle(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    candle: CandleArray,
    finished: boolean | undefined = undefined
  ): Promise<void> {
    const candleRedis = this.convertCandleToRedisObject({
      candle: candle,
      time: candle[CandleArrayOrder.Time],
      open: candle[CandleArrayOrder.Open],
      high: candle[CandleArrayOrder.High],
      low: candle[CandleArrayOrder.Low],
      close: candle[CandleArrayOrder.Close],
      volume: candle[CandleArrayOrder.Volume],
      update: new Date().getTime(),
      finished,
    });

    return this.setHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe), candleRedis);

    // return this.setHash(
    //   `${this.prefix}:${exchangeId}:${symbol}:${timeframe}:${candle[CandleArrayOrder.Time]}`,
    //   {[String(candle[CandleArrayOrder.Time])] :this.convertCandleToRedisObject({
    //     candle: candle,
    //     time: candle[CandleArrayOrder.Time],
    //     open: candle[CandleArrayOrder.Open],
    //     high: candle[CandleArrayOrder.High],
    //     low: candle[CandleArrayOrder.Low],
    //     close: candle[CandleArrayOrder.Close],
    //     volume: candle[CandleArrayOrder.Volume],
    //     update: new Date().getTime(),
    //     finished,
    //   }})
    // );
  }
}
