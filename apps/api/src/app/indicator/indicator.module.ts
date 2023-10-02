import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { QueueManagerModule } from '@cupo/backend/queue';
import { TimeSeriesModule } from '@cupo/timeseries';
import { IndicatorController } from './indicator.controller';
import { IndicatorService } from './indicator.service';

@Module({
  imports: [QueueManagerModule, TimeSeriesModule, BackendStorageModule],
  controllers: [IndicatorController],
  providers: [IndicatorService],
})
export class IndicatorModule {}
