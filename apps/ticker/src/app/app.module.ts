import { Module } from '@nestjs/common';
import { EventModule } from '@cupo/event';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueManagerModule } from '@cupo/backend/queue';
import { AppService } from './app.service';
import { BitsoModule } from './bitso/bitso.module';
import { AppController } from './app.controller';
import { BinanceModule } from './binance/binance.module';
import { BitfinexModule } from './bitfinex/bitfinex.module';
import { BinanceusModule } from './binanceus/binanceus.module';
import { CoinbaseproModule } from './coinbasepro/coinbasepro.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueManagerModule,
    EventModule,
    BitsoModule,
    BinanceModule,
    BinanceusModule,
    BitfinexModule,
    CoinbaseproModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
