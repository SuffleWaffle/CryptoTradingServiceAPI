import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { BinanceService } from './binance.service';

@Module({
  imports: [BackendStorageModule],
  providers: [BinanceService],
})
export class BinanceModule {}
