import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { BinanceusService } from './binanceus.service';

@Module({
  imports: [BackendStorageModule],
  providers: [BinanceusService],
})
export class BinanceusModule {}
