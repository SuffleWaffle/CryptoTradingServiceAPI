import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { CommonProcessor } from '@cupo/backend/common';
import {
  ORDER_EVENT,
  QUEUE_NAME,
  QUEUE_TYPE,
  QueueParamsUpdateBalances,
  SYSTEM_EVENT,
  USER_EVENT,
} from '@cupo/backend/interface';
import { EventService } from './event.service';

@Processor(QUEUE_TYPE.EVENT)
export class EventProcessor extends CommonProcessor {
  constructor(private readonly service: EventService) {
    super(QUEUE_TYPE.EVENT);
  }

  @Process({ name: QUEUE_NAME.ADD_ORDER_EVENT, concurrency: 16 })
  async addOrderEvent(job: Job<ORDER_EVENT>): Promise<void> {
    await this.service.saveOrderEvent(job.data);
  }

  @Process({ name: QUEUE_NAME.ADD_USER_EVENT, concurrency: 16 })
  async addUserEvent(job: Job<USER_EVENT>): Promise<void> {
    await this.service.saveUserEvent(job.data);
  }

  @Process({ name: QUEUE_NAME.ADD_SYSTEM_EVENT, concurrency: 16 })
  async saveSystemEvent(job: Job<SYSTEM_EVENT>): Promise<void> {
    await this.service.saveSystemEvent(job.data);
  }

  @Process({ name: QUEUE_NAME.UPDATE_USER_WALLET, concurrency: 16 })
  async updateUserWallet(job: Job<QueueParamsUpdateBalances>): Promise<void> {
    await this.service.updateUserWallet(job.data);
  }
}
