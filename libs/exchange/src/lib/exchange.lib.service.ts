import ccxt, { Balances, Dictionary, Market, OHLCV, Order } from 'ccxt';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ENABLED_EXCHANGES, messageRepresentation, USER_EXCHANGE_STATUS } from '@cupo/backend/constant';
import { HTTP_RESPONSE, ORDER_STATUS, TradeOrder } from '@cupo/backend/interface';
import { RedisOrderService, RedisUserService } from '@cupo/backend/storage';
import { TIMEFRAME } from '@cupo/timeseries';

@Injectable()
export class ExchangeLibService {
  constructor(private readonly redisUser: RedisUserService, private readonly redisOrder: RedisOrderService) {}

  static getCurrenciesFromSymbol(symbol: string): string[] | null {
    if (!symbol?.length) {
      Logger.error(`Invalid symbol: ${symbol}`);
      return null;
    }

    return symbol.split('/');
  }

  static getQuoteCurrencyFromSymbol(exchangeId: string, symbol: string, baseCurrency?: string): string {
    if (!symbol) {
      return 'null';
    }

    const [base, quote] = ExchangeLibService.getCurrenciesFromSymbol(symbol);

    if (baseCurrency) {
      if (base === baseCurrency) {
        return quote;
      }
      if (quote === baseCurrency) {
        return base;
      }
      return 'null';
    } else {
      const baseCurrency = ENABLED_EXCHANGES[exchangeId]?.baseCurrencies || [];
      if (baseCurrency.includes(base)) {
        return quote;
      }
      if (baseCurrency.includes(quote)) {
        return base;
      }
      return 'null';
    }
  }

  static getBaseCurrencyFromSymbol(exchangeId: string, symbol: string, baseCurrency?: string): string {
    if (!symbol) {
      return 'null';
    }

    const [base, quote] = ExchangeLibService.getCurrenciesFromSymbol(symbol);

    if (baseCurrency) {
      if (base === baseCurrency) {
        return base;
      }
      if (quote === baseCurrency) {
        return quote;
      }
      return 'null';
    } else {
      const baseCurrency = ENABLED_EXCHANGES[exchangeId]?.baseCurrencies || [];
      if (baseCurrency.includes(base)) {
        return base;
      }
      if (baseCurrency.includes(quote)) {
        return quote;
      }
      return 'null';
    }
  }

  getExchangesList(): string[] {
    return ccxt.exchanges;
  }

  private async sendExchangeRequest(method: string, body: any, params?: any): Promise<HTTP_RESPONSE<any>> {
    return axios
      .post(`${process.env.EXCHANGE_HOST || 'https://api.cupocoin.com/userexchange'}/${method}`, body, {
        timeout: 120000,
        ...(params || {}),
      })
      .then((res) => {
        return res.data as HTTP_RESPONSE<any>;
      })
      .catch((err) => {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad request to the exchange',
          message: err.message,
          data: err.response?.data,
        };
      });
  }

  async isUserExchangeSettingsWrong(props: {
    userId: string;
    exchangeId: string;
    status?: USER_EXCHANGE_STATUS;
  }): Promise<boolean> {
    const { userId, exchangeId, status } = props;

    if (userId === 'common') {
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

  async openBuy(order: TradeOrder): Promise<Order | null> {
    const answer: HTTP_RESPONSE<any> = await this.sendExchangeRequest('openBuy', order);

    if (answer?.statusCode === HttpStatus.OK && answer.data) {
      return answer.data;
    } else {
      Logger.error(
        `${answer?.statusCode} ${answer?.message}: ${JSON.stringify(answer.data || {})}`,
        `ExchangeLib.openBuy()`
      );

      return null;
    }
  }

  async openSell(order: TradeOrder): Promise<Order | null> {
    const answer: HTTP_RESPONSE<any> = await this.sendExchangeRequest('openSell', order);

    if (answer?.statusCode === HttpStatus.OK && answer.data) {
      return answer.data;
    } else {
      Logger.error(
        `${answer?.statusCode} ${answer?.message}: ${JSON.stringify(answer.data || {})}`,
        `ExchangeLib.openSell()`
      );

      return null;
    }
  }

  async closeUserOrder(order: TradeOrder): Promise<Order | null> {
    const exchangeOrder = await this.closeExchangeOrder(order);

    if (!exchangeOrder) {
      return null;
    }

    order.status = ORDER_STATUS.CLOSED;
    order.closeTime = new Date().getTime();

    await this.redisOrder.setOrder(order);

    return exchangeOrder;
  }

  async closeExchangeOrder(order: TradeOrder): Promise<Order | null> {
    const answer: HTTP_RESPONSE<Order> = await this.sendExchangeRequest('closeOrder', order);

    if (answer?.statusCode === HttpStatus.OK) {
      return answer.data || ({} as Order);
    }

    return null;
  }

  async fetchCandles(data: {
    exchangeId: string;
    symbol: string;
    timeframe: TIMEFRAME; // 1m, 1h, 1d
    since?: number;
    limit?: number;
  }): Promise<OHLCV[]> {
    const answer: HTTP_RESPONSE<any> = await this.sendExchangeRequest('fetchCandles', data);

    if (answer?.statusCode === HttpStatus.OK && answer.data?.length) {
      return answer.data;
    }

    Logger.error(
      `${answer?.statusCode} ${answer?.message}: ${JSON.stringify(answer.data || {})}`,
      `ExchangeLib.fetchCandles()`
    );

    return [];
  }

  async fetchMarkets(
    exchangeId: string,
    baseOnly = true,
    activeOnly = true,
    spotOnly = true
  ): Promise<Dictionary<Market> | null> {
    const answer: HTTP_RESPONSE<any> = await this.sendExchangeRequest('fetchMarkets', {
      exchangeId,
      baseOnly,
      activeOnly,
      spotOnly,
    });

    if (answer?.statusCode === HttpStatus.OK && answer.data) {
      return answer.data;
    }

    Logger.error(
      `${answer?.statusCode} ${answer?.message}: ${messageRepresentation(JSON.stringify(answer.data || {}))}`,
      `ExchangeLib.fetchMarkets()`
    );

    return null;
  }

  async getTimeframes(exchangeId): Promise<{
    [key: string]: number | string;
  } | null> {
    const answer: HTTP_RESPONSE<any> = await this.sendExchangeRequest('getTimeframes', {
      exchangeId,
    });

    if (answer?.statusCode === HttpStatus.OK && answer.data) {
      return answer.data;
    }

    Logger.error(
      `${answer?.statusCode} ${answer?.message}: ${JSON.stringify(answer.data || {})}`,
      `ExchangeLib.getTimeframes()`
    );

    return null;
  }

  async getWalletBalances(data: {
    userId: string;
    exchangeId: string;
    status?: USER_EXCHANGE_STATUS;
  }): Promise<Balances | null> {
    const { userId, exchangeId } = data;

    const answer: HTTP_RESPONSE<any> = await this.sendExchangeRequest('getWalletBalances', data);

    if (answer?.statusCode === HttpStatus.OK) {
      return (answer.data || {}) as Balances;
    } else {
      Logger.error(`Error [${exchangeId}] ${userId}: ${answer?.message}, ${answer?.data}`, `CCXT.getWalletBalances()`);

      return null;
    }

    // if (await this.isUserExchangeSettingsWrong({ userId, exchangeId, status })) {
    //   return null;
    // }
    //
    // if (this.overLimit[exchangeId] && Date.now() - this.overLimit[exchangeId] < EXCHANGE_OVER_LIMIT_EXPIRATION) {
    //   return null;
    // }
    // // await this.waitRateLimit(exchangeId);
    //
    // try {
    //   const exchange = await this.switchExchange(userId, exchangeId);
    //   if (!exchange) {
    //     return null;
    //   }
    //
    //   const balance = await exchange.fetchBalance();
    //   if (balance) {
    //     await this.changeExchangeStatus(userId, exchangeId, USER_EXCHANGE_STATUS.ACTIVE);
    //
    //     await this.event.updateUserWallet({ userId, exchangeId, balance });
    //   }
    //
    //   return balance;
    // } catch (err) {
    //   const exchanges = this.exchanges.get(userId);
    //   const exchangeParam = exchanges?.[exchangeId];
    //   const msg = err.message?.toLowerCase() ?? '';
    //
    //   if (
    //     ENABLED_EXCHANGES[exchangeId].authErrors.find((error) =>
    //       err.message?.toLowerCase().includes(error.toLowerCase())
    //     ) ||
    //     ENABLED_EXCHANGES[exchangeId].keysErrors.find((error) =>
    //       err.message.toLowerCase().includes(error.toLowerCase())
    //     )
    //   ) {
    //     Logger.error(
    //       `Error during get user balance: ${err.message} ... ${exchangeId} user ${userId}, proxy: ${
    //         exchangeParam?.connections?.[exchangeParam.lastIndex]?.proxy
    //       }`
    //     );
    //
    //     await this.changeExchangeStatus(userId, exchangeId, USER_EXCHANGE_STATUS.BROKEN, err.message);
    //
    //     delete this.exchanges[userId]?.[exchangeId];
    //
    //     return null;
    //   } else if (
    //     msg.indexOf('too many') >= 0 ||
    //     msg.indexOf('too much') >= 0 ||
    //     msg.indexOf('ratelimit') >= 0 ||
    //     msg.indexOf('rate limit') >= 0
    //   ) {
    //     // binance 418 I'm a teapot {"code":-1003,"msg":"Way too much request weight used; IP banned until 1669829694169. Please use the websocket for live updates to avoid bans."}
    //     this.overLimit[exchangeId] = new Date().getTime();
    //     Logger.error(`[${exchangeId}] rate limit during fetch wallet balance: ${messageRepresentation(err.message)}`);
    //
    //     this.recreateExchange(userId, exchangeId);
    //
    //     return null;
    //   } else {
    //     Logger.error(
    //       `Error during get user balance: ${err.message} ... ${exchangeId} user ${userId}, proxy: ${
    //         exchangeParam?.connections?.[exchangeParam.lastIndex]?.proxy
    //       }. Bad counter: ${await this.addBadUser(userId, exchangeId)}`
    //     );
    //
    //     this.recreateExchange(userId, exchangeId);
    //
    //     return null;
    //   }
    // }
  }
}
