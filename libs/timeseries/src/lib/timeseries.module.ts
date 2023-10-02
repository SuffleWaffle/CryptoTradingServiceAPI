import { Module } from '@nestjs/common';
import { TimeSeriesService } from './timeseries.service';

@Module({
  controllers: [],
  providers: [TimeSeriesService],
  exports: [TimeSeriesService],
})
export class TimeSeriesModule {}
