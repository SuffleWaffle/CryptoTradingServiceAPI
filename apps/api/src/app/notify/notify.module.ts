import { Module } from '@nestjs/common';
import { SubscriptionService } from '@cupo/backend/services';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';

@Module({
  providers: [NotifyService, SubscriptionService],
  controllers: [NotifyController],
})
export class NotifyModule {}
