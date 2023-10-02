import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { QueueManagerModule } from '@cupo/backend/queue';
import { QUEUE_TYPE } from '@cupo/backend/interface';
import { EventProcessor } from './event.processor';
import { EventService } from './event.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_TYPE.EVENT,
    }),
    QueueManagerModule,
  ],
  providers: [EventService, EventProcessor],
  exports: [EventService],
})
export class EventModule {}
