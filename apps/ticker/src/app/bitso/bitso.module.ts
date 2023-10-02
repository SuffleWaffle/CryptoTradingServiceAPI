import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { BitsoService } from './bitso.service';

@Module({
  imports: [BackendStorageModule],
  providers: [BitsoService],
})
export class BitsoModule {}
