import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { BitfinexService } from './bitfinex.service';

@Module({
  imports: [BackendStorageModule],
  providers: [BitfinexService],
})
export class BitfinexModule {}
