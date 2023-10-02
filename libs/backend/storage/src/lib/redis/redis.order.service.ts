import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { OPERATION_TYPE, ORDER_STATUS, TradeOrder, TradeOrderIdType } from '@cupo/backend/interface';
import { ENABLED_EXCHANGES, REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { OPEN_ORDER_PAUSE } from '@cupo/backend/constant/src/lib/trader.constant';
import { RedisService } from './redis.service';

@Injectable()
export class RedisOrderService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.ORDERS);
  }

  // not used yet
  async getNewOrderId(exchangeId: string, userId: string): Promise<number> {
    const array = new Uint32Array(16);
    crypto.getRandomValues(array);

    for (const num of array) {
      const order = await this.getHashValue(this.getOrderKey(exchangeId, userId), num.toString());

      if (!order) {
        return num;
      }
    }

    return this.getNewOrderId(exchangeId, userId);
  }

  orderToRedisHashValue(order: TradeOrder): { [key: string]: string } {
    const orderObject = {
      ...order,
      created: order.created ? order.created : new Date().getTime(),
      updated: new Date().getTime(),
    };
    return { [orderObject.id]: JSON.stringify(orderObject) };
  }

  redisHashValueToOrder(order: string): TradeOrder | null {
    if (!order?.length) {
      return null;
    }

    try {
      const hash = JSON.parse(order);

      return {
        ...hash,

        // fixme: remove this after starting PROD
        userId: hash.userId || hash.user_uid,

        isVirtual: hash.isVirtual === true || hash.isVirtual === undefined,

        openTime: hash.openTime ? +hash.openTime : undefined,
        closeTime: hash.closeTime ? +hash.closeTime : undefined,
        type: hash.type ? (hash.type as OPERATION_TYPE) : undefined,
        status: hash.status ? (hash.status as ORDER_STATUS) : undefined,

        volume: +hash.volume || +hash.openVolume || 0,
        openVolume: +hash.openVolume || +hash.volume || 0,
        openPrice: +hash.openPrice || 0,
        closePrice: +hash.closePrice || 0,

        stopLoss: hash.stopLoss ? +hash.stopLoss : 0,
        takeProfit: hash.takeProfit ? +hash.takeProfit : 0,
        swap: hash.swap ? +hash.swap : 0,
        commission: hash.commission ? +hash.commission : 0,
        tax: hash.tax ? +hash.tax : 0,
        currentPrice: +hash?.currentPrice || 0,
        profit: hash.profit ? +hash.profit : 0,

        created: hash.created || new Date(hash.created).getTime(),
        updated: hash.updated || new Date(hash.updated).getTime(),
      };
    } catch (e) {
      Logger.error(`redisHashValueToOrder: ${order} ${e.message}`);
      return null;
    }
  }

  async getOrdersCount(exchangeId: string): Promise<number> {
    const orderKeys: string[] = await this.getKeys(this.getOrderPatternKey(exchangeId));

    let count = 0;

    if (orderKeys?.length) {
      for (const orderKey of orderKeys) {
        count += await this.getHashCount(orderKey, false);
      }
    }

    return count;
  }

  // get orders from Redis
  async getOrderSymbols(params: {
    userId: string;
    exchangeId: string;
    symbol?: string | undefined;
    active?: boolean | undefined; // default = undefined
    virtual?: boolean | undefined; // default = undefined
    deleted?: boolean | undefined; // default = false
  }): Promise<string[]> {
    const symbols: string[] = [];

    if (!params) {
      return symbols;
    }

    const { userId, exchangeId, symbol, active, virtual, deleted } = params;

    const orders = await this.getOrders({ exchangeId, userId, symbol, active, virtual, deleted });
    if (!orders) {
      return symbols;
    }

    orders.forEach((order) => {
      if (symbols.indexOf(order.symbol) === -1) {
        symbols.push(order.symbol);
      }
    });

    return symbols;
  }

  async getOrders(params: {
    userId: string;
    exchangeId: string;
    symbol?: string | undefined;
    active?: boolean | undefined; // default = undefined
    opened?: boolean | undefined; // default = undefined, only for active orders
    virtual?: boolean | undefined; // default = undefined
    orderIds?: string[];
    deleted?: boolean | undefined; // default = false
    sort?: 'openPrice' | 'openTime' | 'profit'; // default = 'openPrice'
    sortOrder?: 1 | -1; // default = 1
  }): Promise<TradeOrder[]> {
    const res: TradeOrder[] = [];

    const orders = await this.getHash(this.getOrderKey(params.exchangeId, params.userId));
    if (!orders) {
      return res;
    }

    for (const orderHash of Object.values(orders)) {
      const order = this.redisHashValueToOrder(orderHash);

      if (
        order &&
        (((params.deleted === undefined || params.deleted === false) && !order.isDeleted) ||
          (params.deleted === true && order.isDeleted)) &&
        (params.active === undefined ||
          (params.active === true &&
            (order.status?.toUpperCase() === ORDER_STATUS.OPENED ||
              order.status?.toUpperCase() === ORDER_STATUS.WAIT_OPEN)) ||
          (params.active === false &&
            order.status?.toUpperCase() !== ORDER_STATUS.OPENED &&
            order.status?.toUpperCase() !== ORDER_STATUS.WAIT_OPEN)) &&
        (params.opened === undefined ||
          (params.opened === true && order.status === ORDER_STATUS.OPENED) ||
          (params.opened === false && order.status === ORDER_STATUS.WAIT_OPEN)) &&
        (params.symbol === undefined || order.symbol === params.symbol) &&
        (params.virtual === undefined ||
          (params.virtual === false && order.isVirtual === false) ||
          (params.virtual === true && (order.isVirtual === true || order.isVirtual === undefined))) &&
        (!params?.orderIds?.length || params.orderIds.includes(order.id))
      ) {
        res.push(order);
      }
    }

    return res;

    // return res.sort(
    //   (a, b) => (a[params.sort || 'openPrice'] - b[params.sort || 'openPrice']) * (params.sortOrder || 1)
    // );
  }

  async getOrder(data: { exchangeId: string; userId: string; orderId: string }): Promise<TradeOrder | null> {
    const { exchangeId, userId, orderId } = data;

    const order = await this.getHashValue(this.getOrderKey(exchangeId, userId), orderId);

    return order ? this.redisHashValueToOrder(order) : null;
  }

  // cancel virtual orders before open a real order
  async cancelVirtualUserOrders(params: {
    userId: string;
    exchangeId: string;
    symbol?: string | undefined;
    comment?: string;
  }): Promise<number> {
    const { userId, exchangeId, symbol, comment } = params;

    let returnBalance = 0;

    const orders = await this.getOrders({ userId, exchangeId, symbol, virtual: true, active: true });
    if (!orders) {
      return returnBalance;
    }

    let resultOrder;
    for (const order of orders) {
      if (order && (symbol === undefined || order.symbol === symbol)) {
        if (order.status !== ORDER_STATUS.WAIT_OPEN) {
          returnBalance += (order.openVolume || order.volume) * order.openPrice;
        }

        resultOrder = {
          ...order,
          status: ORDER_STATUS.CANCELLED,
          closeTime: new Date().getTime(),
          commentClose: comment || 'cancel virtual orders',
        };

        resultOrder = await this.setOrder(resultOrder);
      }
    }

    if (returnBalance) {
      Logger.verbose(
        `Cancelled Virtual User Orders: ${exchangeId} ${userId} ${symbol}, return balance: ${returnBalance}`
      );
    }

    return returnBalance;
  }

  // cancel virtual orders before open a real order
  async deleteVirtualUserOrders(params: {
    userId: string;
    exchangeId: string;
    symbol?: string | undefined;
  }): Promise<number> {
    const { userId, exchangeId, symbol } = params;

    let changed = false;
    let returnBalance = 0;

    const orders = await this.getOrders({ userId, exchangeId, symbol, virtual: true });
    if (!orders) {
      return returnBalance;
    }

    for (const order of orders) {
      if (order.status === ORDER_STATUS.OPENED) {
        returnBalance += (order.openVolume || order.volume) * order.openPrice;
      }

      await this.deleteHash(this.getOrderKey(exchangeId, userId), order.id);

      changed = true;
    }

    if (changed) {
      Logger.verbose(
        `Deleted Virtual User Orders: ${exchangeId} ${userId} ${orders?.length}, return balance: ${returnBalance}`
      );
    }

    return returnBalance;
  }

  async deleteUserOrder(params: { userId: string; exchangeId: string; id: TradeOrderIdType }): Promise<void> {
    const { userId, exchangeId, id } = params;

    await this.deleteHash(this.getOrderKey(exchangeId, userId), id);
  }

  async cancelUserOrder(params: { userId: string; exchangeId: string; id: TradeOrderIdType }): Promise<void> {
    const { userId, exchangeId, id } = params;

    await this.deleteHash(this.getOrderKey(exchangeId, userId), id);
  }

  async deleteAllUserOrders(userId: string, exchangeId: string): Promise<void> {
    await this.deleteKey(this.getOrderKey(exchangeId, userId));
  }

  async setOrder(order: TradeOrder, openedNew = false): Promise<TradeOrder | undefined> {
    if (!order || !order.exchangeId || !order.userId) {
      Logger.error(`setOrder: invalid order: ${JSON.stringify(order || {})}`);
      return undefined;
    }

    const { exchangeId, userId } = order;

    const orderId = order.id || randomUUID();

    const newOrder: TradeOrder = { id: orderId, ...order };
    // set orderId for new order
    const hash = this.orderToRedisHashValue(newOrder);

    try {
      await this.setHash(this.getOrderKey(exchangeId, userId), hash);

      if (openedNew) {
        await this.setLastOpenOrder({ exchangeId, userId });
      }

      return newOrder;
    } catch (e) {
      Logger.error(`setOrder(): ${e.message}`);

      return undefined;
    }
  }

  async startPendingOrder(exchangeId: string, symbol: string, userId: string, orderId: string): Promise<void> {
    // Logger.warn(`PENDING orders: ${exchangeId} ${symbol} ${userId}`);
    if (!exchangeId || !symbol || !userId) {
      Logger.error(`PENDING orders: [${exchangeId}] ${symbol}, ${userId}`);
      return;
    }

    // Logger.log(`START PENDING orders: [${exchangeId}] ${symbol}, ${userId}, ${orderId}`);

    // 30 seconds of expiration the pending order
    await this.setKey(`opening:${exchangeId}:${userId}_${symbol}`, orderId, 30);
  }

  async releasePendingSymbolForOpenOrders(exchangeId: string, symbol: string, userId: string): Promise<void> {
    // Logger.log(`ALLOW open orders: ${exchangeId} ${symbol} ${userId}`);
    if (!exchangeId || !symbol || !userId) {
      Logger.error(`finishWaitPendingOrder: [${exchangeId}] ${symbol}, ${userId}`);
      return;
    }

    // Logger.log(`ALLOW open orders: [${exchangeId}] ${symbol}, ${userId}`);

    // await this.deleteHash(`opening:${exchangeId}`, `${userId}_${symbol}`);
    await this.deleteKey(`opening:${exchangeId}:${userId}_${symbol}`);
  }

  async isSymbolPendingOpen(exchangeId: string, symbol: string, userId: string): Promise<string | null> {
    if (!exchangeId || !symbol || !userId) {
      Logger.error(`isOrderPending error: [${exchangeId}] ${symbol}, ${userId}`);
      return null;
    }

    // const result = await this.getHashValue(`opening:${exchangeId}`, `${userId}_${symbol}`);
    const result = await this.getKey(`opening:${exchangeId}:${userId}_${symbol}`);

    return result?.length ? result : null;
  }

  async cancelOpenOrdersSemaphore(): Promise<number> {
    let deleted = 0;

    for (const exchangeId of Object.keys(ENABLED_EXCHANGES)) {
      const ordersHash = this.getHash(`opening:${exchangeId}`);

      for (const key of Object.keys(ordersHash)) {
        // wait 15 seconds, then delete semaphore
        await this.deleteHash(`opening:${exchangeId}`, key);

        Logger.warn(`FLUSH open pending orders: [${exchangeId}] ${key}`);

        deleted++;
      }
    }

    return deleted;
  }

  async cancelPendingOrders(exchangeId: string, userId: string, orderId?: string): Promise<string[]> {
    const orders = await this.getOrders({ userId, exchangeId, active: true });
    const cancelled = [];

    for (const order of orders) {
      if (
        (orderId === undefined || order.id === orderId) &&
        order?.status?.toUpperCase() === ORDER_STATUS.WAIT_OPEN &&
        (order.openTime || 0) < Date.now() - 60 * 1000
      ) {
        order.status = ORDER_STATUS.CANCELLED;
        order.closePrice = order.openPrice;
        order.profit = 0;
        order.closeTime = new Date().getTime();

        const resultOrder = await this.setOrder(order);

        if (resultOrder) {
          cancelled.push(`${order.symbol} ${order.id}`);
        }
      }
    }

    return cancelled;
  }

  // ***********************
  // *** LAST OPEN ORDER ***
  // ***********************
  async setLastOpenOrder({ exchangeId, userId }): Promise<void> {
    if (!exchangeId?.length || !userId?.length) {
      Logger.error(`getLastOrderOpen error: [${exchangeId}] ${userId}`);
      return;
    }

    await this.setKey(`lastOpenOrder:${exchangeId}:${userId}`, Date.now(), OPEN_ORDER_PAUSE / 1000);
  }

  async getLastOpenedOrder({ exchangeId, userId }): Promise<number> {
    if (!exchangeId?.length || !userId?.length) {
      Logger.error(`getLastOrderOpen error: [${exchangeId}] ${userId}`);
      return 0;
    }

    // const result = await this.getHashValue(`opening:${exchangeId}`, `${userId}_${symbol}`);
    const result = await this.getKey(`lastOpenOrder:${exchangeId}:${userId}`);

    return result ? +result : 0;
  }

  // *********************************
  // *** SYMBOL TRAILING STOP LOSS ***
  // *********************************
  async setSymbolStopLoss(params: { exchangeId: string; userId: string; symbol: string }, sl): Promise<number> {
    const { exchangeId, userId, symbol } = params;

    const storedSL: number = await this.getSymbolStopLoss(params);

    const newSL = Math.max(storedSL, sl);

    await this.setHash(this.getSymbolKey(exchangeId, symbol, REDIS_ENTITY_TYPE.ORDER_SYMBOL_SL), {
      [userId]: newSL.toString(),
    });

    return newSL;
  }

  async deleteSymbolStopLoss(params: { exchangeId: string; userId: string; symbol: string }): Promise<void> {
    const { exchangeId, userId, symbol } = params;

    await this.deleteHashValue(this.getSymbolKey(exchangeId, symbol, REDIS_ENTITY_TYPE.ORDER_SYMBOL_SL), userId);
  }

  async getSymbolStopLoss(params: { exchangeId: string; userId: string; symbol: string }): Promise<number> {
    const { exchangeId, userId, symbol } = params;

    return (
      +(await this.getHashValue(this.getSymbolKey(exchangeId, symbol, REDIS_ENTITY_TYPE.ORDER_SYMBOL_SL), userId)) || 0
    );
  }

  // **************************
  // *** MAIN ORDER MANAGER ***
  // **************************

  async resetMainOrderManager(): Promise<void> {
    await this.deleteKey(REDIS_ENTITY_TYPE.ORDER_MANAGER);
  }

  async isMainOrderManager(id: string): Promise<boolean> {
    const mainManager = await this.getKey(REDIS_ENTITY_TYPE.ORDER_MANAGER);

    if (!mainManager?.length) {
      return false;
    }

    const manager = JSON.parse(mainManager);

    if (manager.timestamp && manager.timestamp < Date.now() - 1000 * 60) {
      return false;
    }

    return manager.id === id;
  }

  async setMainOrderManager(id: string): Promise<boolean> {
    const mainManager = await this.getKey(REDIS_ENTITY_TYPE.ORDER_MANAGER);

    if (!mainManager?.length) {
      await this.setKey(REDIS_ENTITY_TYPE.ORDER_MANAGER, JSON.stringify({ id, timestamp: Date.now() }));

      Logger.log(`MAIN ORDER MANAGER: ${id}`);

      return true;
    } else {
      const manager = JSON.parse(mainManager);

      // reset old main feeder
      if (manager.timestamp && manager.timestamp < Date.now() - 1000 * 60) {
        await this.resetMainOrderManager();

        return false;
      }

      if (manager.id === id) {
        await this.setKey(REDIS_ENTITY_TYPE.ORDER_MANAGER, JSON.stringify({ id, timestamp: Date.now() }));
      }

      return manager.id === id;
    }
  }
}
