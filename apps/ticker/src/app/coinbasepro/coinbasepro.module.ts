import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { CoinbaseproService } from './coinbasepro.service';

@Module({
  imports: [BackendStorageModule],
  providers: [CoinbaseproService],
})
export class CoinbaseproModule {}
