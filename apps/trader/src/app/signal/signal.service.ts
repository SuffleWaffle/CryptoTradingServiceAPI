import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job } from 'bull';
import { Cron } from '@nestjs/schedule';
import { getOpenedOrderProfit } from '@cupo/backend/common';
import { getCandleTime, getClosedCandle, TIMEFRAME } from '@cupo/timeseries';
import {
  OrdersMongodbService,
  RedisCandleService,
  RedisExchangeService,
  RedisIndicatorsService,
  RedisOrderService,
  RedisTickerService,
  RedisUserService,
} from '@cupo/backend/storage';
import { QueueService } from '@cupo/backend/queue';
import {
  BAD_SYMBOL_FRINGE,
  CALCULATE_SIGNAL_NOT_OFTEN_MSECS,
  CANDLE_UPDATE_TIMEOUT,
  CUPO_STRATEGY_PARAMS,
  ENABLED_EXCHANGES,
  EXCLUDED_CURRENCIES,
  getEnabledExchangeIds,
  getIPAddress,
  getMinimumLotCost,
  MAXIMUM_EXCHANGE_SIGNALS_PER_TIME,
  messageRepresentation,
  OPEN_ORDER_PAUSE,
  SAVE_TICKERS_TIMEOUT,
  sleep,
  TRADE_STRATEGIES,
  USER_EXCHANGE_STATUS,
  userRepresentation,
} from '@cupo/backend/constant';
import {
  EVENT_TYPE,
  INDICATOR_SIGNAL,
  OPERATION_TYPE,
  ORDER_STATUS,
  QueueParamsCalculateIndicatorSignal,
  QueueParamsCloseOrders,
  QueueParamsOpenOrder,
  StrategyCondition,
  StrategyIndicatorSignalsCUPO,
  StrategyOrderSignalsCUPO,
  StrategyParameters,
  TADE_SIGNAL,
  TradeOrder,
  TradeOrderIdType,
  TradeSignalType,
  User,
} from '@cupo/backend/interface';
import { EventService } from '@cupo/event';
import { cupoIndicatorsStrategy } from './strategy/cupo.strategy';
import { ExchangeLibService } from '@cupo/exchange';

@Injectable()
export class SignalService implements OnApplicationBootstrap {
  private managerId = getIPAddress();
  private lastScore = 0;
  private signalsPerTime = 0;

  private lastCalculateSignal = {};

  private allUserSymbols = {};

  // private cpuUsage = 0;

  constructor(
    private readonly queueService: QueueService,
    private readonly event: EventService,
    private readonly exchange: ExchangeLibService,
    private readonly redisCandles: RedisCandleService,
    private readonly redisIndicator: RedisIndicatorsService,
    private readonly redisTicker: RedisTickerService,
    private readonly redisExchange: RedisExchangeService,
    private readonly redisOrder: RedisOrderService,
    private readonly redisUser: RedisUserService,
    private readonly mongoSignal: OrdersMongodbService
  ) {
    this.signalsPerTime = MAXIMUM_EXCHANGE_SIGNALS_PER_TIME;
  }

  async checkNewTickers() {
    const now = Date.now();

    const jobs = [];
    const exchanges = getEnabledExchangeIds().filter(
      (exchangeId) =>
        !process.env.TRADER_ENABLED_EXCHANGES || process.env.TRADER_ENABLED_EXCHANGES?.includes(exchangeId)
    );
    const exchangeId = exchanges[Math.floor(Math.random() * exchanges.length)];
    const executed = await this.calculateIndicatorSignal(exchangeId);

    // Object.keys(ENABLED_EXCHANGES).forEach((exchangeId) => {
    //   jobs.push(this.calculateIndicatorSignal(exchangeId));
    // });

    await Promise.all(jobs);

    this.lastScore = Date.now() - now;

    if (executed === this.signalsPerTime && this.lastScore > SAVE_TICKERS_TIMEOUT && this.signalsPerTime > 1) {
      // this.signalsPerTime--;
      this.signalsPerTime = Math.max(
        Math.floor((this.signalsPerTime * SAVE_TICKERS_TIMEOUT) / (this.lastScore || 0.000001)) - 1,
        1
      );

      // console.log(
      //   '***************',
      //   exchangeId,
      //   this.managerId,
      //   executed,
      //   this.signalsPerTime,
      //   this.lastScore / SAVE_TICKERS_TIMEOUT
      // );
    } else if (executed === this.signalsPerTime && this.lastScore < SAVE_TICKERS_TIMEOUT) {
      this.signalsPerTime++;

      // console.log(
      //   '+++++++++++++++',
      //   exchangeId,
      //   this.managerId,
      //   executed,
      //   this.signalsPerTime,
      //   this.lastScore / SAVE_TICKERS_TIMEOUT
      // );
    }

    // console.log('*******************', getIPAddress(), this.lastScore, 'MSec, Signals per 1 time:', this.signalsPerTime);

    setTimeout(
      () => this.checkNewTickers(),
      Math.random() * 50
      // this.lastScore < SAVE_TICKERS_TIMEOUT ? SAVE_TICKERS_TIMEOUT - this.lastScore : Math.random() * 50
    );
  }

  // Removed, changed on Cron
  // async onRedisTickerUpdate(channel, message): Promise<void> {
  //   if (channel?.indexOf(`_${REDIS_ENTITY_TYPE.TICKERS}`) > 0) {
  //     const msg = JSON.parse(message);
  //     if (msg.exchangeId && channel === `${msg.exchangeId}_${REDIS_ENTITY_TYPE.TICKERS}`) {
  //       // console.log(channel, msg.exchangeId, Object.keys(msg.tickersToSave).length);
  //       await this.calculateIndicatorSignal(msg.exchangeId);
  //     }
  //   }
  // }

  async onApplicationBootstrap() {
    // ENABLED_EXCHANGES.forEach((exchange) => {
    //   this.redisTicker.subscribeTickers(exchange.exchangeId);
    // });
    // this.redisTicker.subscriber.addListener('message', (channel, message) => this.onRedisTickerUpdate(channel, message));
    await this.checkNewTickers();
  }

  async getActiveUsers(exchangeId: string): Promise<User[]> {
    const users = await this.redisUser.getUsers(true);

    return users.filter(
      (user) =>
        user.active && user.exchanges?.length && user.exchanges.find((exchange) => exchange.exchangeId === exchangeId)
    );
  }

  async startOrderJob(signal: TradeSignalType): Promise<Job<QueueParamsOpenOrder> | void> {
    // Logger.log(`OPEN ORDER ${exchangeId} ${symbol}`);
    switch (signal?.type) {
      case TADE_SIGNAL.BUY_PYRAMIDING:
      case TADE_SIGNAL.BUY_AVERAGING:
      case TADE_SIGNAL.BUY:
        await sleep(100 * Math.random());
        return this.queueService.addJob_OpenOrder(signal as TradeSignalType, { timeout: 30000 });
      case TADE_SIGNAL.SELL_PYRAMIDING:
      case TADE_SIGNAL.SELL_AVERAGING:
      case TADE_SIGNAL.SELL:
        await sleep(100 * Math.random());
        return this.queueService.addJob_OpenOrder(signal as TradeSignalType, { timeout: 30000 });
      case TADE_SIGNAL.CLOSE_ALL:
      case TADE_SIGNAL.CLOSE_DISABLED:
      case TADE_SIGNAL.CLOSE_ALL_BUY:
      case TADE_SIGNAL.CLOSE_ALL_SELL:
      case TADE_SIGNAL.CLOSE_ALL_PROFIT:
        return this.queueService.addJob_CloseOrder(signal as TradeSignalType, { timeout: 30000 });
      case TADE_SIGNAL.CLOSE:
        if (signal.orderIds?.length || signal.order) {
          return this.queueService.addJob_CloseOrder(signal as TradeSignalType, { timeout: 30000 });
        }
        break;
      case TADE_SIGNAL.CANCEL:
        await sleep(100 * Math.random());
        return this.queueService.addJob_CancelOrder(signal as TradeSignalType, { timeout: 30000 });
      default:
        break;
    }
  }

  checkUserToAllowSymbolTrade(exchangeId: string, symbol: string, user: User): boolean | null {
    if (!exchangeId?.length || !symbol?.length || !user.id?.length) {
      Logger.warn(`checkUserToAllowSymbolTrade: invalid params ${exchangeId} ${symbol} ${user.id}`);
      return null;
    }

    // Condition 7: user has no exchange config
    const userExchange = user.exchanges?.find((exConfig) => exConfig.exchangeId === exchangeId);
    if (!userExchange) {
      Logger.warn(`User ${user.id} has no exchange config for ${exchangeId}`);
      return null;
    }

    // Condition 8: user has to have the base currency
    // const baseCurrency = userExchange?.baseCurrency;
    // if (!baseCurrency?.length) {
    //   Logger.warn(`User ${user.id} has no base currency for ${exchangeId}`);
    //   return null;
    // }

    // Condition 6: user enabled only some symbols
    const userSymbol = userExchange?.symbols?.find((sym) => sym.toUpperCase() === symbol.toUpperCase());
    if (userExchange.symbols?.length && !userSymbol) {
      // Logger.warn(`User ${user.id} user enabled only some symbols, not ${exchangeId} ${symbol} in [${userExchange.symbols.toString()}]`);
      return false;
    }

    // Condition 4: user enabled only some currencies for trading
    const [base, quote] = ExchangeLibService.getCurrenciesFromSymbol(symbol);
    const baseCurrency = ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol);
    if (
      user.currencies?.length &&
      ((baseCurrency !== base && user.currencies?.indexOf(base) < 0) ||
        (baseCurrency !== quote && user.currencies?.indexOf(quote) < 0))
    ) {
      Logger.warn(`User ${user.id} enabled only some currencies for trading ${exchangeId} ${symbol}`);
      return false;
    }

    // Condition 5: user excluded the currency
    if (
      user.excludedCurrencies?.length &&
      (user.excludedCurrencies?.indexOf(base) >= 0 || user.excludedCurrencies?.indexOf(quote) >= 0)
    ) {
      Logger.warn(`User ${user.id} excluded the currency ${exchangeId} ${symbol}`);
      return false;
    }

    return true;
  }

  async check_AllUsers_OrdersSignalsCUPOStrategy(signals: StrategyIndicatorSignalsCUPO): Promise<void> {
    const { exchangeId, symbol, candles, conditions } = signals;

    if (!conditions || !exchangeId || !symbol) {
      Logger.warn(`SIGNALS are not ready for ${exchangeId} ${symbol}`);
      return;
    }

    const market = await this.redisExchange.getMarket(exchangeId, symbol);
    if (!market) {
      // Logger.warn(`[${exchangeId}] Market "${symbol}" not found`, 'check_AllUsers_OrdersSignalsCUPOStrategy');
      return;
    }

    const price = await this.redisTicker.getMarketPrice(exchangeId, symbol);
    if (!price || !price.bid || !price.ask || !price.datetime) {
      Logger.warn(`Price is not ready for ${exchangeId} ${symbol}`);
      return;
    }

    if (
      !price.bid ||
      !candles[0].high ||
      !candles[0].low ||
      (price.bid > candles[0].high * 2 && price.bid > candles[0].low * 2) ||
      (price.ask > candles[0].high * 2 && price.ask > candles[0].low * 2)
    ) {
      Logger.warn(
        `Price is too high [${exchangeId}] ${symbol}: Ticker=[${price.ask}-${price.bid}] Candle=[${candles[0].low}/${
          candles[0].high
        }] - Candle time: ${new Date(candles[0].time).toISOString()}, now time ${new Date(
          getCandleTime(TIMEFRAME.M15)
        ).toISOString()}`
      );
      await this.queueService.addJob_FetchCandles({ exchangeId, symbol, timeframe: CUPO_STRATEGY_PARAMS.timeframe });

      return;
    }
    if (
      !price.bid ||
      !candles[0].high ||
      !candles[0].low ||
      (price.bid * 2 < candles[0].high && price.bid * 2 < candles[0].low) ||
      (price.ask * 2 < candles[0].high && price.ask * 2 < candles[0].low)
    ) {
      Logger.warn(
        `Price is too low [${exchangeId}] ${symbol}: Ticker=[${price.ask}-${price.bid}] Candle=[${candles[0].low}/${
          candles[0].high
        }] - Candle time: ${new Date(candles[0].time).toISOString()}, now time ${new Date(
          getCandleTime(TIMEFRAME.M15)
        ).toISOString()}`
      );
      await this.queueService.addJob_FetchCandles({ exchangeId, symbol, timeframe: CUPO_STRATEGY_PARAMS.timeframe });

      return;
    }

    const orderSignals = [];

    const users = await this.getActiveUsers(exchangeId);
    // console.log(`check_AllUsers_OrdersSignalsCUPOStrategy: ${users.length} users`);

    for (const user of users) {
      // check disabled symbols for the user, but allow virtual orders
      if (this.checkUserToAllowSymbolTrade(exchangeId, symbol, user) != null) {
        // if (this.checkUserToAllowSymbolTrade(exchangeId, symbol, user)) {
        //   console.log(
        //     '+++  SIGNAL',
        //     user.email,
        //     exchangeId,
        //     symbol,
        //     signals?.conditions?.map((c) => c.signal).join(',')
        //   );
        // }

        // const orderSignal = await this.check_User_OrdersSignalsCUPOStrategy({ ...signals, price, market, userId: user.id });

        const status = user.exchanges?.find((exConfig) => exConfig.exchangeId === exchangeId)?.status;
        if (status !== USER_EXCHANGE_STATUS.ACTIVE) {
          const returnBalance = await this.redisOrder.cancelVirtualUserOrders({ exchangeId, userId: user.id, symbol });
          if (returnBalance) {
            Logger.warn(
              `Cancelled bad user's virtual orders [${exchangeId}] ${user.id} ${symbol}}: return balance ${returnBalance}`
            );
            await this.redisUser.increaseVirtualBalance({ userId: user.id, exchangeId, sum: returnBalance });

            // Logger.debug(`The user settings is bad [${exchangeId}] ${user.id}`);
          }

          continue;
        }

        const sigs = await this.check_User_OrdersSignalsCUPOStrategy({
          ...signals,
          price,
          market,
          user,
        } as StrategyOrderSignalsCUPO);

        // the check for signal works for every user
        if (sigs?.length) {
          // console.log('+++++++++++++ SIGNAL', user.id, exchangeId, symbol, sigs?.length);
          for (const sig of sigs) {
            await this.mongoSignal.addSignal(sig);
          }

          orderSignals.push(sigs);
        }
      }
    }

    // resolving signals Promises
    const result = (await Promise.all(orderSignals)).filter((signal) => signal?.length);

    // Open and Close orders
    if (result?.length) {
      const jobs = [];

      result.forEach((signals) => {
        signals.forEach((signal) => {
          // Logger.log(`SIGNAL ${result?.length}/${signals?.length} ${signal.type} ${signal.exchangeId} ${signal.symbol} ${signal.userId} ${signal.comment}`);
          jobs.push(this.startOrderJob(signal));
        });
      });

      await Promise.all(jobs);
    }
  }

  async check_User_OrdersSignalsCUPOStrategy(args: StrategyOrderSignalsCUPO): Promise<TradeSignalType[]> {
    const { user, exchangeId, symbol, conditions, price, market } = args;

    const signals: TradeSignalType[] = [];

    if (!exchangeId || !symbol || !conditions) {
      Logger.error(`Missing parameters ${JSON.stringify(args)}`);
      return signals;
    }

    if (!user?.exchanges?.find((ex) => ex.exchangeId === exchangeId)) {
      Logger.warn(
        `User ${userRepresentation(user)} on ${exchangeId} not found in checkUserOrdersSignalsCUPOStrategy()`
      );
      return signals;
    }
    const userId = user.id;

    const strategy = { ...CUPO_STRATEGY_PARAMS, ...(user.strategy || {}) };
    strategy.strategyId = strategy.strategyId || TRADE_STRATEGIES.CUPO;

    // const market = await this.redisExchange.getMarket(exchangeId, symbol);
    if (!market) {
      Logger.warn(`[${exchangeId}] ${symbol} missing market`);
      return signals;
    }
    // const minNotion = market.limits?.cost?.min || params.minimumLotSum;
    const minimumCost = getMinimumLotCost(strategy, market.limits?.cost?.min);
    // const minimumCost =
    //   Math.max(0.1, market.limits?.cost?.min || 0, strategy.minimumLotSum) * (1 + strategy.commissionSizePercent / 100);
    // const minimumAmount = market.limits?.amount?.min ? market.limits.amount.min * 1.01 : minimumCost / price.bid;
    const minimumAmount = Math.max(
      (market.limits?.amount?.min || 0) * (1 + strategy.commissionSizePercent / 100),
      minimumCost / price.bid
    );

    let sigCondition: StrategyCondition;

    let signal: TradeSignalType;
    let orderIdsToClose: TradeOrderIdType[];

    const realTradeAllowed =
      process.env.TRADE_REAL_ALLOWED !== '0' && process.env.TRADE_REAL_ALLOWED?.toLowerCase() !== 'false';
    let isVirtual = !realTradeAllowed;

    // already checked before
    // check user symbols and currencies only if the real trade is allowed
    if (!isVirtual && this.checkUserToAllowSymbolTrade(exchangeId, symbol, user) !== true) {
      isVirtual = true;
    }

    const baseCurrency = user?.exchanges?.find((exchange) => exchange.exchangeId === exchangeId)?.baseCurrency;
    if (!baseCurrency?.length) {
      Logger.warn(`User ${userRepresentation(user)} has no base currency for exchange ${exchangeId}`);
      return signals;
    }
    const [base] = ExchangeLibService.getCurrenciesFromSymbol(symbol);
    if (base === baseCurrency) {
      // Logger.warn(`Base currency is quoting ${symbol}`);
      return signals;
    }

    const signalTime = new Date().getTime();
    const openedSymbols = await this.redisOrder.getOrderSymbols({ userId, exchangeId, active: true, virtual: false });

    const balances = await this.redisUser.getWalletBalance(userId, exchangeId);
    const balanceReal = balances?.[baseCurrency]?.free || 0;
    const minBalanceReal = Math.max(strategy.minimumBalance, balanceReal / 4);

    // Real lots
    const newLotCostReal =
      ((strategy.strategyId === TRADE_STRATEGIES.CUPO
        ? balanceReal
        : Math.min(balanceReal, strategy.tradeBalance || 0)) *
        strategy.lotPercent) /
      100;
    const newLotAmountReal = newLotCostReal / price.ask;

    // Virtual lots
    const balanceVirtual = (await this.redisUser.getVirtualBalance({ userId, exchangeId })) || 0;
    const minBalanceVirtual = Math.max(strategy.minimumBalance, balanceVirtual / 4);
    const newLotCostVirtual = (Math.min(balanceVirtual, strategy.tradeBalance || 0) * strategy.lotPercent) / 100;
    const newLotAmountVirtual = newLotCostVirtual / price.ask;

    if (!balanceReal || balanceReal < strategy.minimumLotSum || newLotCostReal < minimumCost) {
      // Logger.debug(`User ${userId} has not enough balance: ${balance} for open $${newLotCost}/${newLotAmount}`);
      isVirtual = true;
    }

    const allOpenedOrders = await this.redisOrder.getOrders({
      userId,
      exchangeId,
      symbol,
      active: true,
      virtual: undefined,
    });

    let virtualOrders = allOpenedOrders.filter((order) => !(order.isVirtual === false));
    const realOrders = allOpenedOrders.filter((order) => order.isVirtual === false);

    // is there are real orders close all virtual orders with this symbol
    if (virtualOrders?.length && realOrders?.length) {
      const returnBalance = await this.redisOrder.cancelVirtualUserOrders({ exchangeId, userId, symbol });
      if (returnBalance) {
        Logger.warn(
          `Cancelled all virtual orders [${exchangeId}] ${userId} ${symbol}: ${allOpenedOrders?.length}, virtual: ${virtualOrders?.length}, real: ${realOrders?.length}`
        );
        await this.redisUser.increaseVirtualBalance({ userId, exchangeId, sum: returnBalance });
      }

      virtualOrders = await this.redisOrder.getOrders({ userId, exchangeId, symbol, active: true, virtual: true });
      // if not all virtual orders cancelled, then return
      if (virtualOrders?.length) {
        return signals;
      }
    }

    // const forCloseOrders = realOrders?.length ? realOrders : virtualOrders;
    // const forOpenOrders = isVirtual ? virtualOrders : realOrders;

    const orders = realOrders?.length ? realOrders : virtualOrders || [];

    const { nowSymbolCost, openSymbolCost } = orders.reduce(
      (sum, order) => ({
        nowSymbolCost:
          sum.nowSymbolCost +
          (order.status === ORDER_STATUS.OPENED
            ? price.bid * order.volume * (1 - ENABLED_EXCHANGES[exchangeId].takerFee || 0.002)
            : 0),
        openSymbolCost:
          sum.openSymbolCost +
          (order.status === ORDER_STATUS.OPENED ? order.openPrice * (order.openVolume || order.volume) : 0),
      }),
      {
        nowSymbolCost: 0,
        openSymbolCost: 0,
      }
    );
    const symbolProfitIndex = openSymbolCost ? nowSymbolCost / openSymbolCost - 1 : 0;

    // show profit into LOG if it more than 2% or if it is less than -8%
    // if (symbolProfitIndex * 100 > strategy.trailingTP || symbolProfitIndex * 100 < -1 * strategy.trailingTP * 4) {
    //   // if (symbolProfitIndex) {
    //   let minPrice = Infinity,
    //     maxPrice = 0;
    //   orders.forEach((order) => {
    //     if (order.openPrice < minPrice) {
    //       minPrice = order.openPrice;
    //     }
    //     if (order.openPrice > maxPrice) {
    //       maxPrice = order.openPrice;
    //     }
    //   });
    //
    //   const message = `PROFIT [${exchangeId}] ${userIdRepresentation(userId)} ${symbol}: ${(
    //     symbolProfitIndex * 100
    //   ).toFixed(2)}%, average: ${((minPrice / price.bid - 1) * 100).toFixed(2)}%, pyramid: ${(
    //     (price.bid / maxPrice - 1) *
    //     100
    //   ).toFixed(2)}% ${!realOrders?.length ? 'VIRTUAL' : 'REAL'}. Now/Open symbol cost: ${nowSymbolCost.toFixed(
    //     2
    //   )}/${openSymbolCost.toFixed(2)} - ${conditions.map((cond) => cond.signal).toString()}`;
    //
    //   if (!realOrders?.length) {
    //     Logger.debug(message);
    //   } else {
    //     Logger.verbose(message);
    //   }
    // }

    // ************************************************
    // ********** Trailing and update orders **********
    // ************************************************

    let symbolSL = await this.redisOrder.getSymbolStopLoss({ userId, exchangeId, symbol });
    // clear symbol SL if there are no opened orders
    if (symbolSL && !orders?.length) {
      await this.redisOrder.deleteSymbolStopLoss({ userId, exchangeId, symbol });
      symbolSL = 0;
    }

    // *** update profit into opened orders ***
    if (allOpenedOrders?.length) {
      for (const order of allOpenedOrders) {
        const profitBefore = order.profit;

        if (order.type === OPERATION_TYPE.BUY) {
          order.profit = getOpenedOrderProfit(order, price.bid);
          order.currentPrice = price.bid;
        } else if (order.type === OPERATION_TYPE.SELL) {
          order.currentPrice = price.ask;
          order.profit = getOpenedOrderProfit(order, price.ask);
        }

        if (profitBefore !== order.profit) {
          await this.redisOrder.setOrder(order);
        }
      }
    }

    // *** start trailing orders then the symbol profit is more than Take Profit ***
    if (
      (strategy.strategyId === TRADE_STRATEGIES.PAX_1 ||
        strategy.strategyId === TRADE_STRATEGIES.PAX_2 ||
        strategy.enableTrailing) &&
      orders?.length &&
      strategy.trailingStep > 0 &&
      symbolProfitIndex * 100 > Math.min(strategy.trailingTP, strategy.tpPercent) &&
      (symbolSL === 0 || symbolProfitIndex - strategy.trailingStep / 100 > symbolSL)
    ) {
      // if the profit more TP, then set trailingStep = 0.5% else set trailingStep parameter
      symbolSL = await this.redisOrder.setSymbolStopLoss(
        { exchangeId, userId, symbol },
        symbolProfitIndex * 100 > strategy.tpPercent
          ? symbolProfitIndex - Math.min(0.005, strategy.trailingStep / 100)
          : symbolProfitIndex - strategy.trailingStep / 100
      );

      const message = `TRAIL [${exchangeId}] ${userRepresentation(user)} ${symbol} profit: ${(
        symbolProfitIndex * 100
      ).toFixed(2)}% ${!realOrders?.length ? 'VIRTUAL' : 'REAL'}. New SL profit: ${(symbolSL * 100).toFixed(4)}%`;

      if (!realOrders?.length) {
        Logger.log(message);
      } else {
        Logger.verbose(message);
      }
    }

    // *** remove trailing the symbol due to the symbol profit is negative ***
    // if (strategy.strategyId === TRADE_STRATEGIES.PAX_1 && symbolProfitPercent <= 0 && symbolSL > 0) {
    //   await this.redisOrder.deleteSymbolStopLoss({ userId, exchangeId, symbol });
    //   symbolSL = 0;
    //
    //   Logger.log(
    //     `[${exchangeId}] ${userId} ${!realOrders?.length ? 'VIRTUAL' : 'REAL'}. Symbol ${symbol} REMOVED trailing SL, profit: ${symbolProfitPercent.toFixed(2)}%`
    //   );
    // }

    // **************************************
    // ********** Закрытие ордеров **********
    // **************************************

    // if REAL opened symbols count more than allowed, close the positive symbols
    if (realOrders?.length && openedSymbols?.length > strategy.maximumOpenedSymbols) {
      // Logger.log(`[${exchangeId}] [${userId}] ${symbol} Maximum opened symbols reached: ${openedSymbols?.length} > ${params.maximumOpenedSymbols}`);
      // profit is more than 0.5%
      if (symbolProfitIndex > 0.005) {
        orderIdsToClose = realOrders
          .map((order) => order.id)
          ?.filter((id) => !signals.find((sig) => sig.orderIds?.indexOf(id) >= 0));

        if (orderIdsToClose?.length) {
          const message =
            openedSymbols?.length > strategy.maximumOpenedSymbols
              ? `CLOSE orders [${exchangeId}] ${userRepresentation(
                  user
                )} ${symbol} due maximum opened symbols reached: ${openedSymbols?.length} > ${
                  strategy.maximumOpenedSymbols
                } `
              : `Price is not valid for ${exchangeId} ${symbol}: ${price.ask}/${price.bid}`;

          Logger.verbose(message);
          signal = {
            exchangeId,
            symbol,
            userId,
            type: TADE_SIGNAL.CLOSE_ALL,
            time: new Date().getTime(),
            virtual: false,
            comment: message,
          };
          signals.push(signal);

          return signals;
        }
      }
    }

    // *** close if order SL reached ***
    if (
      (strategy.strategyId === TRADE_STRATEGIES.PAX_1 || strategy.strategyId === TRADE_STRATEGIES.PAX_2) &&
      orders?.length
    ) {
      orderIdsToClose = orders
        .filter((order) => (order.stopLoss || 0) > 0 && price.bid < order.stopLoss)
        .map((order) => order.id);

      // remove already added orders
      orderIdsToClose = orderIdsToClose?.filter((id) => !signals.find((sig) => sig.orderIds?.indexOf(id) >= 0));
      if (orderIdsToClose?.length) {
        const message = `CLOSE orders [${exchangeId}] ${userRepresentation(user)} ${symbol} due order SL ${
          price.bid
        } reached: Symbol profit: ${(symbolProfitIndex * 100).toFixed(2)}% [${orderIdsToClose.toString()}]`;

        Logger.verbose(message);
        signal = {
          exchangeId,
          symbol,
          userId,
          type: TADE_SIGNAL.CLOSE,
          time: new Date().getTime(),
          virtual: !realOrders?.length,
          comment: message,
          orderIds: orderIdsToClose,
        };
        signals.push(signal);
      }
    }

    // *** CLOSE SYMBOL SL - close all orders if the symbol profit is less than SL ***
    if (
      (strategy.strategyId === TRADE_STRATEGIES.PAX_1 ||
        strategy.strategyId === TRADE_STRATEGIES.PAX_2 ||
        strategy.enableTrailing) &&
      orders?.length &&
      symbolSL > 0 &&
      symbolProfitIndex > 0.005 &&
      symbolProfitIndex < symbolSL
    ) {
      const message = `SYMBOL SL reached ${(symbolSL * 100).toFixed(4)}%. Symbol profit: ${(
        symbolProfitIndex * 100
      ).toFixed(4)}%`;

      if (isVirtual) {
        Logger.log(`CLOSE orders [${exchangeId}] ${userRepresentation(user)} ${symbol} due ${message}`);
      } else {
        Logger.verbose(`CLOSE orders [${exchangeId}] ${userRepresentation(user)} ${symbol} due ${message}`);
      }

      signal = {
        exchangeId,
        symbol,
        userId,
        type: TADE_SIGNAL.CLOSE_ALL,
        time: new Date().getTime(),
        virtual: !realOrders?.length,
        comment: message,
      };
      signals.push(signal);

      return signals;
    }

    // MACD CLOSE
    // Если MACD показывает открытие короткой позиции, нужно закрыть все открытые ордера
    sigCondition = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.OPEN_SHORT_MACD);
    if (
      (strategy.strategyId === TRADE_STRATEGIES.PAX_1 || strategy.strategyId === TRADE_STRATEGIES.PAX_2) &&
      sigCondition &&
      orders?.length
    ) {
      orderIdsToClose = orders
        .filter(
          (order) =>
            // if order in profit with a fee
            price.bid / order.openPrice > 1.005
        )
        .map((order) => order.id)
        .filter((id) => !signals.find((sig) => sig.orderIds?.indexOf(id) >= 0));

      if (orderIdsToClose?.length) {
        signal = {
          userId,
          exchangeId,
          symbol,
          type: TADE_SIGNAL.CLOSE,
          time: sigCondition?.candleTime,
          comment: `IDX ЗАКРЫТИЕ: ${sigCondition?.comment}`,
          orderIds: orderIdsToClose,
        };
        signals.push(signal);
      }
    }

    // 8. ЗАКРЫТИЕ ОРДЕРОВ ПРИ РОСТЕ ЦЕНЫ происходит по индикатору
    // U-Up Orders %” 10%,
    if (strategy.strategyId === TRADE_STRATEGIES.CUPO && orders?.length) {
      const ordersToClose: TradeOrder[] = orders.filter(
        (order) =>
          // if order in profit with a fee
          price.bid / order.openPrice > 1.005
      );

      // Допустим открыт ордер №1 и цена выросла на “U-Up Orders %” 10%, а цвет линии красный “U-Time 2” 4Ч тогда робот закрывает ордер №1.
      // Если цена росла и в процессе открылось от 2-х ордеров и более,
      // то при изменении цвета линии “U-Time 2” 4Ч с зеленого на красный - закрываются все ордера которые находятся в плюсе,
      // а те что в минусе остаются и с этого момента начинает действовать пункт №4.
      sigCondition = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.HIGH_TREND_DOWN);
      if (sigCondition) {
        orderIdsToClose =
          ordersToClose
            .filter((order) => price.bid / order.openPrice > 1 + (strategy.uUpOrdersPricePercent || 10) / 100)
            ?.map((order) => order.id) || [];
      } else {
        orderIdsToClose = [];
      }

      orderIdsToClose = orderIdsToClose?.filter((id) => !signals.find((sig) => sig.orderIds?.indexOf(id) >= 0));
      if (orderIdsToClose?.length) {
        signal = {
          userId: userId,
          exchangeId,
          symbol,
          type: TADE_SIGNAL.CLOSE,
          virtual: !realOrders?.length,
          time: signalTime,
          comment: `8. ЗАКРЫТИЕ ОРДЕРОВ ПРИ РОСТЕ ЦЕНЫ: ${sigCondition?.comment || 'Take profit'}`,
          orderIds: orderIdsToClose,
        };
        signals.push(signal);
      }
    }

    // 6. ЗАКРЫТИЕ ОРДЕРОВ ПРИ ПАДЕНИИ ЦЕНЫ происходит по индикатору
    // CM_Ultimate_MA_MTF_V2 (из TradingView) U-Time 1
    sigCondition = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.TREND_DOWN);
    if (strategy.strategyId === TRADE_STRATEGIES.CUPO && orders?.length > 1) {
      orderIdsToClose = orders
        .filter(
          (order) =>
            // only for Averaging orders
            order.signal === TADE_SIGNAL.BUY_AVERAGING &&
            // if order in profit with a fee
            price.bid / order.openPrice > 1.005 &&
            // ahs no TP and price diff > tpPercent
            ((!order.takeProfit && price.bid / order.openPrice > 1 + (strategy.tpPercent || 1) / 100) ||
              // or Bid > TP
              (order.takeProfit && price.bid > order.takeProfit)) &&
            // trend down
            sigCondition
        )
        .map((order) => order.id);

      orderIdsToClose = orderIdsToClose?.filter((id) => !signals.find((sig) => sig.orderIds?.indexOf(id) >= 0));
      if (orderIdsToClose?.length) {
        signal = {
          userId,
          exchangeId,
          symbol,
          type: TADE_SIGNAL.CLOSE,
          virtual: !realOrders?.length,
          time: signalTime,
          comment: `6. ЗАКРЫТИЕ ОРДЕРОВ ПРИ ПАДЕНИИ ЦЕНЫ: ${sigCondition?.comment || 'Take profit'}`,
          orderIds: [...orderIdsToClose],
        };
        signals.push(signal);
      }
    }

    // 9. ЗАКРЫТИЕ ГРУППЫ ОРДЕРОВ ПО ТП
    sigCondition = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.HIGH_TREND_DOWN);
    if (strategy.strategyId === TRADE_STRATEGIES.CUPO && orders?.length >= strategy.orderGroupSize) {
      orderIdsToClose = [];
      if (
        orders.every(
          (order) =>
            // if order in profit with a fee
            price.bid / order.openPrice > 1.005 &&
            sigCondition &&
            price.bid / order.openPrice > 1 + (strategy.orderGroupTPPercent || 1) / 100
        )
      ) {
        orderIdsToClose = orders.map((order) => order.id);
      }

      orderIdsToClose = orderIdsToClose?.filter((id) => !signals.find((sig) => sig.orderIds?.indexOf(id) >= 0));
      if (orderIdsToClose?.length) {
        signal = {
          exchangeId,
          symbol,
          userId,
          type: TADE_SIGNAL.CLOSE_ALL,
          time: signalTime,
          virtual: !realOrders?.length,
          comment: `9. ЗАКРЫТИЕ ГРУППЫ ОРДЕРОВ ПО ТП: ${sigCondition?.comment || 'Take profit'}`,
        };
        signals.push(signal);

        return signals;
      }
    }

    // 7. ЗАКРЫТИЕ Если цена росла и в процессе открылось несколько ордеров,
    // то при изменении цвета линии с зеленого на красный - закрываются все ордера которые находятся в плюсе.
    // Условие начинает работать с ордера №2.
    sigCondition = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.HIGH_TREND_DOWN);
    if (strategy.strategyId === TRADE_STRATEGIES.CUPO && orders?.length > 1 && sigCondition) {
      const closeOrders = orders.filter(
        (order) =>
          // if order in profit with a fee
          price.bid / order.openPrice > 1.005
      );

      for (const order of closeOrders) {
        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_INFO,
          event: 'Try to close order',
          data: {
            price,
            openPrice: order.openPrice,
            volume: order.volume,
            cause: `7. закрываются все ордера которые находятся в плюсе: ${sigCondition.comment}`,
          },
        });
      }

      orderIdsToClose = closeOrders
        .map((order) => order.id)
        .filter((id) => !signals.find((sig) => sig.orderIds?.indexOf(id) >= 0));
      if (orderIdsToClose?.length) {
        signal = {
          userId: userId,
          exchangeId,
          symbol,
          type: TADE_SIGNAL.CLOSE,
          virtual: !realOrders?.length,
          time: signalTime,
          comment: `7. закрываются все ордера которые находятся в плюсе: ${sigCondition.comment}`,
          orderIds: orderIdsToClose,
        };
        signals.push(signal);
      }
    }

    // Close orders, then open new orders on the next signal
    if (signals.length > 0) {
      return signals;
    }

    // **************************************
    // ********** Открытие ордеров **********
    // **************************************

    // Disallow to trade for CUPO users, if they don't set up the symbols
    if (!strategy.emptySymbolsListIsAllSymbols) {
      const exchange = user.exchanges?.find((ex) => ex.exchangeId === exchangeId && ex.symbols?.length);
      if (!exchange?.symbols?.length || exchange.symbols.indexOf(symbol) < 0) {
        return signals;
      }
    }

    // if the last order was opened less than 1 minute, don't open a new order
    // it needs to don't open too much orders in a short time on the different trader containers
    const lastOpenedOrder = await this.redisOrder.getLastOpenedOrder({ exchangeId, userId });
    if (lastOpenedOrder > Date.now() - OPEN_ORDER_PAUSE) {
      return signals;
    }

    // *** cancel all virtual orders and don't open new virtual orders, if the user settings don't allow that ***
    if (isVirtual && !strategy.virtualOrdersAllowed) {
      if (virtualOrders?.length) {
        const returnBalance = await this.redisOrder.cancelVirtualUserOrders({ exchangeId, userId, symbol });
        if (returnBalance) {
          Logger.warn(
            `Cancelled all virtual orders [${exchangeId}] ${userId} ${symbol}: ${allOpenedOrders?.length}, virtual: ${virtualOrders?.length}, real: ${realOrders?.length}`
          );
          await this.redisUser.increaseVirtualBalance({ userId, exchangeId, sum: returnBalance });
        }
      }

      return signals;
    }

    const orderId = await this.redisOrder.isSymbolPendingOpen(exchangeId, symbol, user.id);
    if (orderId?.length) {
      Logger.warn(`Waiting for PENDING order: [${exchangeId}] ${symbol} UserId: ${user.id} OrderId: ${orderId}`);
      return signals;
    }

    // *** OPEN FIRST ORDER CUPO
    sigCondition = conditions.find((condition) => condition.signal === INDICATOR_SIGNAL.OPEN_LONG_NEW);
    if (
      strategy.strategyId === TRADE_STRATEGIES.CUPO &&
      sigCondition &&
      // Real orders or virtual and no real orders
      ((isVirtual && balanceVirtual >= minBalanceVirtual && !virtualOrders?.length && !realOrders?.length) ||
        (!isVirtual &&
          balanceReal >= minBalanceReal &&
          !realOrders?.length &&
          openedSymbols?.length < (strategy.maximumOpenedSymbols || 8)))
    ) {
      let order: TradeOrder = {
        exchangeId,
        symbol,
        userId,
        isVirtual,
        type: OPERATION_TYPE.BUY,
        signal: TADE_SIGNAL.BUY,
        status: ORDER_STATUS.WAIT_OPEN,
        signalTime: signalTime,
        comment: sigCondition.comment,
        openTime: Date.now(),
        openPrice: price.ask,
        volume: isVirtual ? newLotAmountVirtual : newLotAmountReal,
        stopLoss: 0,
        takeProfit: 0,
        client: this.managerId,
      };
      order = await this.redisOrder.setOrder(order);
      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_CREATED,
      });

      // block semaphore
      await this.redisOrder.startPendingOrder(exchangeId, symbol, userId, order.id);

      signal = {
        userId,
        exchangeId,
        symbol,
        type: TADE_SIGNAL.BUY,
        virtual: !realOrders?.length,
        time: sigCondition.candleTime,
        comment: sigCondition.comment,
        order,
      };
      signals.push(signal);

      return signals;
    }

    // *** MACD OPEN FIRST ORDER
    sigCondition = conditions.find((condition) => condition.signal === INDICATOR_SIGNAL.OPEN_LONG_MACD);
    if (
      // user strategy allow trading by MACD
      strategy.strategyId === TRADE_STRATEGIES.PAX_1 &&
      // MACD indicator signal
      sigCondition &&
      // Real orders or virtual and no real orders
      ((isVirtual && !virtualOrders?.length && !realOrders?.length && balanceVirtual >= minBalanceVirtual) ||
        (!isVirtual &&
          !realOrders?.length &&
          balanceReal >= minBalanceReal &&
          openedSymbols?.length < (strategy.maximumOpenedSymbols || 8)))
    ) {
      // Logger.warn(
      //   `isVirtual: ${isVirtual}, Allow: ${this.checkUserToAllowSymbolTrade(exchangeId, symbol, user)}, ask: ${
      //     price.ask
      //   }, baseCurrency: ${baseCurrency} Balance: ${balances?.[baseCurrency]?.free || 0} > min: ${params.minimumBalance}, newLotCost: ${
      //     ((balances?.[baseCurrency]?.free || 0) * params.lotPercent) / 100
      //   } > minimumCost: ${Math.max(0.1, Math.max(market.limits?.cost?.min || 0, params.minimumLotSum) * (1 + params.commissionSizePercent / 100))}`
      // );
      // Logger.error(
      //   `MACD OPEN FIRST ORDER *** ${exchangeId}, ${symbol}, ${userId}, ${sigCondition.signal}, ${params.allowOpenOnMACD} ${
      //     !isVirtual || (isVirtual && !realOrders?.length)
      //   } ${!forOpenOrders?.length}, ${balance}/${params.minimumBalance}, ${
      //     isVirtual || (!isVirtual && (openedSymbols?.length || 0) < (params.maximumOpenedSymbols || 8))
      //   }`
      // );

      let order: TradeOrder = {
        exchangeId,
        symbol,
        userId,
        isVirtual,
        type: OPERATION_TYPE.BUY,
        signal: TADE_SIGNAL.BUY,
        status: ORDER_STATUS.WAIT_OPEN,
        signalTime: signalTime,
        comment: sigCondition?.comment,
        openTime: Date.now(),
        openPrice: price.ask,
        volume: isVirtual ? newLotAmountVirtual : newLotAmountReal,
        stopLoss: 0,
        takeProfit: 0,
        client: this.managerId,
      };

      order = await this.redisOrder.setOrder(order);
      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_CREATED,
      });

      // block semaphore
      await this.redisOrder.startPendingOrder(exchangeId, symbol, userId, order.id);

      signal = {
        userId,
        exchangeId,
        symbol,
        type: TADE_SIGNAL.BUY,
        virtual: !realOrders?.length,
        time: sigCondition?.candleTime,
        comment: sigCondition?.comment,
        order,
      };
      signals.push(signal);

      return signals;
    }

    // *** EMA OPEN FIRST ORDER
    const conditionMACD = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.OPEN_LONG_MACD);
    const conditionEMA = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.EMA_PRICE_LOWER);
    const conditionTrend = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.TREND_UP);
    if (
      // user strategy allow trading by EMA
      strategy.strategyId === TRADE_STRATEGIES.PAX_2 &&
      // EMA indicator signal
      conditionEMA &&
      (conditionMACD || conditionTrend) &&
      // Real orders or virtual and no real orders
      ((isVirtual && balanceVirtual >= minBalanceVirtual && !virtualOrders?.length && !realOrders?.length) ||
        (!isVirtual &&
          !realOrders?.length &&
          balanceReal >= minBalanceReal &&
          openedSymbols?.length < (strategy.maximumOpenedSymbols || 8)))
    ) {
      let order: TradeOrder = {
        exchangeId,
        symbol,
        userId,
        isVirtual,
        type: OPERATION_TYPE.BUY,
        signal: TADE_SIGNAL.BUY,
        status: ORDER_STATUS.WAIT_OPEN,
        signalTime: signalTime,
        comment: sigCondition?.comment,
        openTime: Date.now(),
        openPrice: price.ask,
        volume: isVirtual ? newLotAmountVirtual : newLotAmountReal,
        stopLoss: 0,
        takeProfit: 0,
        client: this.managerId,
      };

      order = await this.redisOrder.setOrder(order);

      // block semaphore
      await this.redisOrder.startPendingOrder(exchangeId, symbol, userId, order.id);

      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_CREATED,
      });

      signal = {
        userId,
        exchangeId,
        symbol,
        type: TADE_SIGNAL.BUY,
        virtual: !realOrders?.length,
        time: sigCondition?.candleTime,
        comment: sigCondition?.comment,
        order,
      };
      signals.push(signal);

      return signals;
    }

    // 4. ОТКРЫТИЕ ОРДЕРОВ ПРИ ПАДЕНИИ ЦЕНЫ
    sigCondition = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.OPEN_LONG_NEW);

    // if (strategy.strategyId === TRADE_STRATEGIES.PAX_2 && emaConditions?.length >= 2) {
    //   let minPrice = Infinity;
    //   forCloseOrders.forEach((order) => {
    //     if (order.openPrice < minPrice) {
    //       minPrice = order.openPrice;
    //     }
    //   });
    //
    //   console.log(
    //     '******* EMA',
    //     exchangeId,
    //     symbol,
    //     emaConditions.find((condition) => condition.signal === INDICATOR_SIGNAL.EMA_PRICE_LOWER),
    //     forCloseOrders?.length,
    //     // !isVirtual,
    //     // isVirtual && !realOrders?.length,
    //     realOrders?.length === 0,
    //     minPrice,
    //     price.ask,
    //     (minPrice / price.ask) * 100 - 100,
    //     (strategy.stepPricePercent || 1) *
    //       (forCloseOrders.length >= 2 && (strategy.xStepMultiplier || 1) ? strategy.xStepMultiplier : 1),
    //     (minPrice / price.ask) * 100 - 100 >
    //       (strategy.stepPricePercent || 1) *
    //         (forCloseOrders.length >= 2 && (strategy.xStepMultiplier || 0) ? strategy.xStepMultiplier : 1)
    //   );
    // }

    // if (strategy.strategyId === TRADE_STRATEGIES.PAX_1 && conditionMACD) {
    //   if (realOrders?.length || virtualOrders?.length) {
    //     const orders = realOrders?.length ? realOrders : virtualOrders || [];
    //
    //     let minPrice = Infinity,
    //       minPriceVolume;
    //     orders.forEach((order) => {
    //       if (order.openPrice < minPrice) {
    //         minPrice = order.openPrice;
    //         minPriceVolume = order.volume;
    //       }
    //     });
    //
    //     console.log(
    //       '******* MACD',
    //       exchangeId,
    //       symbol,
    //       userId,
    //       virtualOrders?.length,
    //       realOrders?.length,
    //       balanceReal,
    //       balanceVirtual,
    //       strategy.minimumLotSum,
    //       isVirtual,
    //       !!(balanceVirtual >= strategy.minimumLotSum && virtualOrders?.length && !realOrders?.length),
    //       !!(balanceReal >= strategy.minimumLotSum && realOrders?.length),
    //       minPrice,
    //       price.ask,
    //       minPriceVolume,
    //       (minPrice / price.ask) * 100 - 100,
    //       (strategy.stepPricePercent || 1) *
    //         (orders.length >= 2 && (strategy.xStepMultiplier || 0) ? strategy.xStepMultiplier : 1),
    //       (minPrice / price.ask) * 100 - 100 >
    //         (strategy.stepPricePercent || 1) *
    //           (orders.length >= 2 && (strategy.xStepMultiplier || 0) ? strategy.xStepMultiplier : 1)
    //     );
    //   }
    // }

    if (
      ((strategy.strategyId === TRADE_STRATEGIES.CUPO && sigCondition) ||
        (strategy.strategyId === TRADE_STRATEGIES.PAX_1 && conditionMACD) ||
        (strategy.strategyId === TRADE_STRATEGIES.PAX_2 && conditionEMA && (conditionMACD || conditionTrend))) &&
      // There are real or virtual orders
      ((!realOrders?.length && virtualOrders?.length && balanceVirtual >= strategy.minimumLotSum) ||
        (realOrders?.length && balanceReal >= strategy.minimumLotSum))
    ) {
      // const minPrice = Math.min(...orders.map((order) => order.openPrice));
      let minPrice = Infinity,
        minPriceVolume;
      orders.forEach((order) => {
        if (order.openPrice < minPrice) {
          minPrice = order.openPrice;
          minPriceVolume = order.volume;
        }
      });

      // if (condition || debug) {
      //   Logger.error(
      //     `4. order ${exchangeId} ${symbol} ${userId}: ${condition?.comment}, Virtual: ${!isVirtual || (isVirtual && !realOrders?.length)} OpenedOrders: ${
      //       forCloseOrders?.length
      //     } Balance: ${balance}/${params.minimumBalance} Opened symbols: ${openedSymbols?.length}/${params.maximumOpenedSymbols || 8}
      //     Condition: ${price.bid / minPrice}/${
      //       1 - ((params.stepPricePercent || 1) / 100) * (forCloseOrders.length >= 2 && (params.xStepMultiplier || 0) ? params.xStepMultiplier : 1)
      //     }`
      //   );
      // }

      if (
        minPrice &&
        minPriceVolume &&
        (minPrice / price.ask) * 100 - 100 >
          (strategy.stepPricePercent || 1) *
            (orders.length >= 2 && (strategy.xStepMultiplier || 0) ? strategy.xStepMultiplier : 1)
      ) {
        // Logger.warn(
        //   `isVirtual: ${isVirtual}, Allow: ${this.checkUserToAllowSymbolTrade(exchangeId, symbol, user)}, ask: ${
        //     price.ask
        //   }, baseCurrency: ${baseCurrency} Balance: ${balances?.[baseCurrency]?.free || 0} > min: ${minBalance}, newLotCost: ${
        //     ((balances?.[baseCurrency]?.free || 0) * strategy.lotPercent) / 100
        //   } > minimumCost: ${Math.max(0.1, Math.max(market.limits?.cost?.min || 0, strategy.minimumLotSum) * (1 + strategy.commissionSizePercent / 100))}`
        // );
        // if (!sigCondition && conditionMACD) {
        //   Logger.error(
        //     `MACD OPEN AVERAGING ORDER *********************************** ${exchangeId}, ${symbol}, ${userId} = ${minPrice / price.bid - 1} > ${
        //       ((strategy.stepPricePercent || 1) / 100) * (forCloseOrders.length >= 2 && (strategy.xStepMultiplier || 0) ? strategy.xStepMultiplier : 1)
        //     }`
        //   );
        // }

        let order: TradeOrder = {
          exchangeId,
          symbol,
          userId,
          isVirtual: realOrders?.length === 0,
          type: OPERATION_TYPE.BUY,
          signal: TADE_SIGNAL.BUY_AVERAGING,
          status: ORDER_STATUS.WAIT_OPEN,
          signalTime,
          openTime: Date.now(),
          openPrice: price.ask,
          volume: minPriceVolume * (1 + (strategy.xLotPercent || 0) / 100),
          stopLoss: 0,
          takeProfit: strategy.tpShift ? minPrice : price.ask * (1 + strategy.tpPercent / 100),
          client: this.managerId,
        };
        if (strategy.strategyId === TRADE_STRATEGIES.CUPO) {
          order.comment = `4. ОТКРЫТИЕ ОРДЕРОВ ПРИ ПАДЕНИИ ЦЕНЫ. Ордер №${(orders?.length || 0) + 1}`;
        } else if (strategy.strategyId === TRADE_STRATEGIES.PAX_1) {
          order.comment = `Averaging MACD, Order №${(orders?.length || 0) + 1}`;
        } else if (strategy.strategyId === TRADE_STRATEGIES.PAX_2) {
          order.comment = `Averaging EMA, Order №${(orders?.length || 0) + 1}`;
        }
        order = await this.redisOrder.setOrder(order);
        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_CREATED,
        });

        // block semaphore
        await this.redisOrder.startPendingOrder(exchangeId, symbol, userId, order.id);

        signal = {
          userId,
          exchangeId,
          symbol,
          type: TADE_SIGNAL.BUY_AVERAGING,
          virtual: !realOrders?.length,
          time: signalTime,
          order,
        };
        if (strategy.strategyId === TRADE_STRATEGIES.CUPO) {
          signal.comment = sigCondition?.comment;
        } else if (strategy.strategyId === TRADE_STRATEGIES.PAX_1) {
          signal.comment = conditionMACD?.comment;
        } else if (strategy.strategyId === TRADE_STRATEGIES.PAX_2) {
          signal.comment = conditionEMA?.comment;
        }
        signals.push(signal);

        return signals;
      }
    }

    // 7. ОТКРЫТИЕ ОРДЕРОВ ПРИ РОСТЕ ЦЕНЫ
    sigCondition = conditions?.find((condition) => condition.signal === INDICATOR_SIGNAL.HIGH_TREND_UP);
    if (
      sigCondition &&
      // There are real or virtual orders
      ((!realOrders?.length &&
        virtualOrders?.length &&
        balanceVirtual >= strategy.minimumLotSum &&
        virtualOrders.length < strategy.orderGroupSize) ||
        (realOrders?.length && balanceReal >= strategy.minimumLotSum && realOrders.length < strategy.orderGroupSize))
    ) {
      let maxPrice = 0,
        maxPriceVolume;
      orders.forEach((order) => {
        if (order.openPrice > maxPrice) {
          maxPrice = order.openPrice;
          maxPriceVolume = order.volume;
        }
      });

      // if (debug) {
      //   Logger.error(
      //     `7. order ${exchangeId} ${symbol} ${userId}: ${condition?.comment}, Virtual: ${!isVirtual || (isVirtual && !realOrders?.length)} OpenedOrders: ${
      //       forOpenOrders?.length
      //     } Balance: ${balance}/${params.minimumBalance} Opened symbols: ${openedSymbols?.length}/${params.maximumOpenedSymbols || 8}
      //     Condition: ${maxPriceVolume && price.ask / maxPrice}/${1 + (params.uUpOrdersPricePercent || 1) / 100}`
      //   );
      // }

      if (maxPriceVolume && (price.ask / maxPrice) * 100 - 100 > (strategy.uUpOrdersPricePercent || 1)) {
        let order: TradeOrder = {
          isVirtual: !realOrders?.length,
          userId: userId,
          exchangeId,
          symbol,
          type: OPERATION_TYPE.BUY,
          signal: TADE_SIGNAL.BUY_PYRAMIDING,
          status: ORDER_STATUS.WAIT_OPEN,
          signalTime: signalTime,
          comment: `7. ОТКРЫТИЕ ОРДЕРОВ ПРИ РОСТЕ ЦЕНЫ. Ордер №${(orders?.length || 0) + 1}: ${sigCondition.comment}`,
          openTime: Date.now(),
          openPrice: price.ask,
          volume: Math.max(
            maxPriceVolume
              ? Math.max(maxPriceVolume * (1 - (strategy.uDownVolumePercent || 0) / 100), minimumAmount)
              : 0,
            minimumAmount
          ),
          stopLoss: 0,
          takeProfit: 0,
          client: this.managerId,
        };

        order = await this.redisOrder.setOrder(order);
        await this.event.addOrderEvent(order, {
          type: EVENT_TYPE.ORDER_CREATED,
        });

        // block semaphore
        await this.redisOrder.startPendingOrder(exchangeId, symbol, userId, order.id);

        signal = {
          exchangeId,
          symbol,
          userId,
          type: TADE_SIGNAL.BUY_PYRAMIDING,
          virtual: !realOrders?.length,
          time: signalTime,
          comment: `7. ОТКРЫТИЕ ОРДЕРОВ ПРИ РОСТЕ ЦЕНЫ. Ордер №${(orders?.length || 0) + 1}: ${sigCondition.comment}`,
          order,
        };
        signals.push(signal);

        return signals;
      }
    }

    return signals;
  }

  async checkIndicatorSignalsCUPOStrategy(
    exchangeId: string,
    symbol: string
  ): Promise<StrategyIndicatorSignalsCUPO | null> {
    // Get all signals for this exchange/symbol/timeframe
    // 2. Check if there is a signal for this candle
    // 3. If there is a signal, execute the strategy
    // 4. If there is no signal, do nothing
    // 5. Save the signal in the database
    // 6. Return the signal
    // 7. If there is no signal, return null

    let checkFailed = false;

    const params: StrategyParameters = CUPO_STRATEGY_PARAMS;
    const timeframe = params.timeframe as TIMEFRAME;
    const uTimeframe1 = params.uTimeframe1 as TIMEFRAME;
    const uTimeframe2 = params.uTimeframe2 as TIMEFRAME;

    if ((await this.redisExchange.isBadSymbol(exchangeId, symbol, timeframe)) >= BAD_SYMBOL_FRINGE) {
      return undefined;
    }

    const price = await this.redisTicker.getMarketPrice(exchangeId, symbol);
    if (!price || (!price.ask && !price.bid) || !price.timestamp) {
      Logger.debug(
        `No price found for ${exchangeId} ${symbol} ${timeframe}: ${JSON.stringify(price || {})}`,
        'SignalService.checkIndicatorSignalsCUPOStrategy'
      );
      checkFailed = true;
    }

    // Current timeframe

    // let nowCandle = getCandleTime(timeframe.toString());
    // let firstCandle = getCandleTimeByShift(timeframe.toString(), 1);

    const candles = await this.redisCandles.getCandles({ exchangeId, symbol, timeframe });
    // const zeroCandle = getZeroCandle(timeframe as TIMEFRAME, candles);
    const closedCandle = getClosedCandle(timeframe as TIMEFRAME, candles);

    // at least 5 candles are needed to calculate the indicators
    if (!closedCandle || candles?.length < 5) {
      const update = (await this.redisCandles.getCandlesLastRequest(exchangeId, symbol, timeframe)) || 0;
      if (Date.now() - update > CANDLE_UPDATE_TIMEOUT) {
        await this.redisCandles.setCandlesLastRequest(exchangeId, symbol, timeframe);
        // Logger.debug(`Candles are not ready for ${exchangeId} ${symbol} ${timeframe}`);

        await this.queueService.addJob_FetchCandles({ exchangeId, symbol, timeframe });
      }

      checkFailed = true;
    }

    const indicatorsBase = await this.redisIndicator.getIndicatorsValues(exchangeId, symbol, timeframe);
    // at least 5 indicators are needed to calculate the indicators
    if (indicatorsBase?.length < 3 || !candles?.length || indicatorsBase[0]?.time !== candles[0]?.time) {
      const update = (await this.redisCandles.getCandlesLastRequest(exchangeId, symbol, timeframe)) || 0;
      if (Date.now() - update > CANDLE_UPDATE_TIMEOUT) {
        await this.redisCandles.setCandlesLastRequest(exchangeId, symbol, timeframe);
        // Logger.debug(`Indicators are not ready for ${exchangeId} ${symbol} ${timeframe}`);

        await this.queueService.addJob_FetchCandles({ exchangeId, symbol, timeframe });
      }

      checkFailed = true;
    }

    // High Timeframe 1
    // let nowCandle = getCandleTime(uTimeframe1.toString());
    // let firstCandle = getCandleTimeByShift(uTimeframe1.toString(), 1);
    const indicatorsU1 = await this.redisIndicator.getIndicatorsValues(
      exchangeId,
      symbol,
      uTimeframe1,
      // getHighTimeframe(timeframe, 2),
      2,
      'CM_Ultimate_MTF_V2_tf0_period20_t3factor7_mamode0_smooth1'
    );
    if (!indicatorsU1?.length || indicatorsU1[0]?.time !== getCandleTime(uTimeframe1 as TIMEFRAME, candles[0]?.time)) {
      const update = await this.redisCandles.getCandlesLastRequest(exchangeId, symbol, uTimeframe1);
      if (Date.now() - update > CANDLE_UPDATE_TIMEOUT) {
        await this.redisCandles.setCandlesLastRequest(exchangeId, symbol, uTimeframe1);
        // Logger.debug(
        //   `Indicators are not ready for ${exchangeId} ${symbol} ${uTimeframe1} - ${indicatorsU1?.length} ${indicatorsU1[0]?.time} ${getCandleTime(
        //     uTimeframe1 as TIMEFRAME,
        //     candles[0]?.time
        //   )}`
        // );

        await this.queueService.addJob_FetchCandles({ exchangeId, symbol, timeframe: uTimeframe1 });
      }

      checkFailed = true;
    }

    // High Timeframe 2
    // nowCandle = getCandleTime(uTimeframe2.toString());
    // firstCandle = getCandleTimeByShift(uTimeframe2.toString(), 1);
    const indicatorsU2 = await this.redisIndicator.getIndicatorsValues(
      exchangeId,
      symbol,
      uTimeframe2,
      // getHighTimeframe(timeframe, 3),
      2,
      'CM_Ultimate_MTF_V2_tf0_period20_t3factor7_mamode0_smooth1'
    );

    // console.log(
    //   indicatorsU2?.length,
    //   candles?.length,
    //   new Date(indicatorsU2?.[0]?.time),
    //   new Date(getCandleTime(uTimeframe2 as TIMEFRAME, candles?.[0]?.time)),
    //   new Date(candles?.[0]?.time)
    // );

    if (
      !indicatorsU2?.length ||
      indicatorsU2?.[0]?.time !== getCandleTime(uTimeframe2 as TIMEFRAME, candles?.[0]?.time)
    ) {
      const update = await this.redisCandles.getCandlesLastRequest(exchangeId, symbol, uTimeframe2);
      if (Date.now() - update > CANDLE_UPDATE_TIMEOUT) {
        await this.redisCandles.setCandlesLastRequest(exchangeId, symbol, uTimeframe2);
        // Logger.debug(`Indicators are not ready for ${exchangeId} ${symbol} ${uTimeframe2}`);
        // Logger.debug(
        //   `Indicators are not ready for ${exchangeId} ${symbol} ${uTimeframe2} - ${indicatorsU2?.length} ${indicatorsU2[0]?.time} ${getCandleTime(
        //     uTimeframe2 as TIMEFRAME,
        //     candles[0]?.time
        //   )}`
        // );

        await this.queueService.addJob_FetchCandles({ exchangeId, symbol, timeframe: uTimeframe2 });
      }

      checkFailed = true;
    }

    // exit while candles will be updated
    if (checkFailed) {
      return null;
    }

    // Check strategy indicators
    const conditions = cupoIndicatorsStrategy({
      exchangeId,
      symbol,
      timeframe,
      params,
      price,
      candles,
      indicatorsBase,
      indicatorsU1,
      indicatorsU2,
    });
    if (!conditions.length) {
      Logger.warn(`No signal conditions [${exchangeId}] ${symbol} ${timeframe}`);

      await this.redisExchange.setBadSymbol(exchangeId, symbol, timeframe);

      return null;
    }

    return {
      exchangeId,
      symbol,
      conditions,
      candles,
      indicatorsBase,
      indicatorsU1,
      indicatorsU2,
    } as StrategyIndicatorSignalsCUPO;
  }

  async clearCalculateSignalsQueue(currentJob: Job<QueueParamsCalculateIndicatorSignal>): Promise<number> {
    return this.queueService.clearCalculateSignalsQueue(currentJob);
  }

  async addJob_checkSignalsOpenUserOrdersProcessor(signals: StrategyIndicatorSignalsCUPO): Promise<void> {
    const { exchangeId, symbol, conditions } = signals;

    performance.now();

    if (!conditions || !exchangeId || !symbol) {
      Logger.warn(`SIGNALS are not ready for ${exchangeId} ${symbol}`);
      return;
    }

    await this.queueService.addJob_CheckOrdersSignals({ ...signals });

    // const price = await this.redisTicker.getMarketPrice(exchangeId, symbol);
    // if (!price || !price.bid || !price.ask || !price.datetime) {
    //   Logger.warn(`Price is not ready for ${exchangeId} ${symbol}`);
    //   return;
    // }
    //
    // const market = await this.redisExchange.getMarket(exchangeId, symbol);
    // if (!market) {
    //   Logger.warn(`Market is not ready for ${exchangeId} ${symbol}`);
    //   return;
    // }
    //
    // const jobs = [];
    // const users = await this.getActiveUsers();
    // for (const user of users) {
    //   if (this.checkUserToAllowSymbolTrade(exchangeId, symbol, user) != null) {
    //     await this.queueService.addJob_CheckOrdersSignals({ ...signals, price, market, userId: user.id });
    //   }
    //   // if (this.checkUserToAllowSymbolTrade(exchangeId, symbol, user) != null) {
    //   //   jobs.push(this.queueService.addJob_CheckOrdersSignals({ ...signals, price, market, userId: user.id }));
    //   // }
    //
    //   // fixme: remove this code after checked the code above
    //   // if (user.id && user.exchanges?.find((exConfig) => exConfig.exchangeId === exchangeId)) {
    //   //   // Condition 7: user has no exchange config
    //   //   const userExchange = user.exchanges?.find((exConfig) => exConfig.exchangeId === exchangeId);
    //   //   if (!userExchange) {
    //   //     Logger.warn(`User ${user.id} has no exchange config for ${exchangeId}`);
    //   //     continue;
    //   //   }
    //   //
    //   //   // Condition 6: user enabled only some symbols
    //   //   const userSymbol = userExchange?.symbols?.find((sym) => sym.toUpperCase() === symbol.toUpperCase());
    //   //   if (userExchange.symbols?.length && !userSymbol) {
    //   //     // Logger.warn(`User ${user.id} user enabled only some symbols, not ${exchangeId} ${symbol}`);
    //   //     continue;
    //   //   }
    //   //
    //   //   // Condition 8: user has to have the base currency
    //   //   const baseCurrency = userExchange.baseCurrency;
    //   //   if (!baseCurrency?.length) {
    //   //     Logger.warn(`User ${user.id} has no base currency for ${exchangeId}`);
    //   //     continue;
    //   //   }
    //   //
    //   //   // Condition 4: user enabled only some currencies for trading
    //   //   const [base, quote] = CcxtService.getCurrenciesFromSymbol(symbol);
    //   //   if (
    //   //     baseCurrency?.length &&
    //   //     user.currencies?.length &&
    //   //     ((baseCurrency !== base && user.currencies?.indexOf(base) < 0) || (baseCurrency !== quote && user.currencies?.indexOf(quote) < 0))
    //   //   ) {
    //   //     Logger.warn(`User ${user.id} enabled only some currencies for trading ${exchangeId} ${symbol}`);
    //   //     continue;
    //   //   }
    //   //
    //   //   // Condition 5: user excluded the currency
    //   //   if (user.excludedCurrencies?.length && (user.excludedCurrencies?.indexOf(base) >= 0 || user.excludedCurrencies?.indexOf(quote) >= 0)) {
    //   //     Logger.warn(`User ${user.id} excluded the currency ${exchangeId} ${symbol}`);
    //   //     continue;
    //   //   }
    //   //
    //   //   await this.queueService.addJob_CheckOrdersSignals({ ...signals, price, market, userId: user.id });
    //   // }
    // }
    //
    // await Promise.all(jobs);
  }

  async addJobToCloseOrderByDisabledSymbol(
    jobs: QueueParamsCloseOrders[],
    order: TradeOrder,
    closeComment: string
  ): Promise<void> {
    const alreadyAdded = jobs.find(
      (job) => job.symbol === order.symbol && job.exchangeId === order.exchangeId && job.userId === order.userId
    );
    if (alreadyAdded) {
      if (alreadyAdded.virtual && !order.isVirtual) {
        alreadyAdded.virtual = false;
      }

      return;
    }

    await this.event.addOrderEvent(order, {
      type: EVENT_TYPE.ORDER_INFO,
      event: `Try to close orders due disabled symbol`,
    });

    Logger.warn(
      `Close order due disabled symbol: ${closeComment}, [${order.exchangeId}] ${order.symbol} ${order.userId} ${order.id}`
    );

    jobs.push({
      virtual: order.isVirtual,
      exchangeId: order.exchangeId,
      userId: order.userId,
      symbol: order.symbol,
      time: new Date().getTime(),
      comment: closeComment,
      type: TADE_SIGNAL.CLOSE_DISABLED,
    });
  }

  // if some symbols or currencies are not available in exchange,
  // or a user have disabled these symbols,
  // remove them from strategy
  // and close all orders for this symbol.
  // If the robot can't close these orders, it has to cancel them.
  @Cron('*/30 * * * * *')
  async checkDisabledSymbols(): Promise<void> {
    if (!(await this.redisOrder.isMainOrderManager(this.managerId))) {
      return;
    }

    const bulkJobs = [];

    const users = await this.redisUser.getUsers();
    for (const user of users) {
      for (const exchangeId of getEnabledExchangeIds()) {
        // todo: enable real orders too
        const orders = await this.redisOrder.getOrders({ userId: user.id, exchangeId, active: true });
        for (const order of orders) {
          const { exchangeId, symbol } = order;

          // Condition 1: a user is not active, trade is disabled
          if (!user.active) {
            // fixme: return after fix active users in CCXT service
            // bulkJobs.push(this.addJobToCloseOrderByDisabledSymbol(order, `User [${user.id}] is not active now`));
            // continue;
            // todo: move to the external function
            // check close signals for opened orders
            // await this.queueService.addBulkJobs_CalculateIndicatorSignal([{ exchangeId, symbol }]);
          }

          // Condition 2: market is not available for trading on SPOT anymore
          const market = await this.redisExchange.getMarket(exchangeId, symbol);
          if (market && Object.keys(market).length) {
            let isTrading = true;

            if (!market?.spot) {
              isTrading = false;
            }

            if (market.active === false) {
              isTrading = false;
            }

            if (!isTrading) {
              await this.addJobToCloseOrderByDisabledSymbol(bulkJobs, order, `Market ${symbol} is not trading anymore`);
              continue;
            }
          }

          // Condition 3: currency is excluded from trading
          const [base, quote] = ExchangeLibService.getCurrenciesFromSymbol(symbol);
          if (EXCLUDED_CURRENCIES.indexOf(base) >= 0 || EXCLUDED_CURRENCIES.indexOf(quote) >= 0) {
            await this.addJobToCloseOrderByDisabledSymbol(
              bulkJobs,
              order,
              `Currency of ${symbol} is excluded from trading`
            );
          }

          // Condition 5: user excluded the currency
          if (
            user.excludedCurrencies?.length &&
            (user.excludedCurrencies?.indexOf(base) >= 0 || user.excludedCurrencies?.indexOf(quote) >= 0) &&
            order.isVirtual === false
          ) {
            await this.addJobToCloseOrderByDisabledSymbol(
              bulkJobs,
              order,
              `Currency of ${symbol} is not allowed for trading by user. Excluded: ${user.excludedCurrencies.toString()}`
            );
          }

          // Condition 6: user enabled only some symbols
          const userExchange = await user.exchanges?.find((exConfig) => exConfig.exchangeId === exchangeId);
          const userSymbol = await userExchange?.symbols?.find((s) => s.toUpperCase() === symbol.toUpperCase());
          if (userExchange && userExchange?.symbols?.length && !userSymbol && order.isVirtual === false) {
            await this.addJobToCloseOrderByDisabledSymbol(
              bulkJobs,
              order,
              `Symbol ${symbol} is not allowed by user for trading`
            );
          }

          // Condition 4: user enabled only some currencies for trading
          const baseCurrency = userExchange?.baseCurrency;
          if (
            baseCurrency?.length &&
            user.currencies?.length &&
            ((baseCurrency !== base && user.currencies?.indexOf(base) < 0) ||
              (baseCurrency !== quote && user.currencies?.indexOf(quote) < 0)) &&
            order.isVirtual === false
          ) {
            await this.addJobToCloseOrderByDisabledSymbol(
              bulkJobs,
              order,
              `Currency of ${symbol} is not allowed by user for trading. Allowed: ${user.currencies.toString()}`
            );
          }
        }
      }
    }

    if (bulkJobs?.length) {
      await this.queueService.addJobs_CloseOrderByDisabledSymbol(bulkJobs);
    }
  }

  @Cron('*/15 * * * * *')
  async checkUserSymbols(): Promise<void> {
    const symbols = {};
    const users = await this.redisUser.getUsers(true);
    for (const user of users) {
      for (const exchangeId of getEnabledExchangeIds()) {
        const userExchange = user.exchanges?.find((exConfig) => exConfig.exchangeId === exchangeId);
        const userSymbols = userExchange?.symbols;

        if (!userSymbols?.length) {
          continue;
        }

        if (!symbols[exchangeId]) {
          symbols[exchangeId] = [];
        }

        userSymbols.forEach((symbol) => {
          if (symbols[exchangeId].indexOf(symbol) < 0) {
            symbols[exchangeId].push(symbol);
          }
        });
      }
    }

    this.allUserSymbols = symbols;
  }

  async calculateIndicatorSignal(exchangeId: string): Promise<number> {
    // this.cpuUsage = getAverageUsage() || 0.75;
    //
    // const symbolsCount = Math.max(1, Math.ceil(13 * (1 - this.cpuUsage)));

    // const symbolsCount = MAXIMUM_EXCHANGE_SIGNALS_PER_TIME;

    // os.cpuUsage((v) => {
    //   this.cpuUsage = v || 0.75;
    // });
    // console.log('CPU Usage (%): ' + this.cpuUsage * 100);

    let lastSymbols: string[];
    try {
      lastSymbols = await this.redisTicker.removeTickersLast(exchangeId, this.signalsPerTime);

      // Logger.warn(`[${exchangeId}] lastSymbols: ${lastSymbols?.length || 0}/${symbolsCount} - ${(this.cpuUsage * 100).toFixed(0)}%`);
      // if (lastSymbols?.length) {
      //   Logger.warn(`[${exchangeId}] ${getIPAddress()}: ${lastSymbols?.length || 0}/${symbolsCount}`);
      // }
    } catch (err) {
      console.error('removeTickersLast()', messageRepresentation(err.message), lastSymbols);

      return 0;
    }

    if (lastSymbols?.length) {
      await this.addJob_CalculateIndicatorSignal(exchangeId, lastSymbols);

      return lastSymbols.length;
    }

    return 0;
  }

  async addJob_CalculateIndicatorSignal(exchangeId: string, symbols: string[]): Promise<void> {
    // const params: QueueParamsCalculateIndicatorSignal[] = [];

    for (const symbol of symbols) {
      if (this.allUserSymbols[exchangeId]?.indexOf(symbol) === -1) {
        continue;
      }

      // Condition 2: market is not available for trading on SPOT anymore
      const market = await this.redisExchange.getMarket(exchangeId, symbol);
      if (!market) {
        // Logger.warn(`[${exchangeId}] Market "${symbol}" not found`, 'addJob_CalculateIndicatorSignal()');
        continue;
      }

      // Condition 3: currency is excluded from trading
      const [base, quote] = ExchangeLibService.getCurrenciesFromSymbol(symbol);
      if (EXCLUDED_CURRENCIES.indexOf(base) >= 0 || EXCLUDED_CURRENCIES.indexOf(quote) >= 0) {
        // Logger.debug(
        //   `[${exchangeId}] ${symbol} is excluded from trading.`,
        //   'SignalService.addJob_CalculateIndicatorSignal'
        // );
        continue;
      }

      const baseCurrency = ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol);
      if (baseCurrency !== base && baseCurrency !== quote) {
        // Logger.error(
        //   `[${exchangeId}] ${symbol} is excluded from trading.`,
        //   'SignalService.addJob_CalculateIndicatorSignal'
        // );
        continue;
      }

      let isMarketTrading = true;

      if (!market?.spot) {
        Logger.debug(`[${exchangeId}] Market ${symbol} is not available for trading on SPOT`);
        isMarketTrading = false;
      }

      if (market?.active === false) {
        Logger.debug(`[${exchangeId}] Market ${symbol} is not active`);
        isMarketTrading = false;
      }

      if (!isMarketTrading) {
        Logger.warn(`[${exchangeId}] ${symbol} is not trading...`);
        continue;
      }

      setTimeout(async () => {
        if (
          (this.lastCalculateSignal[`${exchangeId}-${symbol}`] || 0) >
          Date.now() - CALCULATE_SIGNAL_NOT_OFTEN_MSECS
        ) {
          // console.log(`Skip calculate signal for ${param.exchangeId}-${param.symbol}`);
          return;
        }
        this.lastCalculateSignal[`${exchangeId}-${symbol}`] = Date.now();

        const signals: StrategyIndicatorSignalsCUPO = await this.checkIndicatorSignalsCUPOStrategy(exchangeId, symbol);

        if (signals) {
          await this.check_AllUsers_OrdersSignalsCUPOStrategy(signals);
        }
      }, 1000 * Math.random());

      // params.push({
      //   exchangeId,
      //   symbol,
      // } as QueueParamsCalculateIndicatorSignal);
    }

    // if (params.length) {
    //   const jobs = [];
    //   for (const param of params) {
    //     if ((this.lastCalculateSignal[`${param.exchangeId}-${param.symbol}`] || 0) > Date.now() - 15000) {
    //       // console.log(`Skip calculate signal for ${param.exchangeId}-${param.symbol}`);
    //       continue;
    //     }
    //     this.lastCalculateSignal[`${param.exchangeId}-${param.symbol}`] = Date.now();
    //
    //     const signals: StrategyIndicatorSignalsCUPO = await this.checkIndicatorSignalsCUPOStrategy(
    //       param.exchangeId,
    //       param.symbol
    //     );
    //
    //     if (signals) {
    //       jobs.push(this.check_AllUsers_OrdersSignalsCUPOStrategy(signals));
    //
    //       // jobs.push(this.addJob_checkSignalsOpenUserOrdersProcessor(signals));
    //     }
    //   }
    //
    //   await Promise.all(jobs);
    //
    //   // await this.queueService.addBulkJobs_CalculateIndicatorSignal(params);
    // }
  }
}
