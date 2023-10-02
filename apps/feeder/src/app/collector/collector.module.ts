import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service';
import { CollectorProcessor } from './collector.processor';
import { BullModule } from '@nestjs/bull';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { QueueManagerModule } from '@cupo/backend/queue';
import { QUEUE_TYPE } from '@cupo/backend/interface';
import { EventModule } from '@cupo/event';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_TYPE.COLLECTOR,
    }),
    QueueManagerModule,
    EventModule,
    ExchangeLibraryModule,
  ],

  providers: [CollectorService, CollectorProcessor],
})
export class CollectorModule {}
