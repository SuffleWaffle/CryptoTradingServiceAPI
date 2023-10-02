import { Injectable, Logger } from '@nestjs/common';
import { CcxtService } from './ccxt/ccxt.service';
import { RedisUserService } from '@cupo/backend/storage';
import { ExchangeConfig, TradeOrder, User } from '@cupo/backend/interface';
import { REST_API_RESPONSE_STATUS, USER_EXCHANGE_STATUS, userRepresentation } from '@cupo/backend/constant';
import { Cron } from '@nestjs/schedule';
import { TIMEFRAME } from '@cupo/timeseries';
import { Dictionary } from 'ccxt';

@Injectable()
export class AppService {
  private balanceUpdates = false;
  private usersBalances: { [user: string]: number } = {};

  constructor(private readonly exchange: CcxtService, private readonly redisUser: RedisUserService) {}

  getData(): { message: string } {
    return { message: `USER EXCHANGE SERVER OK: ${process.uptime()}` };
  }

  async closeOrder(order: TradeOrder): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    try {
      const exchangeOrder = await this.exchange.closeOrder(order);

      if (typeof exchangeOrder === 'string') {
        return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, exchangeOrder, null];
      }

      return [REST_API_RESPONSE_STATUS.SUCCESS, 'Order closed on the exchange', exchangeOrder || {}];
    } catch (err) {
      Logger.error(err.message, 'Exchange.closeExchangeOrder()');

      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, err.message, null];
    }
  }

  async openBuy(order: TradeOrder): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    try {
      const answer = await this.exchange.openBuy(order);

      if (typeof answer === 'string') {
        return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, answer, null];
      }

      return [REST_API_RESPONSE_STATUS.SUCCESS, 'Buy order opened', answer || {}];
    } catch (err) {
      Logger.error(err.message, 'Exchange.openBuy');

      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, err.message, null];
    }
  }

  async openSell(order: TradeOrder): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    try {
      const answer = await this.exchange.openSell(order);

      if (typeof answer === 'string') {
        return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, answer, null];
      }

      return [REST_API_RESPONSE_STATUS.SUCCESS, 'Sell order opened', answer || {}];
    } catch (err) {
      Logger.error(err.message, 'Exchange.openSell');

      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, err.message, null];
    }
  }

  async getWalletBalances(data: {
    userId: string;
    exchangeId: string;
    status?: USER_EXCHANGE_STATUS;
  }): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    const { userId, exchangeId, status } = data;

    if (!this.exchange.initialized) {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, 'Exchange not initialized yet', null];
    }

    if (!userId || !exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `User id or exchange id not provided`, null];
    }

    const balance = await this.exchange.getWalletBalances({ userId, exchangeId, status });
    if (typeof balance === 'string') {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, balance, null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Wallet balances', balance];
  }

  async fetchCandles(data: {
    exchangeId: string;
    symbol: string;
    timeframe: TIMEFRAME; // 1m, 1h, 1d
    since?: number;
    limit?: number;
  }): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    const { exchangeId, symbol, timeframe } = data;

    if (!this.exchange.initialized) {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, 'Exchange not initialized yet', null];
    }

    if (!exchangeId || !symbol || !timeframe) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Exchange id, symbol or timeframe not provided`, null];
    }

    const candles = await this.exchange.fetchCandles(data);
    if (typeof candles === 'string') {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, candles, null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Candles fetched', candles];
  }

  async fetchMarkets(data: {
    exchangeId: string;
    baseOnly: boolean;
    activeOnly: boolean;
    spotOnly: boolean;
  }): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    const { exchangeId } = data;

    if (!this.exchange.initialized) {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, 'Exchange not initialized yet', null];
    }

    if (!exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Exchange id not provided`, null];
    }

    const markets = await this.exchange.fetchMarkets(data);
    if (typeof markets === 'string') {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, markets, null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Markets fetched', markets];
  }

  async getTimeframes(
    exchangeId: string
  ): Promise<[REST_API_RESPONSE_STATUS, string, Dictionary<number | string> | null]> {
    if (!this.exchange.initialized) {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, 'Exchange not initialized yet', null];
    }

    if (!exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Exchange id not provided`, null];
    }

    const timeframes = this.exchange.getTimeframes(exchangeId);
    if (!timeframes) {
      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, `Timeframes [${exchangeId}] not found`, null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Timeframes fetched', timeframes];
  }

  //****************
  //*** CRON JOBS
  //****************

  @Cron('*/5 * * * * *')
  async updateUsersInfo(): Promise<void> {
    if (!this.exchange.initialized) {
      return;
    }

    // TODO: delete exchanges after all orders are closed
    const deleted = await this.redisUser.getUsers(undefined, true);
    if (deleted?.length) {
      this.exchange.deleteUsersExchanges(deleted.map((user) => user.id));
    }

    const users = await this.redisUser.getUsers();
    if (users?.length) {
      let res = [];
      for (const user of users) {
        res.push(this.exchange.updateUserExchanges(user));
      }

      res = await Promise.all(res);

      if (res?.filter((result) => result === true).length) {
        Logger.verbose(`*** Updated users info ${res.filter((result) => result === true).length} of ${users.length}`);
      }
    }
  }

  @Cron('0 */1 * * * *')
  async updateProxyServers(): Promise<void> {
    if (!this.exchange.initialized) {
      return;
    }

    await this.exchange.updateProxyServers();
  }

  private async updateWalletBalances(params: { user: User; config: ExchangeConfig }): Promise<void> {
    const { user, config } = params;

    try {
      const balances = await this.exchange.getWalletBalances({
        userId: user.id,
        exchangeId: config.exchangeId,
        status: config.status,
      });

      if (typeof balances === 'string') {
        Logger.warn(balances, 'updatePendingExchangeSettings');

        await this.redisUser.setWalletBalance({
          userId: user.id,
          exchangeId: config.exchangeId,
          balances: null,
        });

        return;
      }

      await this.redisUser.setWalletBalance({
        userId: user.id,
        exchangeId: config.exchangeId,
        balances,
      });

      if (
        this.usersBalances?.[`${config.exchangeId}_${user.id}`] === undefined ||
        this.usersBalances[`${config.exchangeId}_${user.id}`] !== (balances?.[config.baseCurrency]?.free || 0)
      ) {
        this.usersBalances[`${config.exchangeId}_${user.id}`] = balances?.[config.baseCurrency]?.free || 0;

        Logger.log(
          `BALANCE [${config.exchangeId}] user ${userRepresentation(user)}: ${config.baseCurrency} ${this.usersBalances[
            `${config.exchangeId}_${user.id}`
          ].toFixed(4)}`
        );
      }
    } catch (err) {
      Logger.error(
        `*** Error updating user balances [${config?.exchangeId}] ${userRepresentation(user)}: ${err?.message}`
      );

      await this.redisUser.setWalletBalance({
        userId: user?.id,
        exchangeId: config?.exchangeId,
        balances: null,
      });
    }
  }

  @Cron('*/5 * * * * *')
  private async updatePendingExchangeSettings(): Promise<void> {
    if (!this.exchange.initialized) {
      return;
    }

    if (this.balanceUpdates) {
      return;
    }

    this.balanceUpdates = true;

    const users = await this.redisUser.getUsers();

    for (const user of users) {
      if (user.exchanges) {
        for (const exchangeConfig of user.exchanges) {
          const update = await this.redisUser.getWalletBalanceLastUpdate(user.id, exchangeConfig.exchangeId);

          if (exchangeConfig.status === USER_EXCHANGE_STATUS.PENDING) {
            setTimeout((data) => this.updateWalletBalances(data), 50, {
              user,
              config: exchangeConfig,
            });
          } else if (!exchangeConfig.status) {
            user.exchanges = user.exchanges.map((config) => {
              if (!config.status) {
                config.status = !(
                  config.publicKey?.length &&
                  config.secretKey?.length &&
                  (config.exchangeId !== 'coinbasepro' ||
                    (config.exchangeId === 'coinbasepro' && config.passphrase?.length))
                )
                  ? USER_EXCHANGE_STATUS.NOT_CONFIGURED
                  : USER_EXCHANGE_STATUS.PENDING;
              }

              return config;
            });
            await this.redisUser.setUser(user, false);

            console.log('******* changed user exchanges: ', user.email, user.name, user.id);
          } else if (
            exchangeConfig.status === USER_EXCHANGE_STATUS.ACTIVE &&
            Date.now() - update > 5000 + Math.random() * 5000
          ) {
            setTimeout(() => this.updateWalletBalances({ user, config: exchangeConfig }), 50, {
              user,
              config: exchangeConfig,
            });
          }
        }
      }
    }

    this.balanceUpdates = false;
  }
}
