import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BackendStorageModule } from '@cupo/backend/storage';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { QueueManagerModule } from '@cupo/backend/queue';
import { TimeSeriesModule } from '@cupo/timeseries';
import { OrderProcessor } from './order.processor';
import { OrdersService } from './orders.service';
import { QUEUE_TYPE } from '@cupo/backend/interface';
import { EventModule } from '@cupo/event';

@Module({
  imports: [
    // TypeOrmModule.forFeature([TradeOrderEntity, TradeSignalEntity, TradeLogEntity]),
    BullModule.registerQueue({
      name: QUEUE_TYPE.ORDER,
    }),
    QueueManagerModule,
    EventModule,
    BackendStorageModule,
    TimeSeriesModule,
    ExchangeLibraryModule,
  ],
  providers: [OrdersService, OrderProcessor],
})
export class OrdersModule {}
