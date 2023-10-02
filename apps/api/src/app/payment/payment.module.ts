import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SubscriptionService } from '@cupo/backend/services';

@Module({
  imports: [UserModule],
  providers: [PaymentService, SubscriptionService],
  controllers: [PaymentController],
})
export class PaymentModule {}
