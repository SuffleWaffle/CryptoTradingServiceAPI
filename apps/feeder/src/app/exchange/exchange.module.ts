import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { ExchangeLibraryModule } from '@cupo/exchange';
import { QueueManagerModule } from '@cupo/backend/queue';
import { TimeSeriesModule } from '@cupo/timeseries';
import { QUEUE_TYPE } from '@cupo/backend/interface/src/lib/queue.interface';

import { ExchangeProcessor } from './exchange.processor';
import { ExchangeService } from './exchange.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_TYPE.EXCHANGE,
    }),
    QueueManagerModule,
    ExchangeLibraryModule,
    TimeSeriesModule,
  ],
  providers: [ExchangeService, ExchangeProcessor],
})
export class ExchangeModule {}
