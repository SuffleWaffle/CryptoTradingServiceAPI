import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BackendStorageModule } from '@cupo/backend/storage';
import { QueueManagerModule } from '@cupo/backend/queue';
import { EventModule } from '@cupo/event';
import { RolesGuard } from '@cupo/backend/common';
import { MailModule } from '@cupo/mail';
import { IndicatorModule } from './indicator/indicator.module';
import { MarketingModule } from './marketing/marketing.module';
import { ExchangeModule } from './exchange/exchange.module';
import { TickersModule } from './tickers/tickers.module';
import { AppController } from './app.controller';
import { PaymentModule } from './payment/payment.module';
import { NotifyModule } from './notify/notify.module';
import { PayoutModule } from './payout/payout.module';
import { OrderModule } from './order/order.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LogModule } from './log/log.module';
import { JwtAuthGuard } from './provider/jwt-auth.guard';
import { EventApiModule } from './event/eventApiModule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 1000,
    }),
    ScheduleModule.forRoot(),
    // GLOBAL MODULES
    EventModule,
    QueueManagerModule,
    BackendStorageModule,
    // GLOBAL MODULES END
    EventApiModule,
    AuthModule,
    IndicatorModule,
    ExchangeModule,
    TickersModule,
    OrderModule,
    UserModule,
    AuthModule,
    LogModule,
    PaymentModule,
    MarketingModule,
    MailModule,
    NotifyModule,
    PayoutModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
