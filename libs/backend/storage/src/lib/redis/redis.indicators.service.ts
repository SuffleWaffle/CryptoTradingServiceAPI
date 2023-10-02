import { Injectable } from '@nestjs/common';
import { TIMEFRAME } from '@cupo/timeseries';
import { IndicatorCard, IndicatorsObject, IndicatorsValues } from '@cupo/indicators';
import { REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { RedisService } from './redis.service';

@Injectable()
export class RedisIndicatorsService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.INDICATORS);
  }

  convertIndicatorToRedisObject(
    data: Record<string, number | Record<string, number>>
  ): Record<string, string> | undefined {
    return (
      data && {
        value: data.value && JSON.stringify(data.value),
        time: data.time && data.time.toString(),
        update: data.update && data.update.toString(),
        finished: data.finished && data.finished.toString(),
      }
    );
  }

  convertRedisHashToIndicatorsValues(indicators: string, id?: string): IndicatorsValues {
    const data = JSON.parse(indicators) as IndicatorsValues;

    if (!id) {
      return data;
    }

    const res = {} as IndicatorsValues;

    for (const key in data) {
      if (key === 'time' || key === 'update' || key === 'finished' || key === id) {
        res[key] = data[key];
      }
    }

    return res;
  }

  // convertRedisHashToIndicatorsValues(indicators: Record<string, string>, id?: string): IndicatorsValues {
  //   const res = {} as IndicatorsValues;
  //
  //   for (const key of Object.keys(indicators)) {
  //     if (key === 'time') {
  //       res.time = +indicators[key];
  //     } else if (key === 'finished') {
  //       res.finished = indicators[key] === 'true' ? true : undefined;
  //     } else if (key === 'update') {
  //       res.update = +indicators[key];
  //     } else if (!id || (id && key === id)) {
  //       try {
  //         if (indicators[key] === '') {
  //           // empty string is there is no indicator value
  //         } else if (indicators[key] && indicators[key].indexOf('{') >= 0) {
  //           res[key] = JSON.parse(indicators[key]);
  //         } else {
  //           res[key] = +indicators[key];
  //         }
  //       } catch (error) {
  //         console.error('convertRedisObjectToIndicatorsValues:', error.message, key, indicators[key], indicators);
  //
  //         res[key] = undefined;
  //       }
  //     }
  //   }
  //
  //   return res;
  // }

  async setIndicatorCards(idx: IndicatorCard): Promise<void> {
    return this.setHash(REDIS_ENTITY_TYPE.INDICATORS, {
      [idx.id]: JSON.stringify(idx),
    });
  }

  async getIndicatorsList(idxId?: string): Promise<Record<string, IndicatorCard>> {
    const indicatorsRedis = await this.getHash(REDIS_ENTITY_TYPE.INDICATORS);
    const indicators = {};

    if (indicatorsRedis) {
      for (const key of Object.keys(indicatorsRedis)) {
        const card = JSON.parse(indicatorsRedis[key]) as IndicatorCard;
        if (card.isArchived || card.isDeleted) {
          continue;
        }

        if (idxId === undefined || key === idxId) {
          indicators[key] = card;
        }
      }
    }

    return indicators;
  }

  async deleteAllIndicators(exchangeId: string, symbol: string, timeframe: TIMEFRAME): Promise<void> {
    await this.deleteKey(this.getTimeSeriesKey(exchangeId, symbol, timeframe));
  }

  async deleteIndicators(exchangeId: string, symbol: string, timeframe: TIMEFRAME, times: string[]): Promise<void> {
    await this.deleteHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe), ...times);
  }

  async getOldIndicators(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    minimumTime: number
  ): Promise<string[]> {
    const redisIdx = (await this.getHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe))) || {};

    const res = [];

    for (const key in redisIdx) {
      if (parseInt(key, 10) < minimumTime) {
        res.push(key);
      }
    }

    return res;
  }

  async getIndicatorsValues(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    limit?: number | undefined,
    indexId?: string,
    sort: 1 | -1 = -1, // 1 - ascendant, -1 - descendant
    minimumTime?: number
  ): Promise<IndicatorsValues[]> {
    const idx = (await this.getHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe))) || {};

    return Object.keys(idx)
      .filter((key) => !minimumTime || (minimumTime && parseInt(key, 10) >= minimumTime))
      .sort((a, b) => {
        return (+a - +b) * sort; // sort by time
      })
      .slice(0, limit)
      .map((key) => {
        return this.convertRedisHashToIndicatorsValues(idx[key], indexId);
      });
    // return (await this.getHashesByPattern(`${this.prefix}:${exchangeId}:${symbol}:${timeframe}*`, limit, sort, minimumTime))
    //   .map((idx) => this.convertRedisHashToIndicatorsValues(idx, indexId))
    //   .filter((idx) => !!idx && Object.keys(idx).length)
    //   .sort((a, b) => {
    //     return !sort || sort === 'desc' ? b.time - a.time : a.time - b.time; // sort by time
    //   })
    //   .slice(0, limit);
  }

  async getIndicatorsValue(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    timestamp: number
  ): Promise<IndicatorsValues | null> {
    const idx = await this.getHashValue(this.getTimeSeriesKey(exchangeId, symbol, timeframe), timestamp.toString());

    return idx ? this.convertRedisHashToIndicatorsValues(idx) : null;
  }

  async setIndicatorsValue(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    timestamp: number,
    value: IndicatorsObject,
    finished = false
  ): Promise<void> {
    const idxHash = await this.getHashValue(this.getTimeSeriesKey(exchangeId, symbol, timeframe), timestamp.toString());

    const store: IndicatorsValues = {
      ...(idxHash ? JSON.parse(idxHash) : {}),
      ...value,
      finished,
      time: timestamp,
      update: Date.now(),
    };

    return this.setHash(this.getTimeSeriesKey(exchangeId, symbol, timeframe), {
      [timestamp.toString()]: JSON.stringify(store),
    });
  }
}
