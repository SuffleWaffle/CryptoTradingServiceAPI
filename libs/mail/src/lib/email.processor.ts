import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { CommonProcessor } from '@cupo/backend/common';
import { QUEUE_NAME, QUEUE_TYPE, SendEmailNotificationType } from '@cupo/backend/interface';
import { EmailService } from './email.service';

@Processor(QUEUE_TYPE.EMAIL)
export class EmailProcessor extends CommonProcessor {
  constructor(private readonly service: EmailService) {
    super(QUEUE_TYPE.EMAIL);
  }

  @Process({ name: QUEUE_NAME.SEND_EMAIL })
  async sendEmail(job: Job<SendEmailNotificationType>): Promise<void> {
    try {
      if (await job.queue.isPaused()) {
        await job.queue.resume();
      }

      await this.service.sendEmailNotification(job.data);
    } catch (error) {
      Logger.error('Error occurred. Pausing email queue...', {}, error);
      await job.queue.pause();
    }
  }
}
