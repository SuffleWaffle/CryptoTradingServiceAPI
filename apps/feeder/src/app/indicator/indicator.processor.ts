import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { CommonProcessor } from '@cupo/backend/common';
import { CalculateIndicatorsParams } from '@cupo/indicators';
import { IndicatorService } from './indicator.service';
import { Logger } from '@nestjs/common';
import { QUEUE_NAME, QUEUE_TYPE } from '@cupo/backend/interface';

@Processor(QUEUE_TYPE.INDICATOR)
export class IndicatorProcessor extends CommonProcessor {
  constructor(private readonly service: IndicatorService) {
    super(QUEUE_TYPE.INDICATOR);
  }

  @Process({ name: QUEUE_NAME.CALCULATE_INDICATOR, concurrency: 16 })
  async calculateIndicator(job: Job<CalculateIndicatorsParams>) {
    const { exchangeId, symbol, timeframe } = job.data;

    try {
      if (!(await this.service.calculateIndicator(job.data))) {
        await job.discard();
        return;
      }
    } catch (e) {
      Logger.error(`IDX [${exchangeId}]: ${e.message} ... ${JSON.stringify(job.data)}`);
      await job.discard();
      return;
    }

    await this.service.collectCandlesJob({ exchangeId, symbol, timeframe });
  }
}
