import { ScheduleModule } from '@nestjs/schedule';
import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { IndicatorModule } from './indicator/indicator.module';
import { CandlesModule } from './candles/candles.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CollectorModule } from './collector/collector.module';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { ExchangeModule } from './exchange/exchange.module';
import { EventModule } from '@cupo/event';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventModule,
    CandlesModule,
    BackendStorageModule,
    IndicatorModule,
    CollectorModule,
    ExchangeModule,
    ExchangeLibraryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
