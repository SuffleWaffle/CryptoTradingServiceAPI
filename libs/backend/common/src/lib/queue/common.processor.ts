import { OnQueueActive, OnQueueError, OnQueueFailed, OnQueueStalled, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { messageRepresentation } from '@cupo/backend/constant';

export class CommonProcessor {
  queueType: string;

  constructor(type: string) {
    this.queueType = type;
  }

  @Process()
  async defaultProcessor(job: Job): Promise<void> {
    console.error(this.queueType, job?.name, 'unhandled job with data:', job?.data);
  }

  @OnQueueActive()
  // onActive(job) {
  onActive() {
    // console.log(
    //   `Processing ${this.queueType} job "${job.id}" of type "${
    //     job.name
    //   }" with data ${JSON.stringify(job.data)}...`
    // );
  }

  @OnQueueError()
  onError(error: Error) {
    Logger.error(`Error in ${this.queueType.toUpperCase()} job. Reason: ${error.message}`);
  }

  @OnQueueStalled()
  async onStalled(job: Job) {
    Logger.warn(`Stalled ${this.queueType.toUpperCase()} job ${job.name.toUpperCase()}:${job.id}`);
  }

  @OnQueueFailed()
  async onFail(job: Job, err: Error) {
    Logger.error(
      `Fail in ${this.queueType.toUpperCase()} job ${job?.name?.toUpperCase()}, data: ${messageRepresentation(
        JSON.stringify(job?.data || {})
      )}... Reason: ${messageRepresentation(job?.failedReason)}... Error: ${messageRepresentation(err.message)}`
    );
  }
}
