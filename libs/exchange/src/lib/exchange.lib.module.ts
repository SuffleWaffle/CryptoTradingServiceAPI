import { Module } from '@nestjs/common';
import { ExchangeLibService } from './exchange.lib.service';

@Module({
  controllers: [],
  imports: [],
  exports: [ExchangeLibService],
  providers: [ExchangeLibService],
})
export class ExchangeLibraryModule {}
