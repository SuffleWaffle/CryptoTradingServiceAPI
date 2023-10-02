'use strict';
import * as ccxt from "ccxt";
import { Balances, Currency, Dictionary, Exchange, Market, OHLCV, Order, Ticker } from "ccxt";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { TIMEFRAME } from "@cupo/timeseries";
import { PlatformMongodbService, RedisUserService } from "@cupo/backend/storage";
import { EVENT_TYPE, ExchangeConfig, OPERATION_TYPE, ProxyInterface, TradeOrder, User } from "@cupo/backend/interface";
import {
  ENABLED_EXCHANGES,
  EXCHANGE_OVER_LIMIT_EXPIRATION,
  EXCLUDED_CURRENCIES,
  messageRepresentation,
  USER_EXCHANGE_STATUS,
  userIdRepresentation
} from "@cupo/backend/constant";
import { EmailService, SENDPULSE_TEMPLATES } from "@cupo/mail";
import { EventService } from "@cupo/event";
import { Connection } from "./ccxt.interface";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const HttpsProxyAgent = require('https-proxy-agent');

@Injectable()
export class CcxtService implements OnApplicationBootstrap {
  initialized: boolean = false;

  currencies: {
    [exchangeId: string]: {
      [currency: string]: Currency;
    };
  } = {};

  // todo: refactor this structure to work through the Proxy
  overLimit: {
    [exchangeId: string]: number;
  } = {};

  connections: Connection[] = [];
  private readonly proxyServers: { [exchangeId: string]: ProxyInterface[] } = {};

  constructor(
    private readonly redisUser: RedisUserService,
    private readonly event: EventService,
    private readonly emailService: EmailService,
    private readonly platformMongo: PlatformMongodbService
  ) {}

  async updateProxyServers(): Promise<void> {
    for (const exchangeId of Object.keys(ENABLED_EXCHANGES)) {
      const before = this.proxyServers[exchangeId]?.length || 0;

      const proxies = await this.platformMongo.getProxyList({ exchangeId });
      if (JSON.stringify(proxies) !== JSON.stringify(this.proxyServers[exchangeId] || {})) {
        this.proxyServers[exchangeId] = proxies;
      }

      if (this.proxyServers[exchangeId]?.length && before !== this.proxyServers[exchangeId].length) {
        Logger.verbose(
          `PROXY ${exchangeId}: ${JSON.stringify(this.proxyServers[exchangeId]?.map((proxy) => proxy.ip))}`,
          `${process.env.APP_NAME}.ApplicationBootstrap`
        );
      }
    }
  }

  async onApplicationBootstrap() {
    await this.updateProxyServers();

    this.initialized = true;
    Logger.log(`CCXT initialized`, `${process.env.APP_NAME}.ApplicationBootstrap`);
  }

  // getNextProxy(): string | null {
  //   // this.currentProxy++;
  //   // if (this.currentProxy >= servers.length) {
  //   //   this.currentProxy = 0;
  //   // }
  //   //
  //   // return servers[this.currentProxy];
  //
  //   return this.proxyServers?.length ? this.proxyServers[++this.currentProxy % this.proxyServers.length] : null;
  // }

  destroyExchangeConnection(connection: Connection): void {
    if (connection?.exchange?.agent) {
      try {
        connection.exchange.agent.destroy();

        connection.exchange.agent = undefined;
      } catch (e) {
        Logger.error(`Error destroying agent: ${e.message}`, `destroyExchangeConnection`);
      }
    }

    if (connection?.exchange) {
      connection.exchange = undefined;
    }
  }

  // remove user connections from this.exchanges if user is not in the Redis, or it is not active
  public deleteUsersExchanges(userIds: string[], exchangeId?: string): boolean {
    const connLength = this.connections?.length || 0;

    if (!userIds?.length) {
      if (connLength) {
        this.connections = [];

        return true;
      } else {
        return false;
      }
    }

    this.connections = this.connections.filter((connection) => {
      if (
        userIds.includes(connection.userId) &&
        (!exchangeId || (exchangeId && connection.exchangeId === exchangeId))
      ) {
        this.destroyExchangeConnection(connection);

        return false;
      }

      return true;
    });

    return connLength !== this.connections?.length;
  }

  public async updateUserExchanges(user: User): Promise<boolean> {
    let changed = false;

    if (!user?.id) {
      Logger.warn(`No user ID: ${JSON.stringify(user || {})}`, `updateUserExchanges()`);
      return changed;
    }

    const conn = this.connections.filter((connection) => connection.userId === user.id);

    // remove old exchanges
    conn.forEach((conn) => {
      if (user.exchanges?.length && !user.deleted) {
        const exchange = user.exchanges.find((exchange) => exchange.exchangeId === conn.exchangeId);
        if (
          !exchange ||
          (exchange.status !== USER_EXCHANGE_STATUS.ACTIVE && exchange.status !== USER_EXCHANGE_STATUS.PENDING)
        ) {
          changed = changed || this.deleteUsersExchanges([user.id], conn.exchangeId);

          Logger.verbose(`--- remove exchange connections [${conn.exchangeId}] ${user.id}: ${user.exchanges.length}`);
        }
      } else {
        changed = changed || this.deleteUsersExchanges([user.id]);
      }
    });

    // change exchanges
    (user.exchanges || []).forEach((exchange) => {
      let connectionChanged = false;
      const connections = conn.filter((connection) => exchange.exchangeId === connection.exchangeId);
      connections.forEach((connection) => {
        if (
          exchange.publicKey !== connection.publicKey ||
          exchange.secretKey !== connection.secretKey ||
          exchange.passphrase !== connection.passphrase ||
          (exchange.proxyIp && exchange.proxyIp !== connection.proxyIp)
        ) {
          connection.publicKey = exchange?.publicKey;
          connection.secretKey = exchange?.secretKey;
          connection.passphrase = exchange?.passphrase;

          if (exchange.proxyIp) {
            connection.proxyIp = exchange?.proxyIp;
          }

          Logger.verbose(`*** change exchanges ${user.id} exchanges: ${user.exchanges.length}`);

          changed = true;
          connectionChanged = true;
        }
      });

      if (connectionChanged) {
        this.recreateExchange(user.id, exchange.exchangeId);
      }
    });

    // add new exchanges
    if (Array.isArray(user.exchanges) && user.exchanges.length) {
      for (const exchange of user.exchanges) {
        if (!exchange.exchangeId) {
          Logger.warn(`No exchangeId in the config [${user.id}]`);

          continue;
        }

        if (
          await this.isUserExchangeSettingsWrong({
            userId: user.id,
            exchangeId: exchange.exchangeId,
            status: exchange.status,
          })
        ) {
          // Logger.error(`Bad user ${user.id} ${exchange.exchangeId}`);
          continue;
        }

        const exchangeConn = conn.filter(
          (connection) =>
            exchange.exchangeId === connection.exchangeId &&
            (!exchange.proxyIp || exchange.proxyIp === connection.proxyIp)
        );

        // if admin added a new Proxy, it needs to restart this app
        if (!exchangeConn.length) {
          const result = await this.addUserExchange(user.id, { ...exchange });

          if (result) {
            Logger.verbose(`+++ add new exchanges ${user.id} exchanges: ${user.exchanges.length}`);
            changed = true;
          }
        }
      }
    } else {
      // Logger.debug(`No exchanges within the user card [${user.id}]`);
    }

    return changed;
  }

  createExchangeObject(
    exchangeId: string,
    apiKey: string,
    secret: string,
    passphrase?: string,
    proxyIp?: string
  ): Exchange {
    const auth = process.env.PROXY_AUTH ? `${process.env.PROXY_AUTH}@` : '';
    const port = process.env.PROXY_PORT ? `:${process.env.PROXY_PORT}` : '';
    // const agent = proxy ? new HttpsProxyAgent(`http://${auth}${proxy}${port}`) : undefined;
    const agent = proxyIp ? HttpsProxyAgent(`http://${auth}${proxyIp}${port}`) : undefined;

    return new ccxt[exchangeId]({
      apiKey,
      secret,
      password: passphrase,
      enableRateLimit: true,
      verbose: false,
      options: { defaultType: 'spot' },
      agent,
      timeout: 120000,
    });
  }

  public async addUserExchange(userId: string, config: ExchangeConfig): Promise<boolean> {
    let result = false;

    if (config?.proxyIp) {
      if (
        !this.proxyServers[config.exchangeId]?.length ||
        !this.proxyServers[config.exchangeId]?.find((proxy) => proxy.ip === config.proxyIp)
      ) {
        const error = `The platform has no proxy server "${config.proxyIp}" for [${config.exchangeId}] "${userId}"`;
        Logger.error(error, `addUserExchange`);

        await this.changeExchangeStatus(userId, config.exchangeId, USER_EXCHANGE_STATUS.BROKEN, error);
        this.deleteUsersExchanges([userId], config.exchangeId);

        return false;
      }

      result = await this.addExchange(userId, config, config.proxyIp);
    } else if (!this.proxyServers[config.exchangeId]?.length) {
      result = await this.addExchange(userId, config);
    } else {
      for (const proxy of this.proxyServers[config.exchangeId] || []) {
        result = await this.addExchange(userId, config, proxy.ip);
      }
    }

    return result;
  }

  async fetchMarkets(
    data: {
      exchangeId: string;
      baseOnly: boolean;
      activeOnly: boolean;
      spotOnly: boolean;
    }
    // baseOnly = true,
    // activeOnly = true,
    // spotOnly = true
  ): Promise<Dictionary<Market> | string> {
    const { exchangeId, baseOnly, activeOnly, spotOnly } = data;

    let exchangeMarkets;
    let con;
    try {
      con = await this.switchExchange('common', exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] "common": ${con}`;
      }

      await this.waitRateLimit(con); // milliseconds

      // exchangeMarkets = await exchange.loadMarkets(reload);
      exchangeMarkets = await con.exchange.fetchMarkets();
      if (!exchangeMarkets) {
        Logger.error(`Error loading markets for [${exchangeId}]`);

        return `Error loading markets for [${exchangeId}]`;
      }
    } catch (err) {
      Logger.error(`Error loading markets for [${exchangeId}]: ${err.message}`);

      this.recreateExchange(con?.userId, exchangeId);

      return `Error loading markets for [${exchangeId}]: ${err.message}`;
    }

    const baseCurrencies = ENABLED_EXCHANGES[exchangeId].baseCurrencies;

    const markets = {};
    const len = exchangeMarkets?.length ?? 0;
    for (let i = 0; i < len; i++) {
      if (!activeOnly || (activeOnly && exchangeMarkets[i].active !== false)) {
        if (!spotOnly || (spotOnly && exchangeMarkets[i].spot)) {
          if (
            !baseOnly ||
            (baseOnly &&
              (baseCurrencies.indexOf(exchangeMarkets[i].base) >= 0 ||
                baseCurrencies.indexOf(exchangeMarkets[i].quote) >= 0))
          ) {
            markets[exchangeMarkets[i].symbol] = { ...exchangeMarkets[i] };
          }
        }
      }

      // if (exchangeId === 'bitso') {
      //   if (!activeOnly || (activeOnly && exchangeMarkets[symbol].active !== false)) {
      //     if (!spotOnly || (spotOnly && exchangeMarkets[symbol].spot)) {
      //       if (baseCurrencies.indexOf(exchangeMarkets[symbol].base) >= 0 || baseCurrencies.indexOf(exchangeMarkets[symbol].quote) >= 0) {
      //         markets[symbol] = { ...exchangeMarkets[symbol] };
      //       }
      //     }
      //   }
      // } else {
      //   if (!activeOnly || (activeOnly && exchangeMarkets[symbol].active && exchangeMarkets[symbol].info?.status === 'TRADING')) {
      //     if (!spotOnly || (spotOnly && exchangeMarkets[symbol].spot && exchangeMarkets[symbol].info?.isSpotTradingAllowed)) {
      //       if (baseCurrencies.indexOf(exchangeMarkets[symbol].base) >= 0 || baseCurrencies.indexOf(exchangeMarkets[symbol].quote) >= 0) {
      //         markets[symbol] = { ...exchangeMarkets[symbol] };
      //       }
      //     }
      //   }
      // }
    }
    if (!Object.keys(markets).length) {
      Logger.error(`No markets for [${exchangeId}]`);
      return null;
    }

    Logger.log(`[${exchangeId}] markets saved: ${Object.keys(markets).length}/${Object.keys(exchangeMarkets).length}`);

    return { ...markets };
  }

  async getCurrencies(exchangeId: string, supportedOnly = true): Promise<Dictionary<Currency> | string> {
    let con;
    try {
      con = await this.switchExchange('common', exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] "common": ${con}`;
      }

      await this.waitRateLimit(con);

      const currencies = con.exchange.fetchCurrencies();
      if (!currencies || typeof currencies !== 'object') {
        Logger.warn(`Can not fetch currencies for [${exchangeId}]`, `${process.env.APP_NAME}`);

        return `Can not fetch currencies for [${exchangeId}]`;
      }

      const res = {};

      Object.keys(currencies).forEach((id) => {
        if (EXCLUDED_CURRENCIES.indexOf(id) === -1) {
          res[id] = currencies[id];
        }
      });

      this.currencies[exchangeId] = res;

      if (!supportedOnly) {
        return currencies;
      }

      return res;
    } catch (err) {
      Logger.error(
        `Error loading currencies for [${exchangeId}] "${con?.userId}: ${messageRepresentation(err.message)}`
      );

      this.recreateExchange(con?.userId, exchangeId);

      return `Error loading currencies for [${exchangeId}] "${con?.userId}: ${err.message}`;
    }
  }

  getTimeframes(exchangeId): Dictionary<number | string> | null {
    const con = this.connections.find((c) => c.exchangeId === exchangeId);
    if (!con.exchange) {
      return null;
    }

    return con.exchange.timeframes || null;
  }

  async fetchCandles(param: {
    exchangeId: string;
    symbol: string;
    timeframe: TIMEFRAME; // 1m, 1h, 1d
    since?: number;
    limit?: number;
  }): Promise<OHLCV[] | string> {
    const { exchangeId, symbol, timeframe, since, limit } = param;

    if (this.overLimit[exchangeId] && Date.now() - this.overLimit[exchangeId] < EXCHANGE_OVER_LIMIT_EXPIRATION) {
      return `Exchange [${exchangeId}] is over limit`;
    }

    let con;
    try {
      con = await this.switchExchange('common', exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] "common": ${con}`;
      }

      if (!con.exchange?.has.fetchOHLCV) {
        Logger.error(`[${exchangeId}] does not support fetchOHLCV`);

        return `Error: [${exchangeId}] does not support fetchOHLCV`;
      }

      await this.waitRateLimit(con);

      return await con.exchange.fetchOHLCV(symbol, timeframe, since, limit);
    } catch (err) {
      const msg = err?.message?.toLowerCase() || '';

      if (err?.message?.indexOf('404 Not Found') >= 0) {
        Logger.error(`[${exchangeId}] ${symbol} ${timeframe} candles not found`);
      } else if (
        msg.indexOf('too many') >= 0 ||
        msg.indexOf('too much') >= 0 ||
        msg.indexOf('ratelimit') >= 0 ||
        msg.indexOf('rate limit') >= 0
      ) {
        // binance 418 I'm a teapot {"code":-1003,"msg":"Way too much request weight used; IP banned until 1669829694169. Please use the websocket for live updates to avoid bans."}
        this.overLimit[exchangeId] = new Date().getTime();
        Logger.error(
          `[${exchangeId}] ratelimit fetchOHLCV() ${symbol} ${timeframe}: ${messageRepresentation(err.message)}`
        );
      } else {
        Logger.error(
          `[${exchangeId}] error fetchOHLCV() ${symbol} ${timeframe}: ${messageRepresentation(err.message)}`
        );
      }

      this.recreateExchange(con?.userId, exchangeId);

      return `Error fetchOHLCV() ${symbol} ${timeframe}: ${messageRepresentation(err.message)}`;
    }
  }

  async waitRateLimit(connection: Connection, ms?: number): Promise<void> {
    // await new Promise((resolve) =>
    //   setTimeout(() => {
    //     if (new Date().getTime() - this.lastRequest > this.rateLimit) {
    //       this.lastRequest = new Date().getTime();
    //
    //       resolve(true);
    //     }
    //   }, 10)
    // );

    // console.log(`Rate limit: ${this.rateLimit} ms`);
    const { rateLimit } = connection || { rateLimit: 1000 };

    return await new Promise((resolve) => setTimeout(resolve, ms || rateLimit));
  }

  async fetchTickers(exchangeId: string, symbols?: string[]): Promise<Record<string, Ticker> | string> {
    // if (Date.now() - (this?.lastExchangeFetch?.[exchangeId]?.tickers || 0) < EXCHANGE_TICKERS_EXPIRATION) {
    //   Logger.debug(`TICKERS [${exchangeId}] is not expired yet`);
    //
    //   if (this.tickers?.[exchangeId]) {
    //     return this.tickers[exchangeId];
    //   }
    //   return null;
    // }

    let con;
    try {
      con = await this.switchExchange('common', exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] "common": ${con}`;
      }

      if (!con.exchange?.has.fetchTickers) {
        Logger.error(`Fetching tickers on '${exchangeId} is not supported`);

        return `Error: fetching tickers on '${exchangeId} is not supported`;
      }

      await this.waitRateLimit(con);

      return con.exchange.fetchTickers(symbols);
    } catch (err) {
      Logger.error(`Error fetching tickers [${exchangeId}] ${symbols}: ${messageRepresentation(err.message)}`);

      this.recreateExchange(con?.userId, exchangeId);

      return `Error fetching tickers [${exchangeId}] ${symbols}: ${messageRepresentation(err.message)}`;
    }
  }

  async fetchTicker(exchangeId: string, symbol: string): Promise<Ticker | string> {
    let con;
    try {
      con = await this.switchExchange('common', exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] "common": ${con}`;
      }

      if (!con.exchange?.has.fetchTicker) {
        Logger.warn(`Fetching ticker on '${exchangeId} is not supported`);
        return null;
      }

      await this.waitRateLimit(con);

      return con.exchange.fetchTicker(symbol);
    } catch (e) {
      Logger.error(`Error fetching ticker [${exchangeId}] ${symbol}: ${e.message}`);

      this.recreateExchange(con?.userId, exchangeId);

      return `Error fetching ticker [${exchangeId}] ${symbol}: ${e.message}`;
    }
  }

  async checkDisableAPIKey(data: { userId: string; exchangeId: string; errorMessage: string }): Promise<boolean> {
    const { userId, exchangeId, errorMessage } = data;

    let result = false;

    if (
      ENABLED_EXCHANGES[exchangeId].authErrors.find((error) =>
        errorMessage?.toLowerCase().includes(error.toLowerCase())
      ) ||
      ENABLED_EXCHANGES[exchangeId].keysErrors.find((error) =>
        errorMessage?.toLowerCase().includes(error.toLowerCase())
      )
    ) {
      await this.changeExchangeStatus(userId, exchangeId, USER_EXCHANGE_STATUS.BROKEN, errorMessage);

      this.deleteUsersExchanges([userId], exchangeId);

      result = true;
    }

    return result;
  }

  async openBuy(order: TradeOrder): Promise<Order | string> {
    if (!(await this.checkOrderParameters(order))) {
      Logger.error(`Invalid order parameters in openBuy(): ${JSON.stringify(order)}`, 'CCXT.openBuy');

      return `Invalid order parameters in openBuy()`;
    }

    const { exchangeId, userId, symbol, volume } = order;

    let con;
    try {
      con = await this.switchExchange(userId, exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] ${userId}: ${con}`;
      }

      return con.exchange.createMarketBuyOrder(symbol, volume);
    } catch (err) {
      if (await this.checkDisableAPIKey({ userId, exchangeId, errorMessage: err.message })) {
        Logger.error(
          `[${exchangeId}] error openBuy ${symbol} ${volume}: ${messageRepresentation(err.message)}`,
          'CCXT.openBuy'
        );
      } else {
        Logger.error(`Error in openBuy(): ${err.message} ... ${JSON.stringify(order)}`, 'CCXT.openBuy');

        this.recreateExchange(userId, exchangeId);
      }

      return `Error in openBuy(): ${err.message}`;
    }
  }

  async openSell(order: TradeOrder): Promise<Order | string> {
    if (!(await this.checkOrderParameters(order))) {
      Logger.error(`Invalid order parameters in openSell(): ${JSON.stringify(order)}`, 'CCXT.openSell');

      return `Invalid order parameters in openSell()`;
    }

    const { exchangeId, userId, symbol, volume } = order;

    let con;
    try {
      con = await this.switchExchange(userId, exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] ${userId}: ${con}`;
      }

      return con.exchange.createMarketSellOrder(symbol, volume);
    } catch (err) {
      Logger.error(`Error in openMarketSell: ${err.message} ... ${JSON.stringify(order)}`, 'CCXT.openSell');

      this.recreateExchange(userId, exchangeId);

      return `Error in openMarketSell: ${err.message}`;
    }
  }

  async closeOrder(order: TradeOrder): Promise<Order | string> {
    if (!(await this.checkOrderParameters(order))) {
      Logger.error(`Invalid order parameters in closeOrder(): ${JSON.stringify(order)}`, 'CCXT.closeExchangeOrder');

      return `Invalid order parameters in closeOrder()`;
    }

    const { exchangeId, userId, symbol, volume } = order;

    let con;

    try {
      con = await this.switchExchange(userId, exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] ${userId}: ${con}`;
      }

      let result;
      if (order.type === OPERATION_TYPE.BUY) {
        result = await con.exchange.createMarketSellOrder(symbol, volume);
      } else {
        result = con.exchange.createMarketBuyOrder(symbol, volume);
      }

      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_CLOSED_EXCHANGE,
        event: `Order closed on the exchange ${order?.exchangeId || ''}`,
        data: { exchangeOrder: result || {} },
      });

      return result;
    } catch (err) {
      Logger.error(
        `[${exchangeId}] "${userIdRepresentation(userId)}" ${symbol}: ${err.message}`,
        'CCXT.closeExchangeOrder'
      );

      await this.event.addOrderEvent(order, {
        type: EVENT_TYPE.ORDER_ERROR,
        event: `Error while closing order`,
        data: { cause: err.message },
      });

      this.recreateExchange(userId, exchangeId);

      return `Error in closeOrder(): ${err.message}`;
    }
  }

  async checkOrderParameters(order: TradeOrder): Promise<boolean> {
    if (!order) {
      return false;
    }

    const { exchangeId, userId, symbol, volume } = order;

    if (await this.isUserExchangeSettingsWrong({ userId, exchangeId })) {
      Logger.error(`The user settings is bad [${exchangeId}] ${userId} for order: ${JSON.stringify(order)}`);

      return false;
    }

    return !!(exchangeId && userId && symbol && volume);
  }

  async getWalletBalances(data: {
    userId: string;
    exchangeId: string;
    status?: USER_EXCHANGE_STATUS;
  }): Promise<Balances | string | null> {
    const { userId, exchangeId, status } = data;

    if (await this.isUserExchangeSettingsWrong({ userId, exchangeId, status })) {
      return `The user settings is bad [${exchangeId}] ${userId}`;
    }

    if (this.overLimit[exchangeId] && Date.now() - this.overLimit[exchangeId] < EXCHANGE_OVER_LIMIT_EXPIRATION) {
      return `The exchange is over limit [${exchangeId}] "${userId}"`;
    }
    // await this.waitRateLimit(exchangeId);

    let con: Connection | string;
    try {
      con = await this.switchExchange(userId, exchangeId);
      if (typeof con === 'string') {
        return `Error switch exchange [${exchangeId}] ${userId}: ${con}`;
      }

      const balance = await con.exchange.fetchBalance();
      if (balance) {
        await this.changeExchangeStatus(userId, exchangeId, USER_EXCHANGE_STATUS.ACTIVE);

        await this.event.updateUserWallet({ userId, exchangeId, balance });
      }

      return balance;
    } catch (err) {
      const msg = err.message?.toLowerCase() ?? '';

      if (await this.checkDisableAPIKey({ userId, exchangeId, errorMessage: msg })) {
        Logger.error(
          `Error during get user balance: ${err.message} ... ${exchangeId} user ${userId}, proxy: ${
            con?.['proxyIp'] || 'none'
          }`,
          `CCXT.getWalletBalances`
        );

        return err.message;
      } else if (
        msg.indexOf('too many') >= 0 ||
        msg.indexOf('too much') >= 0 ||
        msg.indexOf('ratelimit') >= 0 ||
        msg.indexOf('rate limit') >= 0
      ) {
        // binance 418 I'm a teapot {"code":-1003,"msg":"Way too much request weight used; IP banned until 1669829694169. Please use the websocket for live updates to avoid bans."}
        this.overLimit[exchangeId] = new Date().getTime();
        Logger.error(`[${exchangeId}] rate limit during fetch wallet balance: ${messageRepresentation(err.message)}`);

        this.recreateExchange(userId, exchangeId);

        return `The exchange is over limit [${exchangeId}] ${userId}`;
      } else {
        Logger.error(
          `Error during get user balance: ${err.message} ... ${exchangeId} user ${userId}, proxy: ${
            con?.['proxyIp'] || 'none'
          }`
        );

        this.recreateExchange(userId, exchangeId);

        return null;
      }
    }
  }

  async changeExchangeStatus(
    userId: string,
    exchangeId: string,
    status: USER_EXCHANGE_STATUS,
    error?: string
  ): Promise<boolean> {
    const changed = await this.redisUser.changeExchangeStatus(userId, exchangeId, status, error);

    if (status === USER_EXCHANGE_STATUS.BROKEN || status === USER_EXCHANGE_STATUS.NOT_CONFIGURED) {
      this.deleteUsersExchanges([userId], exchangeId);
    }

    if (changed) {
      if (status === USER_EXCHANGE_STATUS.BROKEN) {
        await this.emailService.sendEmail({
          userId,
          templateId: SENDPULSE_TEMPLATES.API_KEYS_ERROR,
        });
      }

      if (status === USER_EXCHANGE_STATUS.ACTIVE) {
        await this.emailService.sendEmail({
          userId,
          templateId: SENDPULSE_TEMPLATES.API_KEYS_OK,
          variables: {
            exchangeId,
          },
        });
      }
    }

    return changed;
  }

  async isUserExchangeSettingsWrong(props: {
    userId: string;
    exchangeId: string;
    status?: USER_EXCHANGE_STATUS;
  }): Promise<boolean> {
    const { userId, exchangeId, status } = props;

    if (userId === 'common') {
      if (this.connections.filter((connection) => connection.exchangeId === exchangeId).length === 0) {
        Logger.warn(`There are no connections for the 'common' user [${exchangeId}]`);

        return true;
      }

      return false;
    }

    if (status) {
      return status !== USER_EXCHANGE_STATUS.ACTIVE && status !== USER_EXCHANGE_STATUS.PENDING;
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return true;
    }

    const exchange = user.exchanges?.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange || !exchange.status) {
      return true;
    }

    return exchange.status !== USER_EXCHANGE_STATUS.ACTIVE && exchange.status !== USER_EXCHANGE_STATUS.PENDING;
  }

  private createExchangeConnection(connection: Connection): void {
    connection.exchange = this.createExchangeObject(
      connection.exchangeId,
      connection.publicKey,
      connection.secretKey,
      connection.passphrase,
      connection.proxyIp
    ) as Exchange;

    connection.rateLimit =
      parseInt(process.env[`${connection.exchangeId.toUpperCase()}_RATE_LIMIT_FETCH`], 10) ||
      connection.exchange.rateLimit;
    connection.lastIndex = 0;
  }

  private recreateExchange(userId: string, exchangeId: string): void {
    const exchanges = this.connections.filter(
      (connection) => connection.exchangeId === exchangeId && connection.userId === userId
    );

    exchanges.forEach((connection) => {
      this.createExchangeConnection(connection);
    });
  }

  private async addExchange(userId: string, config: ExchangeConfig, proxyIp?: string): Promise<boolean> {
    const { exchangeId, status, publicKey, secretKey, passphrase } = config;

    if (!exchangeId) {
      Logger.warn(`No exchangeId in the config [${userId}]: ${JSON.stringify(config)}`);

      return false;
    }

    if (await this.isUserExchangeSettingsWrong({ userId, exchangeId, status })) {
      Logger.warn(`No publicKey or secretKey in the config [${exchangeId}] ${userId} - block the user`);

      return false;
    }

    const conn = this.connections.filter(
      (connection) =>
        connection.exchangeId === exchangeId && connection.userId === userId && connection.proxyIp === proxyIp
    );

    if (!conn.length) {
      this.connections.push({
        userId,
        exchangeId,
        publicKey,
        secretKey,
        passphrase,
        proxyIp,
        rateLimit: 2000,
        lastIndex: 0,
      });

      Logger.verbose(`[${exchangeId?.toUpperCase()}] added for user: ${userId}`, `${process.env.APP_NAME}.addExchange`);
    } else {
      const con = this.connections.find(
        (connection) =>
          connection.exchangeId === exchangeId &&
          connection.userId === userId &&
          connection.proxyIp === proxyIp &&
          connection.publicKey === publicKey
      );

      if (con) {
        if (
          con.secretKey !== secretKey ||
          (exchangeId === 'coinbasepro' && con.passphrase !== passphrase) ||
          con.proxyIp !== proxyIp
        ) {
          con.publicKey = publicKey;
          con.secretKey = secretKey;
          con.passphrase = passphrase;
          con.proxyIp = proxyIp;
          con.rateLimit = 2000;
          con.lastIndex = 0;

          this.destroyExchangeConnection(con);
        }
      } else {
        this.connections.push({
          userId,
          exchangeId,
          publicKey,
          secretKey,
          passphrase,
          proxyIp,
          rateLimit: 2000,
          lastIndex: 0,
        });

        Logger.verbose(
          `[${exchangeId?.toUpperCase()}] added with ${proxyIp || '"none"'} proxy for user: ${userId}`,
          `${process.env.APP_NAME}`
        );
      }
    }

    return true;
  }

  private async switchExchange(userId: string, exchangeId: string): Promise<Connection | string> {
    if (!this.initialized) {
      return 'Exchange module is not initialized';
    }

    if (await this.isUserExchangeSettingsWrong({ userId, exchangeId })) {
      return `No publicKey or secretKey in the config [${exchangeId}] ${userId}`;
    }

    const conn = this.connections
      .filter(
        (connection) =>
          connection.exchangeId === exchangeId &&
          ((userId && userId !== 'common' && connection.userId === userId) || !userId || userId === 'common')
      )
      .sort((a, b) => a.lastIndex - b.lastIndex);
    if (!conn?.length) {
      Logger.warn(`No user exchange setting "${userId}" for [${exchangeId}]`, `switchExchange`);

      return `No user exchange setting ${userId} for [${exchangeId}]`;
    }

    const maxIndex = conn[conn.length - 1].lastIndex;

    conn[0].lastIndex = maxIndex + 1;

    if (!conn[0].exchange) {
      conn[0].exchange = this.createExchangeObject(
        exchangeId,
        conn[0].publicKey,
        conn[0].secretKey,
        conn[0].passphrase,
        conn[0].proxyIp
      ) as Exchange;
    }

    const exchange = conn[0].exchange;
    if (!exchange) {
      Logger.warn(`No exchange [${exchangeId}] for user ${userId}`, `${process.env.APP_NAME}.switchExchange`);

      return `No exchange ${exchangeId} for user ${userId}`;
    }

    conn[0].rateLimit = exchange.rateLimit;

    return conn[0];
  }
}
