import { Module } from '@nestjs/common';

import { TickersController } from './tickers.controller';
import { TickersService } from './tickers.service';
import { BackendStorageModule } from '@cupo/backend/storage';
import { TimeSeriesModule } from '@cupo/timeseries';
import { QueueManagerModule } from '@cupo/backend/queue';

@Module({
  imports: [QueueManagerModule, TimeSeriesModule, BackendStorageModule],
  controllers: [TickersController],
  providers: [TickersService],
})
export class TickersModule {}
