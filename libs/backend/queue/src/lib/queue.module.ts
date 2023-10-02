import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { BackendStorageModule, queueBullConfig } from '@cupo/backend/storage';
import { QUEUE_TYPE } from '@cupo/backend/interface';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [
    BackendStorageModule,
    BullModule.forRoot(queueBullConfig),
    BullModule.registerQueue(
      {
        name: QUEUE_TYPE.CANDLE,
      },
      {
        name: QUEUE_TYPE.SIGNAL,
      },
      {
        name: QUEUE_TYPE.INDICATOR,
      },
      {
        name: QUEUE_TYPE.EXCHANGE,
      },
      {
        name: QUEUE_TYPE.COLLECTOR,
      },
      {
        name: QUEUE_TYPE.EVENT,
      },
      {
        name: QUEUE_TYPE.ORDER,
      },
      {
        name: QUEUE_TYPE.EMAIL,
        limiter: {
          max: 10,
          duration: 1000,
        },
      }
    ),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueManagerModule {}
