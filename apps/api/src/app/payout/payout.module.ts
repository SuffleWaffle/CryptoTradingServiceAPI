import { Module } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';

@Module({
  providers: [PayoutService],
  controllers: [PayoutController],
})
export class PayoutModule {}
