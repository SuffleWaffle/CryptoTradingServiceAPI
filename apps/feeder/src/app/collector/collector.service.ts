import { Injectable, Logger } from '@nestjs/common';
import {
  GarbageCollectCandlesParams,
  GarbageCollectOrdersParams,
  getCandleTimeByShift,
  TIMEFRAME,
} from '@cupo/timeseries';
import {
  OrdersMongodbService,
  PlatformMongodbService,
  RedisCandleService,
  RedisExchangeService,
  RedisIndicatorsService,
  RedisOrderService,
  RedisUserService,
  UserMongodbService,
} from '@cupo/backend/storage';
import { CANDLE_LIMIT_VALUES, INDICATOR_LIMIT_VALUES } from '@cupo/backend/constant/src/lib/feeder.constant';
import { QueueService } from '@cupo/backend/queue';
import { Cron } from '@nestjs/schedule';
import { ENABLED_EXCHANGES } from '@cupo/backend/constant';
import { EVENT_TYPE, ORDER_STATUS, QUEUE_NAME } from '@cupo/backend/interface';
import { EventService } from '@cupo/event';
import { ExchangeLibService } from '@cupo/exchange';

@Injectable()
export class CollectorService {
  constructor(
    private readonly queueService: QueueService,
    private readonly event: EventService,
    private readonly exchange: ExchangeLibService,
    private readonly redisExchange: RedisExchangeService,
    private readonly redisCandles: RedisCandleService,
    private readonly redisIdx: RedisIndicatorsService,
    private readonly redisUser: RedisUserService,
    private readonly redisOrder: RedisOrderService,
    private readonly mongoOrder: OrdersMongodbService,
    private readonly mongoUser: UserMongodbService,
    private readonly mongoPlatform: PlatformMongodbService
  ) {
    setTimeout(async () => {
      await this.removeFinishedJobsFromQueue();
      await this.deleteDisabledSymbolsCandles();
    }, 1000);
  }

  async collectIndicators(params: GarbageCollectCandlesParams): Promise<void> {
    const { exchangeId, symbol, timeframe, limit } = params;

    const symbols = await this.redisExchange.getSymbols(exchangeId, false);

    let timestamp = getCandleTimeByShift(timeframe, limit || Math.max(CANDLE_LIMIT_VALUES, INDICATOR_LIMIT_VALUES) + 1);

    // todo: seek the delisted symbols through the Redis candles keys
    if (symbols?.length > 0 && !symbols.includes(symbol)) {
      timestamp = Date.now();
    }

    const keys = await this.redisIdx.getOldIndicators(exchangeId, symbol, timeframe, timestamp);

    if (keys?.length > 16) {
      const idxs = [];

      for (const key of keys) {
        const idx = await this.redisIdx.getIndicatorsValue(exchangeId, symbol, timeframe, +key);
        if (idx) {
          idxs.push(idx);
        }
      }

      // for (const key of keys) {
      //   const idx = await this.redisIdx.getIndicatorsValue(exchangeId, symbol, timeframe, +key);
      //   if (idx) {
      //     await this.mongo.upsertOne(CollectionNames.Indicators, { exchangeId, symbol, timeframe, timestamp: +key }, idx);
      //   }
      // }

      const answer = await this.mongoPlatform.collectIndicators({ exchangeId, symbol, timeframe, indexes: idxs });

      await this.redisIdx.deleteIndicators(exchangeId, symbol, timeframe, keys);
      Logger.debug(
        `DELETED INDICATORS [${exchangeId}] ${symbol} ${timeframe}: ${keys.length}. Upserted: ${answer?.result?.nUpserted}, modified: ${answer?.result?.nModified}`
      );
    }
  }

  async collectCandles(params: GarbageCollectCandlesParams): Promise<void> {
    const { exchangeId, symbol, timeframe, limit } = params;

    const symbols = await this.redisExchange.getSymbols(exchangeId, false);

    let timestamp = getCandleTimeByShift(timeframe, limit || CANDLE_LIMIT_VALUES + 1);

    // todo: seek the delisted symbols through the Redis candles keys
    if (symbols?.length > 0 && !symbols.includes(symbol)) {
      timestamp = Date.now();
    }

    const keys = await this.redisCandles.getOldCandles(exchangeId, symbol, timeframe, timestamp);

    // await this.mongo.insertOne();

    // todo: Implement store old candles in mongodb

    if (keys?.length > 16) {
      const candles = [];

      for (const key of keys) {
        const candle = await this.redisCandles.getCandle(exchangeId, symbol, timeframe, +key);
        if (candle) {
          candles.push(candle);
        }
      }

      // for (const key of keys) {
      //   const candle = await this.redisCandles.getCandle(exchangeId, symbol, timeframe, +key);
      //   if (candle) {
      //     await this.mongo.upsertOne(CollectionNames.Candles, { exchangeId, symbol, timeframe, timestamp: +key }, candle);
      //   }
      // }

      const answer = await this.mongoPlatform.collectCandles({ exchangeId, symbol, timeframe, candles });

      await this.redisCandles.deleteCandles(exchangeId, symbol, timeframe, keys);
      Logger.debug(
        `DELETED CANDLES [${exchangeId}] ${symbol} ${timeframe}: ${keys.length}. Upserted: ${answer?.result?.nUpserted}, modified: ${answer?.result?.nModified}`
      );

      await this.queueService.addJob_CollectIndicators({ exchangeId, symbol, timeframe, limit });
    }
  }

  // todo: remove failed jobs by CRON
  @Cron('0 */5 * * * *')
  async removeFinishedJobsFromQueue(): Promise<void> {
    const jobs = [];

    jobs.push(this.queueService.cleanQueue(QUEUE_NAME.CHECK_SIGNAL_INDICATORS));
    jobs.push(this.queueService.cleanQueue(QUEUE_NAME.CHECK_SIGNAL_OPEN_ORDERS));

    jobs.push(this.queueService.cleanQueue(QUEUE_NAME.OPEN_ORDER));
    jobs.push(this.queueService.cleanQueue(QUEUE_NAME.CANCEL_ORDER));
    jobs.push(this.queueService.cleanQueue(QUEUE_NAME.CLOSE_ORDER));

    jobs.push(this.queueService.cleanQueue(QUEUE_NAME.UPDATE_CANDLES));

    jobs.push(this.queueService.cleanQueue(QUEUE_NAME.CALCULATE_INDICATOR));

    await Promise.all(jobs);
  }

  @Cron('1 1 */1 * * *')
  async deleteDisabledSymbolsCandles(): Promise<void> {
    const jobs = [];

    Object.keys(ENABLED_EXCHANGES).forEach((exchangeId) => {
      jobs.push(
        Promise.all([exchangeId, this.redisExchange.getMarkets(exchangeId), this.redisExchange.getSymbols(exchangeId)])
      );
    });

    const res = await Promise.all(jobs);

    jobs.length = 0;
    for (const [exchangeId, markets, symbols] of res) {
      if (!markets || !symbols?.length) {
        continue;
      }

      const marketSymbols = Object.keys(markets);

      const timeframes = Object.values(TIMEFRAME);

      for (const symbol of marketSymbols) {
        if (!symbols.includes(symbol)) {
          for (const timeframe of timeframes) {
            jobs.push(this.redisCandles.deleteAllCandles(exchangeId, symbol, timeframe));
            jobs.push(this.redisIdx.deleteAllIndicators(exchangeId, symbol, timeframe));
          }
        }
      }
    }

    await Promise.all(jobs);
    Logger.warn(`Try to clean candles and indicators: ${jobs.length}`);
  }

  async collectOrders(params: GarbageCollectOrdersParams): Promise<void> {
    const { exchangeId, userId } = params;

    const orders = await this.redisOrder.getOrders({
      exchangeId,
      userId,
    });

    if (!orders?.length) {
      return;
    }

    for (const order of orders) {
      // fixme: deprecated property
      if (order['events']) {
        if (order['events'].length > 0) {
          for (const event of order['events']) {
            await this.event.addOrderEvent(order, {
              type: EVENT_TYPE.ORDER_INFO,
              ...event,
            });
          }
        }
        delete order['events'];
        await this.redisOrder.setOrder(order);

        await this.event.addSystemEvent({
          type: EVENT_TYPE.ORDER_UPDATED,
          entityId: order.id,
          event: 'Order updated',
        });
      }
    }

    await this.mongoOrder.collectOrders(orders);

    let count = 0;
    for (const order of orders) {
      if (order.status === ORDER_STATUS.CLOSED || order.status === ORDER_STATUS.CANCELLED) {
        await this.redisOrder.deleteUserOrder({ userId, exchangeId, id: order.id });
        count++;
      }
    }

    if (count) {
      Logger.debug(`- COLLECTED ORDERS [${exchangeId}] ${userId}: ${count}`);
    }
  }

  @Cron('0 */1 * * * *')
  async collectUsers(): Promise<void> {
    const users = await this.redisUser.getUsers();

    await this.mongoUser.collectUsers(users);

    Logger.debug(`--- COLLECTED USERS: ${users.length}`);
  }
}
