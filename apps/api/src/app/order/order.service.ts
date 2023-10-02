import { Injectable, Logger } from "@nestjs/common";
import { getClosedOrderProfit } from "@cupo/backend/common";
import {
  OrdersMongodbService,
  RedisExchangeService,
  RedisOrderService,
  RedisTickerService,
  RedisUserService
} from "@cupo/backend/storage";
import { QueueService } from "@cupo/backend/queue";
import {
  ENABLED_EXCHANGES,
  getLastDays,
  getLastDaysDate,
  getLastMonths,
  getLastMonthsDate,
  REST_API_RESPONSE_STATUS
} from "@cupo/backend/constant";
import {
  CloseOrdersBodyDto,
  EVENT_TYPE,
  OPERATION_TYPE,
  ORDER_STATUS,
  TADE_SIGNAL,
  TradeOrder,
  TradeOrderIdType,
  TradeSignalType,
  UserWalletBalances
} from "@cupo/backend/interface";
import { IGetAllOrders } from "@cupo/backend/interface/src/lib/order.dto";
import { EventService } from "@cupo/event";
import { ExchangeLibService } from "@cupo/exchange";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const icons = require('../crypto-icons.json');

@Injectable()
export class OrderService {
  constructor(
    private readonly queueService: QueueService,
    private readonly exchange: ExchangeLibService,
    private readonly mongo: OrdersMongodbService,
    private readonly redisTicker: RedisTickerService,
    private readonly redisOrder: RedisOrderService,
    private readonly redisUser: RedisUserService,
    private readonly redisMarket: RedisExchangeService,
    private readonly event: EventService
  ) {}

  async getTotalOrders(): Promise<Record<string, number>> {
    const res = {};

    const promises = Object.keys(ENABLED_EXCHANGES).map((exchangeId) => {
      res[exchangeId] = this.redisOrder.getOrdersCount(exchangeId);
    });

    await Promise.all(promises);

    return res;
  }

  async getUserOrders(
    userId: string,
    exchangeId: string,
    symbol?: string,
    active?: boolean,
    virtual?: boolean,
    orderStatus?: ORDER_STATUS
  ): Promise<{ length: number; orders: { [symbol: string]: TradeOrder[] | number } } | null> {
    const cdn = 'https://cupocoin.sfo3.cdn.digitaloceanspaces.com/crypto-logo/';

    const tickers = (await this.redisTicker.getTickers(exchangeId)) || {};

    const orders = (
      await this.mongo.getOrders({
        userId,
        exchangeId,
        symbol,
        active,
        virtual,
        orderStatus,
        cancelled: false,
      })
    ).map((order) => ({
      ...(order.openTime ? { openHumanTime: new Date(order.openTime) } : { openTime: undefined }),
      ...(order.closeTime ? { closeHumanTime: new Date(order.closeTime) } : { closeTime: undefined }),
      ...(order.closePrice ? { closePrice: order.closePrice } : { closePrice: 0 }),
      ...order,
      ...(tickers[order.symbol]?.bid ? { currentPrice: tickers[order.symbol].bid } : {}),
      ...(tickers[order.symbol]?.bid && order.status === ORDER_STATUS.OPENED
        ? { profit: tickers[order.symbol].bid * order.volume - order.openPrice * (order.openVolume || order.volume) }
        : {}),

      coinUrl: icons.includes(ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, order.symbol).toLowerCase())
        ? `${cdn}${ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, order.symbol).toLowerCase()}.svg`
        : `${cdn}coin.svg`,
      _id: undefined,
    }));

    const res = {};
    for (const order of orders) {
      if (!res[order.symbol]) {
        res[order.symbol] = [];
      }
      res[order.symbol].push(order);
    }

    return { length: orders.length, orders: res };
  }

  async getOrderItem(orderId: string): Promise<TradeOrder | null> {
    const cdn = 'https://cupocoin.sfo3.cdn.digitaloceanspaces.com/crypto-logo/';

    const order = await this.mongo.getOrderItem(orderId);
    if (order) {
      order.openHumanTime = order.openTime ? new Date(order.openTime) : undefined;
      order.closeHumanTime = order.closeTime ? new Date(order.closeTime) : undefined;
      order.closePrice = order.closePrice ? order.closePrice : 0;
      order['coinUrl'] = icons.includes(
        ExchangeLibService.getQuoteCurrencyFromSymbol(order.exchangeId, order.symbol).toLowerCase()
      )
        ? `${cdn}${ExchangeLibService.getQuoteCurrencyFromSymbol(order.exchangeId, order.symbol).toLowerCase()}.svg`
        : `${cdn}coin.svg`;
      delete order['_id'];
    }

    return order || null;
  }

  async getAllOrders(params: IGetAllOrders): Promise<{ totalItems: number; orders: TradeOrder[] }> {
    const cdn = 'https://cupocoin.sfo3.cdn.digitaloceanspaces.com/crypto-logo/';

    const users = {};
    if (params?.userId || params?.userEmail) {
      const user = await this.redisUser.getUser({ userId: params.userId, email: params.userEmail });

      if (user) {
        params.userId = user.id;
        delete params.userEmail;

        users[user.id] = user;
      }
    }

    if (
      !Object.keys(users).length &&
      (params?.userEmail || params?.userName || params?.userId || params?.userPlatformId)
    ) {
      const users = await this.redisUser.getUsers();
      for (const user of users) {
        if (
          (params?.userEmail && user.email?.toLowerCase()?.includes(params.userEmail.toLowerCase())) ||
          (params?.userName && user.name?.toLowerCase()?.includes(params.userName.toLowerCase())) ||
          (params?.userId && user.id?.toLowerCase()?.includes(params.userId.toLowerCase())) ||
          (params?.userPlatformId && user.platformId === params.userPlatformId)
        ) {
          if (!params.userIds) {
            params.userIds = [];
          }

          params.userIds = [...params.userIds, user.id];
          delete params.userId;

          users[user.id] = user;
        }
      }
    }

    const { orders, totalItems } = await this.mongo.getAllOrders(params);

    if (totalItems && !Object.keys(users).length) {
      for (const order of orders) {
        const user = await this.redisUser.getUser({ userId: order.userId });

        if (user) {
          users[user.id] = user;
        }
      }
    }

    return {
      orders: orders.map((order) => ({
        ...(order.openTime
          ? { openHumanTime: new Date(order.openTime) }
          : {
              openHumanTime: undefined,
              openTime: undefined,
            }),
        ...(order.closeTime
          ? { closeHumanTime: new Date(order.closeTime) }
          : {
              closeHumanTime: undefined,
              closeTime: undefined,
            }),
        ...(order.closePrice ? { closePrice: order.closePrice } : { closePrice: 0 }),
        ...order,

        userName: users[order.userId]?.name,
        userEmail: users[order.userId]?.email,
        userPlatformId: users[order.userId]?.platformId,

        coinUrl: icons.includes(
          ExchangeLibService.getQuoteCurrencyFromSymbol(order.exchangeId, order.symbol).toLowerCase()
        )
          ? `${cdn}${ExchangeLibService.getQuoteCurrencyFromSymbol(order.exchangeId, order.symbol).toLowerCase()}.svg`
          : `${cdn}coin.svg`,
        _id: undefined,
      })),
      totalItems,
    };
  }

  // get orders witch summary volume less than the coin balance
  async getBrokenUserOrders(
    userId: string,
    exchangeId: string
  ): Promise<{ [currency: string]: { balance: number; cost: number; ordersBalance: number; orders: string[] } }> {
    const baseCurrency = await this.redisUser.getUserBaseCurrency(userId, exchangeId);
    if (!baseCurrency) {
      Logger.warn(`User [${userId}] baseCurrency not found in getUserBalance()`);
      return null;
    }

    const orders = await this.mongo.getOrders({
      userId,
      exchangeId,
      symbol: undefined,
      active: true,
      opened: true,
      virtual: false,
    });

    const balances = await this.getUserBalance(userId, exchangeId);

    const res = {};

    if (orders && balances) {
      for (const order of orders) {
        const quote = ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, order.symbol, baseCurrency);
        if (quote === 'null') {
          Logger.warn(
            `User [${userId}] has no quoting currency in the order [${order.id}] with symbol [${order.symbol}]`
          );
          continue;
        }

        // orders
        if (!res[quote]) {
          res[quote] = {
            ordersBalance: 0,
            orders: [],
          };
        }
        if (!res[quote].ordersBalance) {
          res[quote].ordersBalance = 0;
          res[quote].orders = [];
        }

        res[quote].ordersBalance += order.volume;
        res[quote].orders.push(order.id);
      }

      // balances
      for (const currency of Object.keys(balances)) {
        if (!res[currency]) {
          res[currency] = {
            balance: 0,
            cost: 0,
          };
        }

        if (balances[currency].cost) {
          res[currency].balance = balances[currency].free;
          res[currency].cost = balances[currency].cost;
        }
      }
    }

    return res;
  }

  // *** Balance ***
  async getUserBalance(userId: string, exchangeId: string): Promise<UserWalletBalances | null> {
    const baseCurrency = await this.redisUser.getUserBaseCurrency(userId, exchangeId);
    if (!baseCurrency) {
      Logger.warn(`User [${userId}] baseCurrency not found in getUserBalance()`);
      return null;
    }

    const balances = await this.redisUser.getWalletBalance(userId, exchangeId);
    if (!balances) {
      Logger.warn(`User [${userId}] has no balances on exchange [${exchangeId}] in getUserBalance()`);
      return null;
    }

    const balance = {};

    if (balances) {
      for (const [currency, value] of Object.entries(balances)) {
        if (!value?.free) {
          balance[currency] = {
            free: 0,
            cost: 0,
          };
          continue;
        }

        let price = await this.redisTicker.getMarketPrice(exchangeId, `${currency}/${baseCurrency}`);
        if (price) {
          balance[currency] = {
            free: value.free || 0,
            cost: +((value?.free || 0) * (currency === baseCurrency ? 1 : price?.bid || 0)).toFixed(2),
          };
        } else {
          price = await this.redisTicker.getMarketPrice(exchangeId, `${baseCurrency}/${currency}`);
          if (price) {
            balance[currency] = {
              free: value.free || 0,
              cost: +((value?.free || 0) * (currency === baseCurrency ? 1 : price?.bid || 0)).toFixed(2),
            };
          } else {
            balance[currency] = {
              free: value.free || 0,
              cost: 0,
            };
          }
        }
      }
    }

    return balance;
  }

  async getUserEarnings(props: {
    userId: string;
    exchangeId?: string;
    virtual?: boolean;
  }): Promise<{ month: { [day: string]: number }; year: { [months: string]: number } }> {
    const { userId, exchangeId, virtual } = props;

    const res = { month: {}, year: {} };

    const days = getLastDays();

    days.forEach((day) => {
      const days = day.getDate();
      const months = day.getMonth();
      const years = day.getFullYear();

      const dayRepresentation = new Date(
        years,
        months,
        days,
        0,
        0,
        0,
        0 // milliseconds
      ).toISOString();

      // console.log(day, dayRepresentation);

      res.month[dayRepresentation] = 0;
    });

    // sort by date
    res.month = Object.keys(res.month)
      .sort()
      .reduce((obj, key) => {
        obj[key] = res.month[key];
        return obj;
      }, {});

    const months = getLastMonths();
    months.forEach((month) => {
      res.year[`${month.getFullYear()}-${month.getMonth() + 1 < 10 ? '0' : ''}${month.getMonth() + 1}`] = 0;
    });

    // sort by month
    res.year = Object.keys(res.year)
      .sort()
      .reduce((obj, key) => {
        obj[key] = res.year[key];
        return obj;
      }, {});

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      Logger.error(`User not found`);

      return res;
    }

    for (const exchange of Object.keys(ENABLED_EXCHANGES)) {
      if (exchangeId && exchangeId !== exchange) {
        continue;
      }

      const orders = await this.mongo.getOrders({
        userId,
        exchangeId: exchange,
        virtual,
        orderStatus: ORDER_STATUS.CLOSED,
      });

      const firstMonthDate = getLastDaysDate();
      const firstYearDate = getLastMonthsDate();

      orders.forEach((order) => {
        const orderDate = new Date(order.closeTime || Date.now());

        const days = orderDate.getDate();
        const months = orderDate.getMonth();
        const years = orderDate.getFullYear();

        if (orderDate >= firstMonthDate) {
          // console.log(
          //   'profit',
          //   order.id,
          //   (order.closePrice || 0) * order.volume - (order.closePrice ? order.openPrice : 0) * order.openVolume
          // );

          const day = new Date(
            years,
            months,
            days,
            0,
            0,
            0,
            0 // milliseconds
          ).toISOString();

          if (!res.month[day]) {
            res.month[day] = 0;
          }

          // res.month[day] += order.profit;

          // Roman: changed to order profit property 21/01/2023
          // res.month[day] += getClosedOrderProfit(order);
          res.month[day] += order.profit;
        }

        if (orderDate >= firstYearDate) {
          const month = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1 < 10 ? '0' : ''}${
            orderDate.getMonth() + 1
          }`;

          if (!res.year[month]) {
            res.year[month] = 0;
          }

          // Roman: changed to order profit property 21/01/2023
          // res.year[month] += getClosedOrderProfit(order);
          res.year[month] += order.profit;
        }
      });
    }

    return res;
  }

  async getProfitOfUserOrders(
    userId: string,
    exchangeId: string,
    symbol?: string,
    virtual?: boolean
  ): Promise<{ [symbol: string]: number | string | { [key: string]: number } } | null> {
    const balances = (await this.redisUser.getWalletBalance(userId, exchangeId)) || {};
    if (!balances) {
      Logger.warn(`User [${userId}] has no balances on exchange [${exchangeId}]`);
      return null;
    }

    const baseCurrency = (await this.redisUser.getUserBaseCurrency(userId, exchangeId)) || 'USD';

    const userBalance = +balances[baseCurrency]?.free || 0;
    const walletBalances = {};
    let walletBalance = 0;

    for (const currency in balances) {
      if (typeof balances[currency] !== 'object') {
        continue;
      }

      walletBalances[currency] = { ...balances[currency], cost: 0 };

      if (currency !== baseCurrency) {
        const price = await this.redisTicker.getMarketPrice(exchangeId, `${currency}/${baseCurrency}`);
        if (!price?.bid) {
          Logger.warn(`No price found for ${currency}/${baseCurrency}`, 'OrderService.getProfitOfUserOrders');

          walletBalances[currency] = { ...walletBalances[currency], cost: 0 };

          continue;
        }

        walletBalances[currency] = {
          ...walletBalances[currency],
          cost: walletBalances[currency].free * (price?.bid || 0),
        };
        walletBalance += walletBalances[currency].cost;
      } else {
        walletBalances[currency] = { ...walletBalances[currency], cost: walletBalances[currency].free };
        walletBalance += walletBalances[currency].cost;
      }
    }

    const orders = await this.mongo.getOrders({ userId, exchangeId, symbol, virtual });

    const res = {};
    let closedProfitSum = 0;
    let orderClosedProfit = 0;
    let openedOrders = 0;
    let closedOrders = 0;
    let openedVolume = 0;
    let openedSum = 0;
    let openedCost = 0;
    let openedProfitSum = 0;

    const symbols = [];
    const openedSymbols = [];

    for (const order of orders) {
      if (order.status === ORDER_STATUS.OPENED) {
        if (symbols.indexOf(order.symbol) === -1) {
          symbols.push(order.symbol);
        }
        if (openedSymbols.indexOf(order.symbol) === -1) {
          openedSymbols.push(order.symbol);
        }

        const price = await this.redisTicker.getMarketPrice(exchangeId, order.symbol);

        openedOrders++;

        const orderOpenedSum = order.openPrice * (order.openVolume || order.volume);
        const orderOpenedCost =
          (price?.bid || order.openPrice) * order.volume * (1 - ENABLED_EXCHANGES[exchangeId].takerFee || 0.998);
        const orderOpenedProfit = orderOpenedCost - orderOpenedSum;

        openedVolume += order.openVolume || order.volume;
        openedSum += orderOpenedSum;
        openedCost += orderOpenedCost;
        openedProfitSum += orderOpenedProfit;

        // const orderOpenedProfit =
        //   ((price.bid || order.openPrice) * order.volume - order.openPrice * (order.openVolume || order.volume)) *
        //   (1 - ENABLED_EXCHANGES[exchangeId].takerFee || 0.998);

        res[order.symbol] = {
          ...(res[order.symbol] || {}),
          openedProfit: +((res[order.symbol]?.openedProfit || 0) + orderOpenedProfit).toFixed(4),
          openedSum: +((res[order.symbol]?.openedSum || 0) + orderOpenedSum).toFixed(4),
          openedCost: +((res[order.symbol]?.openedCost || 0) + orderOpenedCost).toFixed(4),
          minOpenedCost: +Math.min(res[order.symbol]?.minOpenedCost || Infinity, orderOpenedSum).toFixed(4),
          openedCount: (res[order.symbol]?.openedCount || 0) + 1,
        };
      }

      if (order?.profit !== 0 && order.status === ORDER_STATUS.CLOSED) {
        if (symbols.indexOf(order.symbol) === -1) {
          symbols.push(order.symbol);
        }

        closedOrders++;

        orderClosedProfit = getClosedOrderProfit(order);
        closedProfitSum += orderClosedProfit;

        res[order.symbol] = {
          ...res[order.symbol],
          closedProfit: +((res[order.symbol]?.closedProfit || 0) + orderClosedProfit).toFixed(2),
          closedCount: (res[order.symbol]?.closedCount || 0) + 1,
        };
      }

      const quote = ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, order.symbol);
      if (order.symbol.indexOf(quote) >= 0) {
        res[order.symbol] = {
          ...(res[order.symbol] || {}),
          cost: walletBalances[quote]?.cost ? +(walletBalances[quote]?.cost || 0).toFixed(4) : undefined,
          free: walletBalances[quote]?.free,
        };
      }
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let answer: { [symbol: string]: number | string | { [key: string]: number } } = Object.fromEntries(
      Object.entries(res)
        // .map(([symbol, value]: [string, { [key: string]: number }]) => {
        //   const val: { [key: string]: number } = {
        //     ...(value as { [key: string]: number }),
        //     openedCount: value.openedCount > 0 ? value.openedCount : undefined,
        //     closedCount: value.closedCount > 0 ? value.closedCount : undefined,
        //   };
        //
        //   return [symbol, val];
        // })

        // .sort(
        //   ([, a], [, b]) =>
        //     ((b as { openedProfit: number; closedProfit: number }).openedProfit || 0) +
        //     ((b as { openedProfit: number; closedProfit: number }).closedProfit || 0) -
        //     (((a as { openedProfit: number; closedProfit: number }).openedProfit || 0) +
        //       ((a as { openedProfit: number; closedProfit: number }).closedProfit || 0))
        // )
        .sort(([, a], [, b]) => {
          if ((b as { openedCount: number }).openedCount && (a as { openedCount: number }).openedCount) {
            return (
              ((b as { openedProfit: number; closedProfit: number }).openedProfit || 0) +
              ((b as { openedProfit: number; closedProfit: number }).closedProfit || 0) -
              (((a as { openedProfit: number; closedProfit: number }).openedProfit || 0) +
                ((a as { openedProfit: number; closedProfit: number }).closedProfit || 0))
            );
          } else if ((b as { openedCount: number }).openedCount && !(a as { openedCount: number }).openedCount) {
            return 1;
          } else if ((a as { openedCount: number }).openedCount && !(b as { openedCount: number }).openedCount) {
            return -1;
          } else if (!(a as { closedCount: number }).closedCount && !(b as { closedCount: number }).closedCount) {
            return (
              ((b as { openedProfit: number; closedProfit: number }).openedProfit || 0) +
              ((b as { openedProfit: number; closedProfit: number }).closedProfit || 0) -
              (((a as { openedProfit: number; closedProfit: number }).openedProfit || 0) +
                ((a as { openedProfit: number; closedProfit: number }).closedProfit || 0))
            );
          } else {
            return 0;
          }
        })
    );

    answer = {
      baseCurrency,
      closedProfitSum: +closedProfitSum.toFixed(4),
      openedProfitSum: +openedProfitSum.toFixed(4),
      openedSum: +openedSum.toFixed(4),
      openedCost: +openedCost.toFixed(4),
      openedOrders: openedOrders,
      closedOrders: closedOrders,
      openedSymbols: openedSymbols.length,
      tradedSymbols: symbols.length,
      tradeBalance: +(userBalance + openedCost).toFixed(4),
      walletBalance: +walletBalance.toFixed(4),
      baseCurrencyBalance: +userBalance.toFixed(4),
      openedVolume: +openedVolume.toFixed(4),
      ...answer,
    };

    return answer;
  }

  async getSymbolsOfOpenedOrders(userId: string, exchangeId: string, virtual?: boolean): Promise<string[]> {
    return await this.mongo.getOrderSymbols({ userId, exchangeId, active: true, virtual });

    // const orders = await this.redisOrder.getOrders({ userId, exchangeId, active: true, virtual });
    //
    // const res = [];
    //
    // if (orders?.length) {
    //   for (const order of orders) {
    //     if (res.indexOf(order.symbol) === -1) {
    //       res.push(order.symbol);
    //     }
    //   }
    // }
    //
    // return res.sort();
  }

  async closeAllUserOrders(
    userId: string,
    exchangeId: string,
    symbol?: string,
    ordersId?: string[],
    virtual?: boolean
  ): Promise<void> {
    await this.queueService.addJob_CloseOrder({
      exchangeId,
      symbol,
      userId,
      virtual,
      time: new Date().getTime(),
      orderIds: ordersId,
      comment: 'COMMAND: close all orders from API',
      type: ordersId?.length ? undefined : TADE_SIGNAL.CLOSE_ALL,
    });
  }

  async closeUserOrder(
    data: CloseOrdersBodyDto,
    closeReminder?: boolean
  ): Promise<[REST_API_RESPONSE_STATUS, string, TradeOrder]> {
    const { userId, exchangeId, orderId } = data;

    if (!userId || !exchangeId || !orderId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, 'Necessary parameters are not provided', null];
    }

    const order = await this.redisOrder.getOrder({ userId, exchangeId, orderId });
    if (!order) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, 'Order not found', null];
    }

    if (order.status !== ORDER_STATUS.OPENED) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, 'Order not opened', null];
    }

    const market = await this.redisMarket.getMarket(exchangeId, order.symbol);
    if (!market) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, `Symbol market not found ${order.symbol}`, null];
    }

    const walletBalance = await this.redisUser.getWalletBalance(userId, exchangeId);
    if (!walletBalance) {
      return [REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH, 'Wallet balance not found', null];
    }

    const price = await this.redisTicker.getMarketPrice(exchangeId, order.symbol);
    if (!price || !price.bid || !price.ask || !price.datetime) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, `Symbol price not found ${order.symbol}`, null];
    }

    const freeBalance =
      walletBalance?.[ExchangeLibService.getQuoteCurrencyFromSymbol(order.exchangeId, order.symbol)]?.free || 0;

    if (
      !freeBalance ||
      (!closeReminder && (market.limits?.cost?.min || 10) > order.volume * price.bid) ||
      (closeReminder && (market.limits?.cost?.min || 10) > freeBalance * price.bid)
    ) {
      return [
        REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH,
        `Not enough balance to close order. Balance: ${freeBalance}, minimum volume: ${
          market.limits?.amount?.min || 0
        }`,
        null,
      ];
    }

    const volumeBefore = order.volume;

    if (closeReminder) {
      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_INFO,
        event: `User try to close order reminder`,
        data: {
          message: 'if not enough coin, change volume to money reminder',
          volume: order.volume,
          price: price.bid,
          minVolume: market.limits?.amount?.min || 0,
          minCost: market.limits?.cost?.min || 10,
          freeBalance,
          cost: freeBalance * price.bid,
        },
      });

      // change order volume to free balance, close reminder order
      order.volume = Math.min(freeBalance, order.volume);
    } else {
      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_INFO,
        event: `User try to close regular order`,
      });
    }

    const exchangeOrder = this.exchange.closeUserOrder(order);
    if (!exchangeOrder) {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, 'Error close order on the exchange', null];
    }

    if (volumeBefore !== order.volume) {
      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_UPDATED,
        event: 'Order volume reduced to free balance',
        data: { volumeBefore, volume: order.volume },
      });
      await this.redisOrder.setOrder(order);
    }

    order.commentClose = closeReminder ? 'User close order with balance reminder' : `User close regular order`;
    order.closePrice = order.type === OPERATION_TYPE.SELL ? price.ask : price.bid;
    order.profit = order.closePrice * order.volume - order.openPrice * (order.openVolume || order.volume);

    await this.redisOrder.setOrder(order);

    await this.event.addOrderEvent(order, {
      type: EVENT_TYPE.ORDER_CLOSED,
      event: closeReminder ? 'User close order with balance reminder' : `User close regular order`,
      data: exchangeOrder,
    });

    Logger.verbose(`CLOSED real order: ${JSON.stringify(exchangeOrder || {})}`);

    await this.queueService.addJob_CollectOrders({ userId, exchangeId });

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Order closed with balance remaining', order];
  }

  async cancelUserOrder(data: CloseOrdersBodyDto): Promise<[REST_API_RESPONSE_STATUS, string, TradeOrder]> {
    const { userId, exchangeId, orderId } = data;

    await this.event.addOrderEvent(orderId, {
      type: EVENT_TYPE.ORDER_INFO,
      event: `User try to cancel order`,
      userId,
      exchangeId,
    });

    await this.redisOrder.cancelUserOrder({ userId, exchangeId, id: orderId });

    await this.mongo.cancelUserOrder({ userId, exchangeId, id: orderId });

    const order = await this.redisOrder.getOrder({ userId, exchangeId, orderId });

    await this.event.addOrderEvent(order || orderId, {
      type: EVENT_TYPE.ORDER_CANCELED,
      event: `Order canceled by user`,
      userId,
      exchangeId,
    });

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'OK', order];
  }

  async closeOneUserOrder(
    userId: string,
    exchangeId: string,
    symbol: string,
    orderId: string,
    virtual: boolean
  ): Promise<void> {
    await this.event.addOrderEvent(orderId, {
      type: EVENT_TYPE.ORDER_INFO,
      event: `Try close all orders`,
    });

    await this.queueService.addJob_CloseOrder({
      exchangeId,
      symbol,
      userId,
      virtual,
      orderIds: [orderId],
      comment: 'COMMAND: close user order from API',
      type: TADE_SIGNAL.CLOSE,
    });
  }

  async cancelVirtualUserOrders(userId: string, exchangeId: string, symbol?: string): Promise<void> {
    await this.queueService.addJob_CancelOrder({
      userId,
      exchangeId,
      symbol,
      time: new Date().getTime(),
      comment: 'COMMAND: cancel all virtual orders from API',
      type: TADE_SIGNAL.CANCEL_ALL_VIRTUAL,
    });
  }

  async deleteUserOrder(userId: string, exchangeId: string, orderId: TradeOrderIdType): Promise<void> {
    await this.redisOrder.deleteUserOrder({ userId, exchangeId, id: orderId });

    await this.mongo.deleteUserOrder({ userId, exchangeId, id: orderId });
  }

  async deleteAllUserOrder(userId: string, exchangeId: string): Promise<void> {
    await this.redisOrder.deleteAllUserOrders(userId, exchangeId);
    await this.mongo.deleteAllUserOrders(userId, exchangeId);

    await this.redisUser.renewVirtualBalance({ userId, exchangeId });
  }

  async deleteAllUserVirtualOrder(userId: string, exchangeId: string): Promise<number> {
    const returnBalance = await this.redisOrder.deleteVirtualUserOrders({ exchangeId, userId });
    await this.mongo.deleteVirtualUserOrders({ exchangeId, userId });

    await this.redisUser.renewVirtualBalance({ userId, exchangeId });

    return returnBalance;
  }

  async deleteAllVirtualOrder(): Promise<boolean> {
    for (const exchangeId of Object.keys(ENABLED_EXCHANGES)) {
      const users = await this.redisUser.getUsers();
      for (const user of users) {
        await this.redisOrder.deleteVirtualUserOrders({ exchangeId, userId: user.id });
        await this.mongo.deleteVirtualUserOrders({ exchangeId, userId: user.id });

        await this.redisUser.renewVirtualBalance({ userId: user.id, exchangeId });
      }
    }

    return true;
  }

  async openUserOrder(
    userId: string,
    exchangeId: string,
    symbol: string,
    type: string,
    virtual?: boolean,
    amount?: number
  ): Promise<void> {
    const orderType = type === 'SELL' ? OPERATION_TYPE.SELL : OPERATION_TYPE.BUY;

    const signal: TradeSignalType = {
      userId: userId,
      exchangeId: exchangeId,
      symbol: symbol,
      type: TADE_SIGNAL.BUY,
      time: new Date().getTime(),
      comment: 'OPEN ORDER FROM API',
      order: {
        userId: userId,
        exchangeId: exchangeId,
        symbol: symbol,
        isVirtual: virtual === false ? false : virtual,
        type: orderType,
        signal: TADE_SIGNAL.BUY,
        signalTime: new Date().getTime(),
        comment: 'OPEN ORDER FROM API',
        openTime: 0,
        openPrice: 0,
        volume: amount || 0,
        stopLoss: 0,
        takeProfit: 0,
        client: null,
      },
    };

    await this.queueService.addJob_OpenOrder(signal);
  }

  async closeAllVirtualOrders(exchangeId: string): Promise<void> {
    const users = await this.redisUser.getUsers();

    for (const user of users) {
      const orders = await this.redisOrder.getOrders({
        userId: user.id,
        exchangeId,
        symbol: undefined,
        active: true,
        virtual: true,
      });
      const symbols = {};

      orders.forEach((order) => {
        if (!symbols[order.symbol]) {
          symbols[order.symbol] = [];
        }
        symbols[order.symbol].push(order.userId);
      });

      const all = [];

      Object.keys(symbols).forEach((symbol) => {
        const signal: TradeSignalType = {
          userId: user.id,
          exchangeId,
          symbol,
          virtual: true,
          type: TADE_SIGNAL.CLOSE_ALL,
          time: new Date().getTime(),
          comment: 'CLOSE ALL VIRTUAL ORDERS FROM API',
        };
        all.push(this.queueService.addJob_CloseOrder(signal));
      });

      await Promise.all(all);
    }
  }
}
