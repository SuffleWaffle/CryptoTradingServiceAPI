import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CommonProcessor } from '@cupo/backend/common';
import { SignalService } from './signal.service';
import {
  QUEUE_NAME,
  QUEUE_TYPE,
  QueueParamsCalculateIndicatorSignal,
  StrategyIndicatorSignalsCUPO,
} from '@cupo/backend/interface';

@Processor(QUEUE_TYPE.SIGNAL)
export class SignalProcessor extends CommonProcessor {
  constructor(private readonly service: SignalService) {
    super(QUEUE_TYPE.SIGNAL);
  }

  @Process({ name: QUEUE_NAME.CHECK_SIGNAL_OPEN_ORDERS, concurrency: 1 })
  async checkSignalsOpenUserOrdersProcessor(job: Job<StrategyIndicatorSignalsCUPO>): Promise<void> {
    // const { userId, exchangeId, symbol, conditions, price, market } = job.data;

    await this.service.check_AllUsers_OrdersSignalsCUPOStrategy(job.data);

    // const tradeSignals: TradeSignalType[] = await this.service.check_User_OrdersSignalsCUPOStrategy(job.data);
    //
    // if (tradeSignals?.length) {
    //   const jobs = [];
    //   tradeSignals.forEach((signal) => {
    //     jobs.push(this.service.startOrderJob(signal));
    //   });
    //
    //   await Promise.all(jobs);
    //
    //   // Logger.log(`ORDERS SIGNAL PROCESSOR ${getIPAddress()} signals number: ${jobs.length}`);
    // }
  }

  @Process({ name: QUEUE_NAME.CHECK_SIGNAL_INDICATORS, concurrency: 8 })
  async calculateIndicatorsSignalsProcessor(job: Job<QueueParamsCalculateIndicatorSignal>): Promise<void> {
    const { exchangeId, symbol } = job.data;
    if (!exchangeId || !symbol) {
      Logger.error(`Invalid job data for ${job.name}: ${JSON.stringify(job.data)}`);
      await job.discard();
      return;
    }

    // await this.service.clearCalculateSignalsQueue(job);

    const signals: StrategyIndicatorSignalsCUPO = await this.service.checkIndicatorSignalsCUPOStrategy(
      exchangeId,
      symbol
    );

    // if (!signals?.conditions?.length) {
    //   // await job.moveToCompleted(`Job has no signals ${QUEUE_NAME.CALCULATE_SIGNAL}: ${exchangeId} ${symbol} ${new Date(job.timestamp).toISOString()}`, true);
    //   await job.discard();
    //   return;
    // }

    // Logger.log(`INDICATOR SIGNAL PROCESSOR ${getIPAddress()} ${exchangeId}, ${symbol} conditions number: ${signals.conditions.length}`);

    if (signals && signals.conditions) {
      await this.service.check_AllUsers_OrdersSignalsCUPOStrategy(signals);

      // await this.service.addJob_checkSignalsOpenUserOrdersProcessor(signals);
    }
  }
}
