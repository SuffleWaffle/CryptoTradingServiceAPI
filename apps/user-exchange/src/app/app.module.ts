import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueManagerModule } from '@cupo/backend/queue';
import { ConfigModule } from '@nestjs/config';
import { EventModule } from '@cupo/event';
import { MailModule } from '@cupo/mail';
import { BackendStorageModule } from '@cupo/backend/storage';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CcxtModule } from './ccxt/ccxt.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CcxtModule,
    QueueManagerModule,
    ConfigModule,
    BackendStorageModule,
    EventModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
