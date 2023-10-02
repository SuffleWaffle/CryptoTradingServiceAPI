import { Injectable, Logger } from '@nestjs/common';
import { Market } from 'ccxt';
import {
  RedisCandleService,
  RedisExchangeService,
  RedisIndicatorsService,
  RedisOrderService,
  RedisTickerService,
  RedisUserService,
} from '@cupo/backend/storage';
import { TimeSeriesService } from '@cupo/timeseries';
import { ExchangeLibService } from '@cupo/exchange';
import { Cron } from '@nestjs/schedule';
import { QueueService } from '@cupo/backend/queue';
import {
  EVENT_TYPE,
  ExchangePrice,
  OPERATION_TYPE,
  ORDER_STATUS,
  QueueParamsCloseOrders,
  QueueParamsOpenOrder,
  QueueParamsUpdateOrders,
  TADE_SIGNAL,
  TradeOrder,
  TradeOrderIdType,
} from '@cupo/backend/interface';
import {
  CUPO_STRATEGY_PARAMS,
  ENABLED_EXCHANGES,
  getEnabledExchangeIds,
  getIPAddress,
  OPEN_ORDER_PAUSE,
  userIdRepresentation,
  userRepresentation,
} from '@cupo/backend/constant';
import { EventService } from '@cupo/event';

@Injectable()
export class OrdersService {
  private managerId = getIPAddress();

  constructor(
    private readonly queueService: QueueService,
    private readonly event: EventService,
    private readonly ts: TimeSeriesService,
    private readonly exchange: ExchangeLibService,
    private readonly redisCandle: RedisCandleService,
    private readonly redisIndicator: RedisIndicatorsService,
    private readonly redisExchange: RedisExchangeService,
    private readonly redisTicker: RedisTickerService,
    private readonly redisOrder: RedisOrderService,
    private readonly redisUser: RedisUserService
  ) {}

  async openBuyOrder(order: TradeOrder): Promise<TradeOrderIdType | { message: string }> {
    if (process.env.TRADE_ALLOWED === '0' || process.env.TRADE_ALLOWED?.toLowerCase() === 'false') {
      return { message: `TRADE NOT ALLOWED` };
    }

    if (process.env.TRADE_OPEN_NEW_ALLOWED === '0' || process.env.TRADE_OPEN_NEW_ALLOWED?.toLowerCase() === 'false') {
      return { message: `OPEN NEW ORDERS NOT ALLOWED` };
    }

    const { exchangeId, symbol, userId, id } = order;

    const lastOpenedOrder = await this.redisOrder.getLastOpenedOrder({ exchangeId, userId });
    if (lastOpenedOrder > Date.now() - OPEN_ORDER_PAUSE) {
      return { message: `OPEN NEW ORDERS PAUSED TILL ${new Date(lastOpenedOrder + OPEN_ORDER_PAUSE)}` };
    }

    if (!(await this.exchange.checkOrderParameters(order))) {
      return { message: `Order parameters are not valid for [${exchangeId}] ${userId} ${symbol}` };
    }

    const pendingOrderId = await this.redisOrder.isSymbolPendingOpen(exchangeId, symbol, userId);
    if (pendingOrderId && pendingOrderId !== id) {
      if (id) {
        await this.redisOrder.cancelPendingOrders(exchangeId, userId, id);
      }

      return { message: `Waiting for PENDING order: [${exchangeId}] ${symbol}, ${userId}, ${pendingOrderId} = ${id}` };
    }

    const price = await this.redisTicker.getMarketPrice(exchangeId, symbol);
    if (!price || !price.bid || !price.ask || !price.datetime) {
      return { message: `Price is not ready for ${exchangeId} ${symbol}` };
    }
    // if (price.bid > 0 && (price.bid < 0.0001 || price.ask > 100000)) {
    //   await this.redisExchange.setBadSymbol(exchangeId, symbol, CUPO_STRATEGY_PARAMS.timeframe);
    //   return { message: `Price is not valid for ${exchangeId} ${symbol}: ${price.ask}/${price.bid}` };
    // }

    const base = ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol);
    const quote = ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, symbol);

    let newOrder: TradeOrder = {
      ...order,
      type: OPERATION_TYPE.BUY,
      status: ORDER_STATUS.OPENED,
      openTime: new Date().getTime(),
      openPrice: price.bid,
      openVolume: order.volume,
      openCost: order.volume * price.bid,
      stopLoss: order.stopLoss || 0,
      takeProfit: order.takeProfit || 0,
      swap: order.swap || 0,
      commission: order.commission || 0,
      tax: order.tax || 0,

      client: getIPAddress(),
    };

    if (newOrder.isVirtual !== false) {
      newOrder.commission =
        newOrder.openPrice *
        (newOrder.openVolume || newOrder.volume) *
        (ENABLED_EXCHANGES[newOrder.exchangeId]?.takerFee || 0.001);

      newOrder = await this.redisOrder.setOrder(newOrder);
      await this.event.addOrderEvent(newOrder, {
        type: EVENT_TYPE.ORDER_OPENED,
        data: { virtual: true },
      });

      // unblock semaphore
      await this.redisOrder.releasePendingSymbolForOpenOrders(newOrder?.exchangeId, newOrder?.symbol, newOrder?.userId);

      const sum = newOrder.openPrice * newOrder.openVolume + newOrder.commission;
      if (sum > 0) {
        await this.redisUser.decreaseVirtualBalance({ userId, exchangeId, sum });
      }

      return newOrder.id;
    }

    // *** REAL ORDER ***
    if (process.env.TRADE_REAL_ALLOWED === '0' || process.env.TRADE_REAL_ALLOWED?.toLowerCase() === 'false') {
      return { message: `REAL TRADE NOT ALLOWED` };
    }

    try {
      let balances = await this.exchange.getWalletBalances({
        userId: newOrder.userId,
        exchangeId: newOrder.exchangeId,
      });
      if (!balances) {
        Logger.error(`Wallet balances are not ready for ${newOrder.userId} ${newOrder.exchangeId}`, 'openBuyOrder');
        return { message: `Balances are not ready for ${newOrder.exchangeId} ${newOrder.userId}` };
      }

      // const freeBalance = balances?.[this.exchange.getBaseCurrencyFromSymbol(newOrder.exchangeId, newOrder.symbol)]?.free || 0;
      const balanceBaseBefore = balances?.[base]?.free || 0;
      const balanceQuoteBefore = balances?.[quote]?.free || 0;
      if (balanceBaseBefore < CUPO_STRATEGY_PARAMS.minimumLotSum * 1.01) {
        return {
          message: `NOT ENOUGH BALANCE for open new order [${newOrder.exchangeId}] [${newOrder.userId}] ${
            newOrder.symbol
          }. Balance: ${balanceBaseBefore} Minimum: ${CUPO_STRATEGY_PARAMS.minimumLotSum * 1.01}`,
        };
      }

      const exchangeOrder = await this.exchange.openBuy(newOrder);

      if (!exchangeOrder) {
        await this.event.addOrderEvent(newOrder, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Error open real buy order: empty exchange response`,
          data: { order: newOrder },
        });

        // unblock semaphore
        await this.redisOrder.releasePendingSymbolForOpenOrders(
          newOrder?.exchangeId,
          newOrder?.symbol,
          newOrder?.userId
        );

        return {
          message: `Error while open real buy order: ${JSON.stringify(newOrder)} ... ${JSON.stringify(
            exchangeOrder || {}
          )}`,
        };
      }

      newOrder.openTime = new Date(exchangeOrder?.datetime || newOrder.openTime || Date.now()).getTime();
      newOrder.openPrice = exchangeOrder?.price || newOrder.openPrice;
      newOrder.volume = exchangeOrder?.filled || exchangeOrder?.amount || newOrder.volume;
      newOrder.commission = exchangeOrder?.fee?.cost || 0;

      newOrder = await this.redisOrder.setOrder(newOrder, true);
      await this.event.addOrderEvent(newOrder, {
        type: EVENT_TYPE.ORDER_OPENED_EXCHANGE,
        data: exchangeOrder,
      });

      const newBaseBalance = await this.redisUser.decreaseWalletBalance({
        exchangeId,
        userId,
        currency: base,
        sum: newOrder.openCost,
      });
      Logger.debug(
        `BALANCE decrease [${exchangeId}] ${userIdRepresentation(userId)} ${base} for ${
          newOrder.openCost
        }, new balance: ${newBaseBalance ?? 'N/A'}`
      );

      balances = await this.exchange.getWalletBalances({
        userId: newOrder.userId,
        exchangeId: newOrder.exchangeId,
      });
      if (!balances) {
        Logger.error(`BALANCE ERROR: ${userIdRepresentation(newOrder.userId)} ${newOrder.exchangeId}`, 'OpenBuyOrder');
      }

      // const freeBalance = balances?.[this.exchange.getBaseCurrencyFromSymbol(newOrder.exchangeId, newOrder.symbol)]?.free || 0;
      const balanceQuoteAfter = balances?.[quote]?.free || 0;

      if (
        balances &&
        balanceQuoteAfter > balanceQuoteBefore &&
        balanceQuoteAfter - balanceQuoteBefore !== newOrder.volume
      ) {
        const data = {
          balanceQuoteBefore,
          balanceQuoteAfter,
          fee: newOrder.volume - (balanceQuoteAfter - balanceQuoteBefore),
          volume: newOrder.volume,
          currency: quote,
        };
        newOrder.commission = (newOrder.commission || 0) + (balanceQuoteAfter - balanceQuoteBefore);
        newOrder.volume = balanceQuoteAfter - balanceQuoteBefore;

        newOrder = await this.redisOrder.setOrder(newOrder, true);
        await this.event.addOrderEvent(newOrder, {
          type: EVENT_TYPE.ORDER_UPDATED,
          event: 'Exchange fee decreased the order volume',
          data,
        });
      } else if (!balanceQuoteAfter) {
        newOrder.commission = (newOrder.commission || 0) + newOrder.volume * 0.002 * order.openPrice;
        newOrder.volume = newOrder.volume * 0.998;

        newOrder = await this.redisOrder.setOrder(newOrder, true);
        await this.event.addOrderEvent(newOrder, {
          type: EVENT_TYPE.ORDER_UPDATED,
          event: 'Exchange fee decreased the order volume (0.2%) due the balance is unknown',
          data: { balanceQuoteBefore, fee: newOrder.volume * 0.002, volume: newOrder.volume, currency: quote },
        });
      }

      await this.event.addOrderEvent(newOrder, {
        type: EVENT_TYPE.ORDER_OPENED,
        data: { exchangeOrder, newOrder },
      });

      Logger.verbose(`OPENED real buy order: ${JSON.stringify(newOrder)}`);

      const returnBalance: number = await this.redisOrder.cancelVirtualUserOrders({
        exchangeId: newOrder.exchangeId,
        userId: newOrder.userId,
        symbol: newOrder.symbol,
      });
      if (returnBalance) {
        await this.redisUser.increaseVirtualBalance({ userId, exchangeId, sum: returnBalance });
      }

      // unblock semaphore
      await this.redisOrder.releasePendingSymbolForOpenOrders(newOrder?.exchangeId, newOrder?.symbol, newOrder?.userId);

      return newOrder.id;
    } catch (err) {
      // unblock semaphore
      await this.redisOrder.releasePendingSymbolForOpenOrders(newOrder?.exchangeId, newOrder?.symbol, newOrder?.userId);

      await this.event.addOrderEvent(newOrder, {
        type: EVENT_TYPE.ORDER_ERROR,
        event: `Error while open real buy order`,
        data: { error: err.message, order: newOrder },
      });

      return { message: `Error OPEN order on exchange: ${err.message}` };
    }
  }

  async openSellOrder(order: TradeOrder): Promise<TradeOrderIdType | { message: string }> {
    if (process.env.TRADE_ALLOWED === '0' || process.env.TRADE_ALLOWED?.toLowerCase() === 'false') {
      return { message: `TRADE NOT ALLOWED` };
    }

    if (process.env.TRADE_OPEN_NEW_ALLOWED === '0' || process.env.TRADE_OPEN_NEW_ALLOWED?.toLowerCase() === 'false') {
      return { message: `OPEN NEW ORDERS NOT ALLOWED` };
    }

    const { exchangeId, symbol, userId, id } = order;

    const lastOpenedOrder = await this.redisOrder.getLastOpenedOrder({ exchangeId, userId });
    if (lastOpenedOrder > Date.now() - OPEN_ORDER_PAUSE) {
      return { message: `OPEN NEW ORDERS PAUSED TILL ${new Date(lastOpenedOrder + OPEN_ORDER_PAUSE)}` };
    }

    if (!(await this.exchange.checkOrderParameters(order))) {
      return { message: `Order parameters are not valid for [${exchangeId}] ${userId} ${symbol}` };
    }

    const pendingOrderId = await this.redisOrder.isSymbolPendingOpen(exchangeId, symbol, userId);
    if (pendingOrderId && pendingOrderId !== id) {
      if (id) {
        await this.redisOrder.cancelPendingOrders(exchangeId, userId, id);
      }

      return { message: `Waiting for PENDING order: [${exchangeId}] ${symbol}, ${userId}, ${pendingOrderId} = ${id}` };
    }

    const price = await this.redisTicker.getMarketPrice(exchangeId, symbol);
    if (!price || !price.bid || !price.ask || !price.datetime) {
      return { message: `Price is not ready for ${exchangeId} ${symbol}` };
    }

    // if (price.bid > 0 && (price.bid < 0.0001 || price.ask > 100000)) {
    //   await this.redisExchange.setBadSymbol(exchangeId, symbol, CUPO_STRATEGY_PARAMS.timeframe);
    //   return { message: `Price is not valid for ${exchangeId} ${symbol}: ${price.ask}/${price.bid}` };
    // }

    let newOrder: TradeOrder = {
      ...order,
      // user_uid: order.user_uid,
      // exchangeId: order.exchangeId,
      // symbol: order.symbol,

      type: OPERATION_TYPE.SELL,
      status: ORDER_STATUS.OPENED,
      openTime: new Date().getTime(),
      openPrice: price.ask,
      openVolume: order.volume,
      openCost: order.volume * price.ask,
      stopLoss: order.stopLoss || 0,
      takeProfit: order.takeProfit || 0,
      swap: order.swap || 0,
      commission: order.commission || 0,
      tax: order.tax || 0,

      // description: `Test SELL ${order.symbol}`,
      // comment: 'Test comment',

      client: getIPAddress(),
    };

    if (newOrder.isVirtual !== false) {
      newOrder.commission =
        newOrder.openPrice *
        (newOrder.openVolume || newOrder.volume) *
        (ENABLED_EXCHANGES[exchangeId]?.takerFee || 0.001);

      newOrder = await this.redisOrder.setOrder(newOrder, true);

      const sum = newOrder.openPrice * newOrder.openVolume + newOrder.commission;

      await this.redisUser.decreaseVirtualBalance({ userId, exchangeId, sum });

      // unblock semaphore
      await this.redisOrder.releasePendingSymbolForOpenOrders(newOrder.exchangeId, newOrder.symbol, newOrder.userId);

      return newOrder.id;
    }

    // *** REAL ORDER ***
    if (process.env.TRADE_REAL_ALLOWED === '0' || process.env.TRADE_REAL_ALLOWED?.toLowerCase() === 'false') {
      return { message: `REAL TRADE NOT ALLOWED` };
    }

    try {
      const balances = await this.exchange.getWalletBalances({
        userId: newOrder.userId,
        exchangeId: newOrder.exchangeId,
      });
      if (!balances) {
        Logger.error('Cannot get balances for user: ' + newOrder.userId, 'openSellOrder');
        return { message: `Can't get balances for [${newOrder.exchangeId}] ${newOrder.userId}` };
      }

      const freeBalance =
        balances?.[ExchangeLibService.getBaseCurrencyFromSymbol(newOrder.exchangeId, newOrder.symbol)]?.free || 0;
      if (freeBalance < CUPO_STRATEGY_PARAMS.minimumLotSum * 1.01) {
        return {
          message: `NOT ENOUGH BALANCE for open new order [${newOrder.exchangeId}] [${newOrder.userId}] ${newOrder.symbol}: ${freeBalance}`,
        };
      }

      const exchangeOrder = await this.exchange.openSell(newOrder);

      // if (
      //   exchangeOrder &&
      //   exchangeOrder.datetime &&
      //   exchangeOrder.price &&
      //   exchangeOrder.status === 'closed' &&
      //   (exchangeOrder.filled > 0 || exchangeOrder.amount > 0)
      // ) {
      // 2. if (exchangeOrder && exchangeOrder.datetime && exchangeOrder.price && (exchangeOrder.filled > 0 || exchangeOrder.amount > 0)) {
      if (exchangeOrder) {
        newOrder.openTime = new Date(exchangeOrder?.datetime || Date.now()).getTime();
        newOrder.openPrice = exchangeOrder?.price || newOrder.openPrice;
        newOrder.volume = exchangeOrder?.filled || exchangeOrder?.amount || newOrder.volume;
        newOrder.commission = exchangeOrder?.fee?.cost || 0;

        await this.event.addOrderEvent(newOrder, {
          type: EVENT_TYPE.ORDER_OPENED_EXCHANGE,
          data: exchangeOrder,
        });

        if (
          exchangeOrder?.fee?.currency ===
            ExchangeLibService.getBaseCurrencyFromSymbol(newOrder.exchangeId, newOrder.symbol) &&
          exchangeOrder?.fee?.cost > 0
        ) {
          await this.event.addOrderEvent(newOrder, {
            type: EVENT_TYPE.ORDER_UPDATED,
            event: 'Exchange fee decreased the order volume',
            data: { fee: exchangeOrder.fee.cost, volume: newOrder.volume, currency: exchangeOrder?.fee?.currency },
          });

          newOrder.volume = newOrder.volume - exchangeOrder.fee.cost;
        }

        newOrder.status = ORDER_STATUS.OPENED;

        await this.event.addOrderEvent(newOrder, {
          type: EVENT_TYPE.ORDER_OPENED,
          event: `OPENED real sell order`,
          data: { exchangeOrder, order: newOrder },
        });

        Logger.verbose(`OPENED real sell order: ${JSON.stringify(newOrder)}`);

        const returnBalance = await this.redisOrder.cancelVirtualUserOrders({
          exchangeId: newOrder.exchangeId,
          userId: newOrder.userId,
          symbol: newOrder.symbol,
        });
        if (returnBalance) {
          await this.redisUser.increaseVirtualBalance({ userId, exchangeId, sum: returnBalance });
        }

        newOrder = await this.redisOrder.setOrder(newOrder, true);

        // unblock semaphore
        await this.redisOrder.releasePendingSymbolForOpenOrders(newOrder.exchangeId, newOrder.symbol, newOrder.userId);

        return newOrder.id;
      } else {
        // unblock semaphore
        await this.redisOrder.releasePendingSymbolForOpenOrders(newOrder.exchangeId, newOrder.symbol, newOrder.userId);

        await this.event.addOrderEvent(newOrder, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Error open real sell order: empty exchange response`,
          data: { order: newOrder },
        });

        return {
          message: `Error while open real  sell order: ${JSON.stringify(newOrder)} ... ${
            JSON.stringify(exchangeOrder) || {}
          }`,
        };
      }
    } catch (err) {
      // unblock semaphore
      await this.redisOrder.releasePendingSymbolForOpenOrders(newOrder.exchangeId, newOrder.symbol, newOrder.userId);

      await this.event.addOrderEvent(newOrder, {
        type: EVENT_TYPE.ORDER_ERROR,
        event: `Error open real sell order`,
        data: { cause: err.message, order: newOrder },
      });

      return { message: `Error OPEN real sell order on exchange: ${err.message}` };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateOrder(order): Promise<TradeOrderIdType | null> {
    return order;
  }

  async updateOrders(params: QueueParamsUpdateOrders): Promise<Array<TradeOrderIdType>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { orders } = params;

    const res = [];

    if (Array.isArray(orders)) {
      orders.forEach((order) => {
        res.push(this.updateOrder(order));
      });
    }

    await Promise.all(res);

    return res.filter((order) => order !== null);
  }

  async closeAllVirtualOrders(params: QueueParamsCloseOrders): Promise<TradeOrderIdType[] | { message: string }> {
    const { exchangeId, symbol, userId, comment } = params;

    const price = await this.getMarketPrice(exchangeId, symbol);
    if (!price || !price.ask || !price.bid || !price.timestamp) {
      return { message: 'Price not found' };
    }

    const market = await this.redisExchange.getMarket(exchangeId, symbol);
    if (!market) {
      return { message: `Market ${symbol} not found` };
    }

    const res = [];

    const ordersToClose: TradeOrder[] = await this.redisOrder.getOrders({
      userId,
      exchangeId,
      symbol,
      active: true,
      virtual: true,
    });
    if (!ordersToClose?.length) {
      return res;
    }

    for (const order of ordersToClose) {
      let orderToClose: TradeOrder;

      if (order.status === ORDER_STATUS.WAIT_OPEN) {
        orderToClose = {
          ...order,
          profit: 0,
          commission: 0,
          status: ORDER_STATUS.CANCELLED,
          closeTime: new Date().getTime(),
          closePrice: order.type === OPERATION_TYPE.SELL ? price.ask : price.bid,
        };

        orderToClose = await this.redisOrder.setOrder(orderToClose);

        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_CANCELED,
          event: `Cancelled pending order`,
        });

        res.push(orderToClose.id);

        continue;
      }

      orderToClose = {
        ...order,
        ...(comment ? { commentClose: comment } : {}),
        status: ORDER_STATUS.CLOSED,
        closeTime: new Date().getTime(),
        closePrice: order.type === OPERATION_TYPE.SELL ? price.ask : price.bid,
      };
      const commission = order.closePrice * order.volume * (ENABLED_EXCHANGES[order.exchangeId]?.takerFee || 0.001);
      orderToClose.commission = (orderToClose.commission || 0) + commission;
      orderToClose.profit =
        orderToClose.closePrice * order.volume - orderToClose.openPrice * (order.openVolume || order.volume);

      orderToClose = await this.redisOrder.setOrder(orderToClose);
      await this.event.addOrderEvent(orderToClose, {
        type: EVENT_TYPE.ORDER_CLOSED,
        event: `Closed virtual order`,
      });

      Logger.debug(`CLOSE virtual order: ${JSON.stringify(orderToClose)}`);

      const sum = order.closePrice * order.volume - commission;
      if (sum > 0) {
        await this.redisUser.increaseVirtualBalance({ userId, exchangeId, sum });
      }

      res.push(orderToClose.id);
    }

    return await Promise.all(res);
  }

  async closeAllOrders(params: QueueParamsCloseOrders): Promise<TradeOrderIdType[] | { message: string }> {
    if (process.env.TRADE_ALLOWED === '0' || process.env.TRADE_ALLOWED?.toLowerCase() === 'false') {
      return { message: `TRADE NOT ALLOWED` };
    }

    const { exchangeId, symbol, userId, virtual, comment } = params;

    if (virtual) {
      return this.closeAllVirtualOrders(params);
    }

    // *** NEXT LINES FOR REAL ORDERS ***
    if (process.env.TRADE_REAL_ALLOWED === '0' || process.env.TRADE_REAL_ALLOWED?.toLowerCase() === 'false') {
      Logger.warn(`REAL TRADE NOT ALLOWED`);
      return { message: `REAL TRADE NOT ALLOWED` };
    }

    const price = await this.getMarketPrice(exchangeId, symbol);
    if (!price || !price.ask || !price.bid || !price.timestamp) {
      return { message: 'Price not found' };
    }

    const market = await this.redisExchange.getMarket(exchangeId, symbol);
    if (!market) {
      return { message: `Market ${symbol} not found` };
    }

    const res = [];

    let ordersToClose: TradeOrder[] = await this.redisOrder.getOrders({
      userId,
      exchangeId,
      symbol,
      active: true,
      virtual: false,
    });
    let closed = false;
    for (const order of ordersToClose) {
      let orderToClose: TradeOrder;

      if (order.status === ORDER_STATUS.WAIT_OPEN) {
        orderToClose = {
          ...order,
          commission: 0,
          profit: 0,
          status: ORDER_STATUS.CANCELLED,
          closeTime: new Date().getTime(),
          closePrice: order.type === OPERATION_TYPE.SELL ? price.ask : price.bid,
        };

        orderToClose = await this.redisOrder.setOrder(orderToClose);

        res.push(orderToClose.id);

        closed = true;
      }
    }
    if (closed) {
      ordersToClose = await this.redisOrder.getOrders({ userId, exchangeId, symbol, active: true, virtual: false });
    }
    if (!ordersToClose?.length) {
      Logger.warn(`Orders to close not found: ${JSON.stringify(params)}`);
      return res;
    }

    const base = ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol);
    const quote = ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, symbol);

    const balances = await this.exchange.getWalletBalances({ userId, exchangeId });
    if (!balances) {
      Logger.error('Cannot get balances for user: ' + userId, 'closeAllOrders');
      return { message: `Can't get balances for [${exchangeId}] ${userId}` };
    }

    const freeQuoteBalance = balances?.[quote]?.free || 0;
    const freeQuoteBalanceCost = freeQuoteBalance * price.bid;

    let ordersVolume = ordersToClose.reduce(
      (volume, order) => volume + (order.status === ORDER_STATUS.OPENED ? order.volume : 0),
      0
    );
    const ordersCost = ordersVolume * price.bid;

    const minimumCost = market.limits?.cost?.min || CUPO_STRATEGY_PARAMS.minimumLotSum || 1;

    // *** NO QUOTE BALANCE
    if (!ordersVolume || !freeQuoteBalance || minimumCost > freeQuoteBalanceCost) {
      const cause = `Minimum lot sum is ${minimumCost} ${base}, orders cost ${base}: ${ordersVolume}/${ordersCost}, balance cost ${base}: ${freeQuoteBalance}=${freeQuoteBalanceCost}, orders [${ordersToClose
        .map((order) => order.id)
        .join(', ')}]`;

      Logger.error(`[${exchangeId}] ${userIdRepresentation(userId)} ${symbol}. ${cause}`);

      for (const order of ordersToClose) {
        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Error close all orders: not enough balance`,
          data: { cause, freeQuoteBalance, freeQuoteBalanceCost, minOrderCost: minimumCost },
        });
      }

      // if (freeQuoteBalanceCost >= 0 && freeQuoteBalanceCost < 1) {
      // for (let order of ordersToClose) {
      //   await this.event.addOrderEvent(order, {
      //     type: EVENT_TYPE.ORDER_CANCELED,
      //     event: `Cancel order due insufficient balance`,
      //     data: {order  },
      //   });
      //
      //   order.closeTime = new Date().getTime();
      //   order.commentClose = `Cancel order due insufficient balance`;
      //   order.closePrice = price.bid;
      //   order.profit = (price.bid - order.openPrice) * (order.openVolume || order.volume);
      //   order.status = ORDER_STATUS.CANCELLED;
      //
      //   order = await this.redisOrder.setOrder(order);
      //   await this.event.addOrderEvent(order, {
      //     type: EVENT_TYPE.ORDER_CANCELED,
      //     event: `Cancel order due insufficient balance`,
      //   });
      //
      //   res.push(order.id);
      //
      //   Logger.error(`Cancel order due insufficient balance: ${order.commentClose}`);
      // }

      return res;
    }

    // *** NOT ENOUGH BALANCE TO CLOSE ALL ORDERS, minus commission 0.002
    if (minimumCost > ordersCost || ordersVolume * 0.998 > freeQuoteBalance) {
      const cause = `Not enough balance to close all orders: min cost ${base} = ${minimumCost}, orders cost ${base} = ${ordersCost}, balance volume ${quote} = ${freeQuoteBalance}, order volume ${quote} = ${ordersVolume}`;

      Logger.error(`[${exchangeId}] ${userIdRepresentation(userId)} ${symbol}. ${cause}`);

      for (const order of ordersToClose) {
        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Not enough balance to close all orders`,
          data: {
            cause,
            ordersCost,
            ordersVolume,
            freeQuoteBalance,
            freeQuoteBalanceCost,
            minimumCost,
          },
        });
      }

      return res;
    }

    // *** BALANCE IS SMALLER ON 0.2% COMMISSION SIZE
    if (ordersVolume > freeQuoteBalance) {
      market.limits = market.limits || {};
      const newOrdersVolume = freeQuoteBalance;
      const newOrdersCost = newOrdersVolume * price.bid;

      const cause = `Balance is smaller on 0.2% commission size: orders volume ${quote}: ${ordersVolume}, balance volume ${quote}: ${freeQuoteBalance}`;

      Logger.warn(`[${exchangeId}] ${userIdRepresentation(userId)} ${symbol}. ${cause}`);

      for (const order of ordersToClose) {
        order.volume = (order.volume * freeQuoteBalance) / ordersVolume;

        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_INFO,
          event: `Change orders volume due insufficient balance`,
          data: {
            cause,
            ordersCost,
            ordersVolume,
            freeQuoteBalance,
            freeQuoteBalanceCost,
            newOrdersVolume,
            newOrdersCost,
          },
        });
      }

      // ordersCost = newOrdersCost;
      ordersVolume = newOrdersVolume;
    }

    let exchangeOrder;
    try {
      const exchangeOrderToClose = {
        ...ordersToClose[0],
        volume: ordersVolume,
      };

      for (const order of ordersToClose) {
        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_INFO,
          event: `Try close all orders`,
          data: { volume: ordersVolume },
        });
      }

      exchangeOrder = await this.exchange.closeExchangeOrder(exchangeOrderToClose);
      if (!exchangeOrder) {
        setImmediate(
          async (ordersToClose, ordersVolume) => {
            for (const order of ordersToClose) {
              await this.event.addOrderEvent(order, {
                type: EVENT_TYPE.ORDER_ERROR,
                event: `Error close all orders: exchange response is empty`,
                data: { volume: ordersVolume },
              });
            }
          },
          ordersToClose,
          ordersVolume
        );

        return res;
      }

      for (const order of ordersToClose) {
        order.status = ORDER_STATUS.CLOSED;
        order.closeTime = Date.now();

        await this.redisOrder.setOrder(order);
      }

      for (const order of ordersToClose) {
        order.commentClose = comment;
        order.closePrice = exchangeOrder?.price || (order.type === OPERATION_TYPE.SELL ? price.ask : price.bid);
        order.commission = (order.commission || 0) + (exchangeOrder?.fee?.cost || 0);
        order.profit = order.closePrice * order.volume - order.openPrice * (order.openVolume || order.volume);

        await this.redisOrder.setOrder(order);

        Logger.log(`CLOSED real order: ${order.id}`);

        setImmediate(
          async (order, exchangeOrder) => {
            await this.event.addOrderEvent(order, {
              type: EVENT_TYPE.ORDER_CLOSED,
              data: { exchangeOrder },
            });
          },
          order,
          exchangeOrder
        );

        res.push(order.id);
      }

      Logger.verbose(
        `CLOSED all real orders with balance ${freeQuoteBalance}: ${JSON.stringify(
          (ordersToClose || []).map((order) => order.id).join(', ')
        )}`
      );
    } catch (err) {
      Logger.error(`Error CLOSE ALL REAL orders: [${exchangeId}] ${userId} ${symbol}: ${err.message}`);

      for (const order of ordersToClose) {
        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Error close all orders`,
          data: { cause: err.message, ordersVolume, exchangeOrder },
        });
      }

      return res;
    }

    // CANCEL WAITING ORDERS
    ordersToClose = await this.redisOrder.getOrders({ userId, exchangeId, symbol, active: true, virtual: false });
    for (const order of ordersToClose) {
      let orderToClose: TradeOrder;

      if (order.status === ORDER_STATUS.WAIT_OPEN) {
        orderToClose = {
          ...order,
          commission: 0,
          profit: 0,
          status: ORDER_STATUS.CANCELLED,
          closeTime: new Date().getTime(),
          closePrice: order.type === OPERATION_TYPE.SELL ? price.ask : price.bid,
        };

        orderToClose = await this.redisOrder.setOrder(orderToClose);

        res.push(orderToClose.id);
      }
    }

    return await Promise.all(res);
  }

  async closeOrder(params: QueueParamsCloseOrders): Promise<TradeOrderIdType[] | { message: string }> {
    if (process.env.TRADE_ALLOWED === '0' || process.env.TRADE_ALLOWED?.toLowerCase() === 'false') {
      return { message: `TRADE NOT ALLOWED` };
    }

    const { exchangeId, symbol, userId, type, virtual, orderIds, order, comment } = params;

    const price = await this.getMarketPrice(exchangeId, symbol);
    if (!price || !price.ask || !price.bid || !price.timestamp) {
      return { message: 'Price not found' };
    }

    const market = await this.redisExchange.getMarket(exchangeId, symbol);
    if (!market) {
      return { message: `Market ${symbol} not found` };
    }

    const res = [];

    if (type === TADE_SIGNAL.CLOSE_ALL || type === TADE_SIGNAL.CLOSE_DISABLED) {
      // close all orders
      return await this.closeAllOrders(params);
    }

    let ordersToClose: TradeOrder[] = [];
    if (orderIds) {
      if (!orderIds.length) {
        return res;
      }

      ordersToClose = await this.redisOrder.getOrders({ userId, exchangeId, symbol, active: true, orderIds, virtual });
    } else if (order) {
      ordersToClose = await this.redisOrder.getOrders({
        userId,
        exchangeId,
        symbol,
        active: true,
        virtual,
        orderIds: [order.id],
      });
      // } else if (type === TADE_SIGNAL.CLOSE_ALL) {
      //   // close all orders
      //   ordersToClose = await this.redisOrder.getOrders({ userId, exchangeId, symbol, active: true, virtual });
    }

    if (!ordersToClose?.length) {
      return res;
    }

    const base = ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol);
    const quote = ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, symbol);

    const balances = await this.exchange.getWalletBalances({ userId, exchangeId });
    if (!balances) {
      Logger.error('Cannot get balances for user: ' + userIdRepresentation(userId), 'closeOrder');
      return { message: `Can't get balances for [${exchangeId}] ${userId}` };
    }

    const freeQuoteBalance = balances?.[quote]?.free || 0;
    const freeQuoteBalanceCost = freeQuoteBalance * price.bid;
    if (!freeQuoteBalance) {
      Logger.error(
        `No free balance for user: ${userIdRepresentation(userId)}, [${exchangeId}] ${symbol}`,
        'closeOrder'
      );
      return { message: `No free balance for [${exchangeId}] ${symbol}, user ${userIdRepresentation(userId)}` };
    }

    for (const order of ordersToClose) {
      let orderToClose: TradeOrder;

      if (order.status === ORDER_STATUS.WAIT_OPEN) {
        orderToClose = {
          ...order,
          profit: 0,
          commission: 0,
          status: ORDER_STATUS.CANCELLED,
          closeTime: new Date().getTime(),
          closePrice: order.type === OPERATION_TYPE.SELL ? price.ask : price.bid,
        };

        orderToClose = await this.redisOrder.setOrder(orderToClose);
        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_CANCELED,
        });

        res.push(orderToClose.id);

        continue;
      }

      orderToClose = {
        ...order,
        ...(comment ? { commentClose: comment } : {}),
        status: ORDER_STATUS.CLOSED,
        closeTime: new Date().getTime(),
        closePrice: order.type === OPERATION_TYPE.SELL ? price.ask : price.bid,
      };

      // *** VIRTUAL ORDER ***
      if (orderToClose.isVirtual !== false) {
        const commission =
          orderToClose.closePrice *
          orderToClose.volume *
          (ENABLED_EXCHANGES[orderToClose.exchangeId]?.takerFee || 0.001);
        orderToClose.commission = (orderToClose.commission || 0) + commission;
        orderToClose.profit =
          orderToClose.closePrice * orderToClose.volume -
          orderToClose.openPrice * (orderToClose.openVolume || orderToClose.volume);
        orderToClose.isVirtual = true;

        orderToClose = await this.redisOrder.setOrder(orderToClose);
        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_CLOSED,
          data: { commission: orderToClose.commission, profit: orderToClose.profit },
        });

        const sum = orderToClose.closePrice * orderToClose.volume - commission;
        if (sum > 0) {
          await this.redisUser.increaseVirtualBalance({ userId, exchangeId, sum });
        }

        res.push(orderToClose.id);
      }

      // *** REAL ORDER ***
      if (process.env.TRADE_REAL_ALLOWED === '0' || process.env.TRADE_REAL_ALLOWED?.toLowerCase() === 'false') {
        Logger.warn(`REAL TRADE NOT ALLOWED`);
        continue;
      }

      let orderVolume = orderToClose.volume || 0;
      const orderCost = orderVolume * price.bid;
      const minimumCost = market.limits?.cost?.min || CUPO_STRATEGY_PARAMS.minimumLotSum || 1;

      // *** NO QUOTE BALANCE
      if (!orderVolume || !freeQuoteBalance || minimumCost > orderCost || minimumCost > freeQuoteBalanceCost) {
        const cause = `Minimum lot sum is ${minimumCost} ${base}, order volume cost ${base}: ${
          orderToClose.volume * price.bid
        }, balance cost ${base}: ${freeQuoteBalance} = ${freeQuoteBalanceCost}, order [${orderToClose.id}]`;

        Logger.warn(`[${exchangeId}] ${userId} ${symbol}: ${cause}`);

        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Error close orders: not enough balance`,
          data: { cause, freeQuoteBalance, freeQuoteBalanceCost, minOrderCost: minimumCost },
        });

        continue;
      }

      // *** NOT ENOUGH BALANCE TO CLOSE ORDER, minus commission 0.002
      if (minimumCost > orderCost || orderVolume * 0.998 > freeQuoteBalance) {
        const cause = `Not enough balance to close order: min cost ${base} = ${minimumCost}, orders cost ${base} = ${orderCost}, balance volume ${quote} = ${freeQuoteBalance}, order volume ${quote} = ${orderVolume}`;

        Logger.error(`[${exchangeId}] ${userIdRepresentation(userId)} ${symbol}. ${cause}`);

        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Not enough balance to close order`,
          data: {
            cause,
            orderCost,
            orderVolume,
            freeQuoteBalance,
            freeQuoteBalanceCost,
            minimumCost,
          },
        });

        return res;
      }

      // *** BALANCE IS SMALLER ON 0.2% COMMISSION SIZE
      if (orderVolume > freeQuoteBalance) {
        market.limits = market.limits || {};
        const newOrderVolume = freeQuoteBalance;
        const newOrderCost = newOrderVolume * price.bid;

        const cause = `Balance is smaller on 0.2% commission size: orders volume ${quote}: ${orderVolume}, balance volume ${quote}: ${freeQuoteBalance}`;

        Logger.warn(`[${exchangeId}] ${userIdRepresentation(userId)} ${symbol}. ${cause}`);

        order.volume = freeQuoteBalance;

        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_INFO,
          event: `Change order volume due insufficient balance`,
          data: {
            cause,
            orderCost,
            orderVolume,
            freeQuoteBalance,
            freeQuoteBalanceCost,
            newOrderVolume,
            newOrderCost,
          },
        });

        // ordersCost = newOrdersCost;
        orderVolume = newOrderVolume;
      }

      let exchangeOrder;
      try {
        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_INFO,
          event: `Try close orders`,
          data: { volume: orderVolume },
        });

        exchangeOrder = await this.exchange.closeUserOrder(orderToClose);
        if (!exchangeOrder) {
          await this.event.addOrderEvent(order, {
            type: EVENT_TYPE.ORDER_ERROR,
            event: `Error close order: exchange response is empty`,
            data: { volume: orderVolume },
          });

          continue;
        }

        orderToClose.commentClose = comment;
        orderToClose.closePrice =
          exchangeOrder?.price || (orderToClose.type === OPERATION_TYPE.SELL ? price.ask : price.bid);
        orderToClose.commission = (orderToClose.commission || 0) + (exchangeOrder?.fee?.cost || 0);
        orderToClose.profit =
          orderToClose.closePrice * orderToClose.volume -
          orderToClose.openPrice * (orderToClose.openVolume || orderToClose.volume);

        await this.redisOrder.setOrder(orderToClose);

        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_CLOSED,
          data: { exchangeOrder },
        });

        res.push(orderToClose.id);

        Logger.verbose(`CLOSED real order: ${JSON.stringify(orderToClose)}`);
      } catch (err) {
        Logger.error(`Error CLOSE REAL order: [${exchangeId}] ${userId} ${symbol}: ${err.message}`);

        await this.event.addOrderEvent(orderToClose, {
          type: EVENT_TYPE.ORDER_ERROR,
          event: `Error close order`,
          data: { cause: err.message, orderVolume, exchangeOrder },
        });
      }

      // res.push(this.updateOne(OrderToEntity(orderToClose)));
    }

    return await Promise.all(res);
  }

  async cancelOrder(params: QueueParamsCloseOrders): Promise<number> {
    const { exchangeId, symbol, userId, comment } = params;

    const returnBalance = await this.redisOrder.cancelVirtualUserOrders({ exchangeId, userId, symbol, comment });
    if (returnBalance) {
      await this.redisUser.increaseVirtualBalance({ userId, exchangeId, sum: returnBalance });
    }

    return returnBalance;
  }

  // calculate order volume based on market limits
  getOrderVolume(order: TradeOrder, market: Market): number {
    if (order?.volume > 0) {
      return +order.volume.toFixed(market?.precision?.amount || 8);
    }

    const minVolume = market.limits?.amount?.min || 0.01; // todo: move to config the amount of minimum volume
    let volume = Math.max(order.volume || 0, minVolume);

    if (market.limits?.cost?.min > volume) {
      volume = Math.max(volume, market.limits.cost.min + minVolume);
    }

    return +volume.toFixed(market?.precision?.amount || 8);
  }

  // check market conditions for open or close order
  checkMarketConditions(exchangeId: string, market: Market): boolean {
    if (market?.active === false) {
      Logger.warn(`[${exchangeId}] Market [${market?.symbol}] is not active`);
      return false;
    }

    if (!market?.spot) {
      Logger.warn(`[${exchangeId}] Market [${market?.symbol}] - spot disabled`);
      return false;
    }

    return true;
  }

  async openOrder(params: QueueParamsOpenOrder): Promise<TradeOrderIdType | { message: string }> {
    const { exchangeId, symbol, order } = params;

    const market = await this.redisExchange.getMarket(exchangeId, symbol);
    if (!market) {
      return { message: `Market ${symbol} not found` };
    }

    const baseCurrencies = ENABLED_EXCHANGES[exchangeId].baseCurrencies;
    if (!baseCurrencies.includes(market.quote) && order?.type === OPERATION_TYPE.BUY) {
      return { message: `Market [${market?.symbol}] is not quoting [${baseCurrencies?.toString()}] for buy` };
    }

    if (!this.checkMarketConditions(exchangeId, market)) {
      return { message: `Market [${symbol}] conditions is not relevant for trading` };
    }

    // const volume = this.getOrderVolume(order, market);

    switch (order?.type) {
      case OPERATION_TYPE.BUY:
        return this.openBuyOrder(order);
      // return this.openBuyOrder({ ...order, volume, openPrice: price.ask });
      case OPERATION_TYPE.SELL:
        return this.openSellOrder(order);
      // return this.openSellOrder({ ...order, volume, openPrice: price.bid });
      default:
        return { message: 'Unknown order type' };
    }
  }

  async getMarketPrice(exchangeId: string, symbol: string): Promise<ExchangePrice | null> {
    return this.redisTicker.getMarketPrice(exchangeId, symbol);
  }

  // private async insert(order: TradeOrderEntity): Promise<TradeOrderEntity> {
  //   return this.repo.save(order);
  // }
  //
  // private async findAll(): Promise<TradeOrderEntity[]> {
  //   return this.repo.find();
  // }
  //
  // private findOne(orderId: string): Promise<TradeOrderEntity> {
  //   return this.repo.findOneBy({ id: orderId });
  // }
  //
  // private updateOne(order: TradeOrderEntity): Promise<UpdateResult> {
  //   return this.repo.update({ id: order.id }, order);
  // }
  //
  // private async remove(id: string): Promise<void> {
  //   await this.repo.delete(id);
  // }

  @Cron('0 * * * * *')
  async checkStalledPendingOrders(): Promise<void> {
    // const count = await this.redisOrder.cancelOpenOrdersSemaphore();
    //
    // if (count > 0) {
    //   Logger.log(`CANCELLED pending orders semaphores: ${count}`);
    // }

    if (!(await this.redisOrder.isMainOrderManager(this.managerId))) {
      return;
    }

    const users = (await this.redisUser.getUsers()) || [];

    for (const exchangeId of getEnabledExchangeIds()) {
      for (const user of users) {
        const cancelled = await this.redisOrder.cancelPendingOrders(exchangeId, user.id);
        if (cancelled?.length) {
          Logger.log(`CANCELLED pending orders [${exchangeId}] ${userRepresentation(user)}: ${cancelled}`);
        }
      }
    }
  }

  @Cron('*/5 * * * * *')
  async collectAllUsersOrders(): Promise<void> {
    if (!(await this.redisOrder.isMainOrderManager(this.managerId))) {
      return;
    }

    const users = (await this.redisUser.getUsers()) || [];

    for (const exchangeId of getEnabledExchangeIds()) {
      for (const user of users) {
        await this.queueService.addJob_CollectOrders({ exchangeId, userId: user.id });
      }
    }
  }
}
