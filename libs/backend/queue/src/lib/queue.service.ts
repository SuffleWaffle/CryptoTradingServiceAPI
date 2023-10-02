import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, JobOptions, JobStatus, Queue } from 'bull';
import { GarbageCollectCandlesParams, GarbageCollectOrdersParams, GetCandlesParams, TIMEFRAME } from '@cupo/timeseries';
import { CalculateIndicatorsParams } from '@cupo/indicators';
import { queueBullConfig, RedisExchangeService } from '@cupo/backend/storage';
import { BAD_SYMBOL_FRINGE, CANDLE_UPDATE_TIMEOUT, TICKER_UPDATE_TIMEOUT } from '@cupo/backend/constant';
import {
  ORDER_EVENT,
  QUEUE_NAME,
  QUEUE_TYPE,
  QueueParamsCalculateIndicatorSignal,
  QueueParamsCloseOrders,
  QueueParamsOpenOrder,
  QueueParamsUpdateBalances,
  SendEmailNotificationType,
  StrategyIndicatorSignalsCUPO,
  SYSTEM_EVENT,
  USER_EVENT,
} from '@cupo/backend/interface';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_TYPE.ORDER) private orderQueue: Queue,
    @InjectQueue(QUEUE_TYPE.CANDLE) private candleQueue: Queue,
    @InjectQueue(QUEUE_TYPE.INDICATOR) private indicatorQueue: Queue,
    @InjectQueue(QUEUE_TYPE.SIGNAL) private signalQueue: Queue,
    @InjectQueue(QUEUE_TYPE.COLLECTOR) private collectQueue: Queue,
    @InjectQueue(QUEUE_TYPE.EVENT) private eventQueue: Queue,
    @InjectQueue(QUEUE_TYPE.EMAIL) private emailQueue: Queue,
    private readonly redisExchange: RedisExchangeService
  ) {
    if (process.env.REDIS_CLEAR_QUEUE === '1') {
      candleQueue.pause().then(() => {
        return this.candleQueue.clean(60 * 1000).then((jobs) => {
          Logger.log(`Cleared [${this.candleQueue.name}] jobs:`, jobs && jobs.length);

          candleQueue.resume().then();
        });
      });

      indicatorQueue.pause().then(() => {
        return this.indicatorQueue.clean(60 * 1000).then((jobs) => {
          Logger.log(`Cleared [${this.indicatorQueue.name}] jobs:`, jobs && jobs.length);

          indicatorQueue.resume().then();
        });
      });
    }

    // signalQueue.obliterate({ force: true }).then(() => {
    //   signalQueue.resume().then();
    // });
    signalQueue.clean(0, 'wait').then();
    signalQueue.clean(0, 'active').then();
    signalQueue.clean(0, 'delayed').then();
    signalQueue.clean(0, 'paused').then();

    orderQueue.clean(0, 'wait').then();
    orderQueue.clean(0, 'active').then();
    orderQueue.clean(0, 'delayed').then();
    orderQueue.clean(0, 'paused').then();
  }

  private getQueue(jobName: QUEUE_NAME): Queue | undefined {
    switch (jobName) {
      case QUEUE_NAME.CHECK_SIGNAL_INDICATORS:
      case QUEUE_NAME.CHECK_SIGNAL_OPEN_ORDERS:
        return this.signalQueue;
      case QUEUE_NAME.CANCEL_ORDER:
      case QUEUE_NAME.OPEN_ORDER:
      case QUEUE_NAME.CLOSE_ORDER:
      case QUEUE_NAME.UPDATE_ORDER:
        return this.orderQueue;
      case QUEUE_NAME.UPDATE_CANDLES:
        return this.candleQueue;
      case QUEUE_NAME.CALCULATE_INDICATOR:
        return this.indicatorQueue;
      case QUEUE_NAME.COLLECT_CANDLES:
      case QUEUE_NAME.COLLECT_INDICATORS:
      case QUEUE_NAME.COLLECT_ORDERS:
        return this.collectQueue;
      case QUEUE_NAME.ADD_SYSTEM_EVENT:
      case QUEUE_NAME.ADD_USER_EVENT:
      case QUEUE_NAME.ADD_ORDER_EVENT:
      case QUEUE_NAME.UPDATE_USER_WALLET:
        return this.eventQueue;
      case QUEUE_NAME.SEND_EMAIL:
        return this.emailQueue;
      default:
        return undefined;
    }
  }

  async cleanQueue(queueName: QUEUE_NAME): Promise<number> {
    const queue = this.getQueue(queueName);
    if (!queue?.name || !queueName?.length) {
      Logger.error(`Queue ${queue?.name} or job ${queueName} not found`);
      return 0;
    }

    const finishedJobs = await this.getActiveJobs(queueName, ['completed', 'failed']);

    await queue.clean(5000, 'completed');
    await queue.clean(5000, 'failed');

    if (finishedJobs?.length) {
      Logger.log(`********** CLEAN QUEUE: ${queueName} of ${finishedJobs?.length} jobs`);
    }

    return finishedJobs?.length;

    // const jobsToRemove = [];
    // const finishedJobs = await this.getActiveJobs(queue, ['completed', 'failed']);
    // finishedJobs.forEach((job) => {
    //   if (job.name === queueName) {
    //     // jobsToRemove.push(job.discard());
    //     jobsToRemove.push(job.remove());
    //     Logger.debug(`[CLEAN job ${job?.id} from queue ${job?.name}`);
    //   }
    // });
    //
    // await Promise.all(jobsToRemove);
    //
    // return jobsToRemove.length;
  }

  async getActiveJobs<T>(
    jobName: QUEUE_NAME,
    types: JobStatus[] = ['waiting', 'active', 'delayed', 'paused']
  ): Promise<Array<Job<T>>> {
    const queue = this.getQueue(jobName);

    if (queue) {
      return queue.getJobs(types);
    }
  }

  async addNewJob<T>(jobName: QUEUE_NAME, data?: T, options?: JobOptions): Promise<Job<T> | undefined> {
    const queue = this.getQueue(jobName);
    if (!queue?.name || !jobName?.length) {
      Logger.error(`Queue ${queue?.name} or job ${jobName} not found`);
      return undefined;
    }

    return queue.add(jobName, new Object({ ...(data || {}) }), {
      ...queueBullConfig.defaultJobOptions,
      ...(options || {}),
    });
  }

  async addNewBulkJobs<T>(jobName: QUEUE_NAME, data: T[], options?: JobOptions): Promise<Array<Job<T>>> {
    const bulkJobs: Array<{ name?: string | undefined; data: T; opts?: Omit<JobOptions, 'repeat'> | undefined }> = [];

    const queue = this.getQueue(jobName);
    if (!queue?.name || !jobName?.length) {
      Logger.error(`Queue ${queue?.name} or job ${jobName} not found`);
      return [];
    }

    for (const param of data) {
      bulkJobs.push({
        name: jobName,
        data: param,
        opts: { ...queueBullConfig.defaultJobOptions, ...(options || {}) },
      });
    }

    return bulkJobs?.length ? await queue.addBulk(bulkJobs) : [];
  }

  // ********************************************************************************************
  async getJobs_CountFetchCandles(params: GetCandlesParams): Promise<number> {
    const { exchangeId, symbol, timeframe } = params;

    const activeJobs = await this.getActiveJobs<GetCandlesParams>(QUEUE_NAME.UPDATE_CANDLES);

    let jobsCount = 0;
    activeJobs.forEach((job) => {
      if (
        job?.data &&
        job.name === QUEUE_NAME.UPDATE_CANDLES &&
        job.data.exchangeId === exchangeId &&
        job.data.symbol === symbol &&
        job.data.timeframe === timeframe
      ) {
        // Logger.debug(`[${exchangeId}] ${symbol} ${timeframe} Job ${job?.id} already in queue ${job?.name}`);
        jobsCount++;
      }
    });

    return jobsCount;
  }

  // ********************************************************************************************
  // *** CANDLES

  async addJob_FetchCandles(
    params: GetCandlesParams,
    options?: Omit<JobOptions, 'repeat'> | undefined
  ): Promise<Job<GetCandlesParams>> {
    if (
      (await this.redisExchange.isBadSymbol(params.exchangeId, params.symbol, params.timeframe)) >= BAD_SYMBOL_FRINGE
    ) {
      return undefined;
    }

    if (params.timeframe === TIMEFRAME.M30) {
      params.timeframe = TIMEFRAME.M15;
    }
    if (params.timeframe === TIMEFRAME.H2) {
      params.timeframe = TIMEFRAME.H1;
    }
    if (params.timeframe === TIMEFRAME.H4) {
      params.timeframe = TIMEFRAME.H1;
    }

    if (!(await this.getJobs_CountFetchCandles(params))) {
      return this.addNewJob<GetCandlesParams>(QUEUE_NAME.UPDATE_CANDLES, params, {
        timeout: 300000,
        ...(options || {}),
      });
    }

    return undefined;
  }

  async addJobs_FetchCandles(
    params: GetCandlesParams[],
    options?: Omit<JobOptions, 'repeat'> | undefined
  ): Promise<Array<Job<GetCandlesParams>>> {
    const newJobs = [];

    for (const param of params) {
      if (
        (await this.redisExchange.isBadSymbol(param.exchangeId, param.symbol, param.timeframe)) >= BAD_SYMBOL_FRINGE
      ) {
        continue;
      }

      if (param.timeframe === TIMEFRAME.M30) {
        param.timeframe = TIMEFRAME.M15;
      }
      if (param.timeframe === TIMEFRAME.H2) {
        param.timeframe = TIMEFRAME.H1;
      }
      if (param.timeframe === TIMEFRAME.H4) {
        param.timeframe = TIMEFRAME.H1;
      }

      if (!(await this.getJobs_CountFetchCandles(param))) {
        newJobs.push(param);
      }
    }
    const jobs = await this.addNewBulkJobs(QUEUE_NAME.UPDATE_CANDLES, newJobs, { timeout: 300000, ...(options || {}) });

    if (jobs.length) {
      const exchanges: string[] = [];
      const tf: string[] = [];

      for (const job of jobs) {
        if (exchanges.indexOf(job?.data?.exchangeId) === -1) {
          exchanges.push(job.data.exchangeId);
        }
        if (tf.indexOf(job?.data?.timeframe) === -1) {
          tf.push(job.data.timeframe);
        }
      }

      Logger.debug(`CANDLES update ${exchanges.toString()} ${tf.toString()} for ${jobs.length} symbols`);
    }

    return jobs;
  }

  async clearUpdateCandlesQueue(currentJob: Job<GetCandlesParams>): Promise<number> {
    if (!currentJob?.data) {
      return 0;
    }
    const { exchangeId, symbol, timeframe } = currentJob.data;

    const activeJobs = await this.getActiveJobs<GetCandlesParams>(QUEUE_NAME.UPDATE_CANDLES);
    const jobsToRemove = [];
    activeJobs.forEach((job) => {
      if (
        job?.data &&
        job.id !== currentJob.id &&
        job.name === QUEUE_NAME.UPDATE_CANDLES &&
        job.data.exchangeId === exchangeId &&
        job.data.symbol === symbol &&
        job.data.timeframe === timeframe &&
        Date.now() - job.timestamp > CANDLE_UPDATE_TIMEOUT
      ) {
        // jobsToRemove.push(job.discard());
        jobsToRemove.push(job.moveToCompleted('Timeout', true));
        jobsToRemove.push(job.discard());
        Logger.debug(
          `[${exchangeId}] Remove job ${job?.id} from queue ${job?.name} - ${(Date.now() - job.timestamp) / 1000}s`
        );
      }
    });

    return (await Promise.all(jobsToRemove))?.length || 0;
  }

  // ********************************************************************************************
  async getJobs_CountCalculateIndicator(params: CalculateIndicatorsParams): Promise<number> {
    const { exchangeId, symbol, timeframe } = params;

    const activeJobs = await this.getActiveJobs<CalculateIndicatorsParams>(QUEUE_NAME.CALCULATE_INDICATOR);

    let jobsCount = 0;
    activeJobs.forEach((job) => {
      if (
        job?.data &&
        job.name === QUEUE_NAME.CALCULATE_INDICATOR &&
        job.data.exchangeId === exchangeId &&
        job.data.symbol === symbol &&
        job.data.timeframe === timeframe
      ) {
        // Logger.debug(`[${exchangeId}] ${symbol} ${timeframe} Job ${job?.id} already in queue ${job?.name}`);
        jobsCount++;
      }
    });

    return jobsCount;
  }

  // ********************************************************************************************
  // INDICATOR

  async addJob_CalculateIndicator(params: CalculateIndicatorsParams): Promise<Job<CalculateIndicatorsParams>> {
    return this.addNewJob<CalculateIndicatorsParams>(QUEUE_NAME.CALCULATE_INDICATOR, params);
    // if (!(await this.getJobs_CountCalculateIndicator(params))) {
    //   return this.addNewJob<CalculateIndicatorsParams>(QUEUE_NAME.CALCULATE_INDICATOR, params);
    // }
    //
    // return undefined;
  }

  // ********************************************************************************************
  async addJob_OpenOrder(param: QueueParamsOpenOrder, opts?: JobOptions): Promise<Job<QueueParamsOpenOrder>> {
    return this.addNewJob<QueueParamsOpenOrder>(QUEUE_NAME.OPEN_ORDER, param, opts);
  }

  // ********************************************************************************************
  // ORDERS

  async addJob_CloseOrder(param: QueueParamsOpenOrder, opts?: JobOptions): Promise<Job<QueueParamsOpenOrder>> {
    return this.addNewJob<QueueParamsOpenOrder>(QUEUE_NAME.CLOSE_ORDER, param, opts);
  }

  async addJob_CancelOrder(param: QueueParamsOpenOrder, opts?: JobOptions): Promise<Job<QueueParamsOpenOrder>> {
    return this.addNewJob<QueueParamsOpenOrder>(QUEUE_NAME.CANCEL_ORDER, param, opts);
  }

  async addJobs_CloseOrderByDisabledSymbol(
    params: QueueParamsCloseOrders[],
    options?: Omit<JobOptions, 'repeat'> | undefined
  ): Promise<Array<Job<QueueParamsCloseOrders>>> {
    return this.addNewBulkJobs(QUEUE_NAME.CLOSE_ORDER, params, options);

    // const jobs = await this.addNewBulkJobs(QUEUE_NAME.CLOSE_ORDER, params, options);
    // if (jobs?.length) {
    //   Logger.warn(`************* Close orders with disabled symbols: ${jobs.length} jobs added to queue`);
    // }
    // return jobs;
  }

  // ********************************************************************************************
  async getJobs_CountCalculateIndicatorSignal(params: QueueParamsCalculateIndicatorSignal): Promise<number> {
    const activeJobs = await this.getActiveJobs<QueueParamsCalculateIndicatorSignal>(
      QUEUE_NAME.CHECK_SIGNAL_INDICATORS
    );

    let jobsCount = 0;
    activeJobs.forEach((job) => {
      if (
        job?.data &&
        job.name === QUEUE_NAME.CHECK_SIGNAL_INDICATORS &&
        job.data.exchangeId === params.exchangeId &&
        job.data.symbol === params.symbol
      ) {
        // Logger.debug(`[${params.exchangeId}] ${params.symbol} Job ${job?.id} already in queue ${job?.name}`);
        jobsCount++;
      }
    });

    return jobsCount;
  }

  // ********************************************************************************************
  // SIGNALS

  async addBulkJobs_CalculateIndicatorSignal(
    params: QueueParamsCalculateIndicatorSignal[],
    options?: Omit<JobOptions, 'repeat'> | undefined
  ): Promise<Array<Job<QueueParamsCalculateIndicatorSignal>>> {
    const newJobs = [];

    for (const param of params) {
      // not more 21 symbols per 1 second
      if (!(await this.getJobs_CountCalculateIndicatorSignal(param))) {
        newJobs.push(param);
      }
    }

    return this.addNewBulkJobs(QUEUE_NAME.CHECK_SIGNAL_INDICATORS, newJobs, { ...(options || {}), timeout: 60000 });
    // const jobs = await this.addNewBulkJobs(QUEUE_NAME.CHECK_SIGNAL_INDICATORS, newJobs, { ...(options || {}), timeout: 60000 });
    // if (jobs?.length) {
    //   Logger.log(`SIGNAL INDICATORS [${params?.[0]?.exchangeId}]: ${jobs?.length} jobs added to queue`);
    // }
    // return jobs;
  }

  async addJob_CheckOrdersSignals(param: StrategyIndicatorSignalsCUPO): Promise<Job<StrategyIndicatorSignalsCUPO>> {
    return this.addNewJob<StrategyIndicatorSignalsCUPO>(QUEUE_NAME.CHECK_SIGNAL_OPEN_ORDERS, param, { timeout: 15000 });
  }

  async clearCalculateSignalsQueue(currentJob: Job<QueueParamsCalculateIndicatorSignal>): Promise<number> {
    if (!currentJob?.data) {
      return;
    }
    const { exchangeId, symbol } = currentJob.data;

    const activeJobs = await this.getActiveJobs<QueueParamsCalculateIndicatorSignal>(
      QUEUE_NAME.CHECK_SIGNAL_INDICATORS
    );
    const jobsToRemove = [];
    activeJobs.forEach((job) => {
      if (
        job?.data &&
        job.id !== currentJob.id &&
        job.name === QUEUE_NAME.CHECK_SIGNAL_INDICATORS &&
        job.data.exchangeId === exchangeId &&
        job.data.symbol === symbol &&
        Date.now() - job.timestamp > TICKER_UPDATE_TIMEOUT
      ) {
        // jobsToRemove.push(job.discard());
        jobsToRemove.push(job.moveToCompleted('Timeout', true));
        jobsToRemove.push(job.discard());
        Logger.debug(
          `[${exchangeId}] Remove job ${job?.id} from queue ${job?.name} - ${(Date.now() - job.timestamp) / 1000}s`
        );
      }
    });

    return (await Promise.all(jobsToRemove))?.length || 0;
  }

  async addJob_CollectCandles(param: GarbageCollectCandlesParams): Promise<Job<GarbageCollectCandlesParams>> {
    return this.addNewJob<GarbageCollectCandlesParams>(QUEUE_NAME.COLLECT_CANDLES, param, { timeout: 300000 });
  }

  // ********************************************************************************************
  // COLLECTOR
  // ********************************************************************************************

  async addJob_CollectIndicators(param: GarbageCollectCandlesParams): Promise<Job<GarbageCollectCandlesParams>> {
    return this.addNewJob<GarbageCollectCandlesParams>(QUEUE_NAME.COLLECT_INDICATORS, param, { timeout: 300000 });
  }

  async getJobs_CountCollectOrders(params: GarbageCollectOrdersParams): Promise<number> {
    const activeJobs = await this.getActiveJobs<GarbageCollectOrdersParams>(QUEUE_NAME.COLLECT_ORDERS);

    let jobsCount = 0;
    activeJobs.forEach((job) => {
      if (
        job?.data &&
        job.name === QUEUE_NAME.COLLECT_ORDERS &&
        job.data.exchangeId === params.exchangeId &&
        job.data.userId === params.userId
      ) {
        jobsCount++;
      }
    });

    return jobsCount;
  }

  async addJob_CollectOrders(param: GarbageCollectOrdersParams): Promise<Job<GarbageCollectOrdersParams>> {
    if (!(await this.getJobs_CountCollectOrders(param))) {
      return this.addNewJob<GarbageCollectOrdersParams>(QUEUE_NAME.COLLECT_ORDERS, param, { timeout: 300000 });
    }
  }

  // ********************************************************************************************
  // EVENTS
  // ********************************************************************************************
  async addJob_AddOrderEvent(event: ORDER_EVENT): Promise<Job<ORDER_EVENT>> {
    return this.addNewJob<ORDER_EVENT>(QUEUE_NAME.ADD_ORDER_EVENT, { ...event, time: Date.now() }, { lifo: false });
  }

  async addJob_AddSystemEvent(event: SYSTEM_EVENT): Promise<Job<SYSTEM_EVENT>> {
    return this.addNewJob<SYSTEM_EVENT>(QUEUE_NAME.ADD_SYSTEM_EVENT, { ...event, time: Date.now() }, { lifo: false });
  }

  async addJob_AddUserEvent(event: USER_EVENT): Promise<Job<USER_EVENT>> {
    return this.addNewJob<USER_EVENT>(QUEUE_NAME.ADD_USER_EVENT, { ...event, time: Date.now() }, { lifo: false });
  }

  // ********************************************************************************************
  // USER WALLET with EVENT SERVICE
  // ********************************************************************************************
  async addJob_UpdateUserWallet(balance: QueueParamsUpdateBalances): Promise<Job<QueueParamsUpdateBalances>> {
    return this.addNewJob<QueueParamsUpdateBalances>(QUEUE_NAME.UPDATE_USER_WALLET, balance);
  }

  // ********************************************************************************************
  // SEND EMAIL
  // ********************************************************************************************
  async sendEmail(data: SendEmailNotificationType): Promise<Job<SendEmailNotificationType>> {
    return this.addNewJob<SendEmailNotificationType>(QUEUE_NAME.SEND_EMAIL, data);
  }

  async sendBulkEmails(
    emails: Array<SendEmailNotificationType>,
    options?: Omit<JobOptions, 'repeat'> | undefined
  ): Promise<Array<Job<SendEmailNotificationType>>> {
    const jobs = await this.addNewBulkJobs<SendEmailNotificationType>(QUEUE_NAME.SEND_EMAIL, emails, options);
    if (jobs?.length) {
      Logger.warn(`EMAILS: ${jobs?.length} jobs added to queue`);
    }

    return jobs;
  }
}
