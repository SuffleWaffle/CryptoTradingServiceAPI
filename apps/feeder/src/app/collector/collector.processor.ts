import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { GarbageCollectCandlesParams, GarbageCollectOrdersParams } from '@cupo/timeseries';
import { CommonProcessor } from '@cupo/backend/common';
import { CollectorService } from './collector.service';
import { QUEUE_NAME, QUEUE_TYPE } from '@cupo/backend/interface';

@Processor(QUEUE_TYPE.COLLECTOR)
export class CollectorProcessor extends CommonProcessor {
  constructor(private readonly service: CollectorService) {
    super(QUEUE_TYPE.COLLECTOR);
  }

  @Process({ name: QUEUE_NAME.COLLECT_INDICATORS, concurrency: 2 })
  async collectIndicators(job: Job<GarbageCollectCandlesParams>): Promise<void> {
    if (process.env.COLLECT_ALLOWED === '0' || process.env.COLLECT_ALLOWED?.toLowerCase() === 'false') {
      return;
    }

    const { exchangeId, symbol, timeframe, limit } = job.data;

    await this.service.collectIndicators({ exchangeId, symbol, timeframe, limit });
  }

  @Process({ name: QUEUE_NAME.COLLECT_CANDLES, concurrency: 2 })
  async collectCandles(job: Job<GarbageCollectCandlesParams>): Promise<void> {
    if (process.env.COLLECT_ALLOWED === '0' || process.env.COLLECT_ALLOWED?.toLowerCase() === 'false') {
      return;
    }

    const { exchangeId, symbol, timeframe, limit } = job.data;

    await this.service.collectCandles({ exchangeId, symbol, timeframe, limit });
  }

  @Process({ name: QUEUE_NAME.COLLECT_ORDERS, concurrency: 2 })
  async collectOrders(job: Job<GarbageCollectOrdersParams>): Promise<void> {
    if (process.env.COLLECT_ALLOWED === '0' || process.env.COLLECT_ALLOWED?.toLowerCase() === 'false') {
      return;
    }

    const { exchangeId, userId } = job.data;

    await this.service.collectOrders({ exchangeId, userId });
  }
}
