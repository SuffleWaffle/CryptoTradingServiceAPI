import { Module } from '@nestjs/common';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { BackendStorageModule } from '@cupo/backend/storage';
import { SubscriptionService } from '@cupo/backend/services';
import { UserService } from './user.service';

@Module({
  imports: [ExchangeLibraryModule, BackendStorageModule],
  providers: [UserService, SubscriptionService],
})
export class UserModule {}
