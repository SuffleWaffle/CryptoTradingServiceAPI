import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { CalculateIndicatorsParams, INDICATOR_MOCKS, IndicatorsValues } from '@cupo/indicators';
import { getCandleShift, getCandleTimeByShift, TIMEFRAME } from '@cupo/timeseries';
import { RedisIndicatorsService } from '@cupo/backend/storage';
import { INDICATOR_LIMIT_VALUES } from '@cupo/backend/constant/src/lib/feeder.constant';
import { QueueService } from '@cupo/backend/queue';

@Injectable()
export class IndicatorService {
  constructor(private readonly queueService: QueueService, private readonly redisService: RedisIndicatorsService) {
    setTimeout(async () => {
      const cards = await redisService.getIndicatorsList();

      if (!Object.keys(cards || {})?.length) {
        for (const card of INDICATOR_MOCKS) {
          await this.redisService.setIndicatorCards(card);
        }
      }
    });
  }

  // get all indicators from redis
  async getIndicatorsList() {
    return this.redisService.getIndicatorsList();
  }

  async getIndicatorsValues(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    indexId: string,
    limit?: number
  ): Promise<IndicatorsValues[]> {
    const minimumTime = getCandleTimeByShift(timeframe, limit || INDICATOR_LIMIT_VALUES);

    const values: IndicatorsValues[] = await this.redisService.getIndicatorsValues(
      exchangeId,
      symbol,
      timeframe,
      limit || INDICATOR_LIMIT_VALUES,
      indexId,
      -1,
      minimumTime
    );

    if (values && values.length) {
      return values.map((idx) => {
        idx.humanTime = new Date(idx.time);
        idx.shift = getCandleShift(timeframe, idx.time);

        return idx;
      });
    }

    await this.recalculateIndicatorsValues(exchangeId, symbol, timeframe, indexId, limit || INDICATOR_LIMIT_VALUES);

    return null;
  }

  async recalculateIndicatorsValues(
    exchangeId: string,
    symbol: string,
    timeframe: TIMEFRAME,
    indexId?: string,
    limit?: number
  ): Promise<Job<CalculateIndicatorsParams>> {
    // console.log('API: recalculateIndicatorsValues', exchangeId, symbol, timeframe, indexId, limit);

    return await this.queueService.addJob_CalculateIndicator({
      exchangeId,
      symbol,
      timeframe,
      indexId,
      limit: limit || INDICATOR_LIMIT_VALUES,
    } as CalculateIndicatorsParams);
  }
}
