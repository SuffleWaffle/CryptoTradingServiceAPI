import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { BackendStorageModule } from '@cupo/backend/storage';
import { QueueManagerModule } from '@cupo/backend/queue';
import { SubscriptionService } from '@cupo/backend/services';
import { EventModule } from '@cupo/event';
import { ExchangeLibraryModule } from '@cupo/exchange';

@Module({
  imports: [QueueManagerModule, BackendStorageModule, EventModule, ExchangeLibraryModule],
  providers: [OrderService, SubscriptionService],
  controllers: [OrderController],
})
export class OrderModule {}
