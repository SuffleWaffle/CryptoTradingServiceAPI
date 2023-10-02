import { Module } from '@nestjs/common';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { CandlesProcessor } from './candles.processor';
import { CandlesService } from './candles.service';
import { QueueManagerModule } from '@cupo/backend/queue';
import { BullModule } from '@nestjs/bull';
import { QUEUE_TYPE } from '@cupo/backend/interface';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_TYPE.CANDLE,
    }),
    QueueManagerModule,
    ExchangeLibraryModule,
  ],
  providers: [CandlesService, CandlesProcessor],
})
export class CandlesModule {}
