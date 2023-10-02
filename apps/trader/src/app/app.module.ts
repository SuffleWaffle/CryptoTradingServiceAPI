import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ExchangeLibraryModule } from '@cupo/exchange';
import { EventModule } from '@cupo/event';
import { MailModule } from '@cupo/mail';
import { AppController } from './app.controller';
import { SignalModule } from './signal/signal.module';
import { OrdersModule } from './orders/orders.module';
import { UserModule } from './user/user.module';
import { AppService } from './app.service';
import { QueueManagerModule } from '@cupo/backend/queue';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    QueueManagerModule,
    EventModule,
    MailModule,
    SignalModule,
    OrdersModule,
    UserModule,
    ExchangeLibraryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
