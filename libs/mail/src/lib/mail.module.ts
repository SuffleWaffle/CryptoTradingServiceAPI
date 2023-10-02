import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { QUEUE_TYPE } from '@cupo/backend/interface';
import { QueueManagerModule } from '@cupo/backend/queue';
import { SendPulseProvider } from './providers/sendPulse.provider';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [
    QueueManagerModule,
    BullModule.registerQueue({
      name: QUEUE_TYPE.EMAIL,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }),
  ],
  providers: [EmailService, SendPulseProvider, EmailProcessor],
  exports: [EmailService],
})
export class MailModule {}
