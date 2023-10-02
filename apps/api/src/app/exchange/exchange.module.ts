import { Module } from '@nestjs/common';
import { ExchangeController } from './exchange.controller';
import { ExchangeService } from './exchange.service';
import { QueueManagerModule } from '@cupo/backend/queue';

@Module({
  imports: [QueueManagerModule],
  controllers: [ExchangeController],
  providers: [ExchangeService],
})
export class ExchangeModule {}
