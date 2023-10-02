import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { BackendStorageModule } from '@cupo/backend/storage';
import { QueueManagerModule } from '@cupo/backend/queue';
import { TimeSeriesModule } from '@cupo/timeseries';
import { QUEUE_TYPE } from '@cupo/backend/interface';
import { SignalProcessor } from './signal.processor';
import { SignalService } from './signal.service';
import { EventModule } from '@cupo/event';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_TYPE.SIGNAL,
    }),
    // TypeOrmModule.forFeature([TradeSignalEntity]),
    QueueManagerModule,
    EventModule,
    ExchangeLibraryModule,
    BackendStorageModule,
    TimeSeriesModule,
  ],
  providers: [SignalService, SignalProcessor],
})
export class SignalModule {}
