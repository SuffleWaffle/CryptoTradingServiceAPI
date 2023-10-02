import { Module } from '@nestjs/common';
import { SubscriptionService } from '@cupo/backend/services';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CouponService } from './coupon.service';
import { EventModule } from '@cupo/event';

@Module({
  imports: [EventModule],
  providers: [UserService, CouponService, SubscriptionService],
  controllers: [UserController],
})
export class UserModule {}
