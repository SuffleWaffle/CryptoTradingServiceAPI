import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { BackendStorageModule } from '@cupo/backend/storage';
import { TimeSeriesModule } from '@cupo/timeseries';
import { IndicatorProcessor } from './indicator.processor';
import { IndicatorService } from './indicator.service';
import { QueueManagerModule } from '@cupo/backend/queue';
import { QUEUE_TYPE } from '@cupo/backend/interface';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_TYPE.INDICATOR,
    }),
    QueueManagerModule,
    ExchangeLibraryModule,
    TimeSeriesModule,
    BackendStorageModule,
  ],
  providers: [IndicatorService, IndicatorProcessor],
})
export class IndicatorModule {}
