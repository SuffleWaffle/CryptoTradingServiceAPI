import { Injectable, Logger } from '@nestjs/common';
import {
  AccountMongodbService,
  PlatformMongodbService,
  RedisCandleService,
  RedisTickerService,
  RedisUserService,
  UserMongodbService,
} from '@cupo/backend/storage';
import { getCandleTime, TIMEFRAME } from '@cupo/timeseries';
import { SubscriptionService } from '@cupo/backend/services';
import { OTP_PREFIX } from '@cupo/mail';
import {
  ContinueUserAccountSubscription,
  EVENT_TYPE,
  ExchangeConfig,
  IGetAccountBalances,
  IGetAllUsers,
  ProxyInterface,
  ReferralReward,
  UpdateUserExchangeKeysBodyDto,
  User,
  UserAccountBalance,
  UserAccountChangeBalance,
  UserAccountChangeBalanceBodyDto,
  UserAccountTransferBalance,
  UserProxyInterface,
  UserReferral,
  UserReferralsResponse,
  UserSnapshotResponse,
  UserWalletBalances,
} from '@cupo/backend/interface';
import {
  DEFAULT_PRODUCT,
  EnabledProductInterface,
  getAllProducts,
  getEnabledExchangeIds,
  getEnabledExchanges,
  MILLIS_IN_DAY,
  ProductInterface,
  REST_API_RESPONSE_STATUS,
  USER_EXCHANGE_STATUS,
  userRepresentation,
} from '@cupo/backend/constant';
import { EventService } from '@cupo/event';
import { ExchangeLibService } from '@cupo/exchange';

@Injectable()
export class UserService {
  constructor(
    private readonly subService: SubscriptionService,
    private readonly redisUser: RedisUserService,
    private readonly redisCandle: RedisCandleService,
    private readonly redisTicker: RedisTickerService,
    private readonly mongoAccount: AccountMongodbService,
    private readonly mongoUser: UserMongodbService,
    private readonly mongoPlatform: PlatformMongodbService,
    private readonly events: EventService
  ) {}

  async getUsers(active?: boolean): Promise<User[]> {
    return this.redisUser.getUsers(active);
  }

  async getAllUsers(params: IGetAllUsers): Promise<{ totalItems: number; users: User[] }> {
    // console.log('getAllUsers', params);

    if (params?.userId || params?.userEmail || params?.userPlatformId) {
      const user = await this.redisUser.getUser({
        userId: params.userId,
        email: params.userEmail,
        platformId: params.userPlatformId,
      });

      if (user) {
        params.userIds = [user.id];

        delete params.userId;
        delete params.userEmail;
        delete params.userName;
        delete params.userPlatformId;
      }
    }

    if (!params.userIds && (params?.userEmail || params?.userName || params?.userId || params?.userPlatformId)) {
      const users = await this.redisUser.getUsers();
      for (const user of users) {
        if (params?.userEmail && !user.email?.toLowerCase()?.includes(params.userEmail.toLowerCase())) {
          continue;
        }

        if (params?.userName && !user.name?.toLowerCase()?.includes(params.userName.toLowerCase())) {
          continue;
        }

        if (params?.userId && !user.id?.toLowerCase()?.includes(params.userId.toLowerCase())) {
          continue;
        }

        if (params?.userPlatformId && user.platformId !== params.userPlatformId) {
          continue;
        }

        console.log(user.name, params.userName, user.platformId, params.userPlatformId);

        if (!params.userIds) {
          params.userIds = [];
        }

        params.userIds = [...params.userIds, user.id];

        // if (
        //   (params?.userEmail && user.email?.toLowerCase()?.includes(params.userEmail.toLowerCase())) ||
        //   (params?.userName && user.name?.toLowerCase()?.includes(params.userName.toLowerCase())) ||
        //   (params?.userId && user.id?.toLowerCase()?.includes(params.userId.toLowerCase())) ||
        //   (params?.userPlatformId && user.platformId === params.userPlatformId)
        // ) {
        //   console.log(user.name, params.userName, user.platformId, params.userPlatformId);
        //
        //   if (!params.userIds) {
        //     params.userIds = [];
        //   }
        //
        //   params.userIds = [...params.userIds, user.id];
        // }
      }

      if (params.userIds?.length) {
        delete params.userId;
        delete params.userEmail;
        delete params.userName;
        delete params.userPlatformId;
      }
    }
    if (params?.userIds?.length === 1) {
      params.userId = params.userIds[0];
      delete params.userIds;
    }
    if (!params?.userIds?.length) {
      delete params.userIds;
    }

    const { users, totalItems } = await this.mongoUser.getAllUsers(params);

    return {
      users,
      totalItems,
    };
  }

  async getUser(userId: string): Promise<User> {
    return this.redisUser.getUser({ userId });
  }

  async deleteUser(userId: string, otpCode: string): Promise<[REST_API_RESPONSE_STATUS, string, User | null]> {
    if (!userId || !otpCode) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    const code = await this.redisUser.getOtpCode(`${OTP_PREFIX.DELETE_ACCOUNT_VERIFICATION}${userId}`);
    if (!code) {
      return [REST_API_RESPONSE_STATUS.OTP_CODE_NOT_FOUND, `OTP code not found`, null];
    }

    if (code !== otpCode) {
      return [REST_API_RESPONSE_STATUS.OTP_CODE_NOT_VALID, `OTP code is incorrect`, null];
    }

    try {
      const user = await this.redisUser.deleteUser(userId);

      if (!user) {
        return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
      }

      await this.redisUser.deleteOtpCode(`${OTP_PREFIX.DELETE_ACCOUNT_VERIFICATION}${userId}`);

      return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, user];
    } catch (err) {
      Logger.error(err.message, err.stack, 'UserService.deleteUser');

      return [REST_API_RESPONSE_STATUS.REQUEST_EXTERNAL_ERROR, err.message, null];
    }
  }

  async addNewUser(user: User): Promise<string | User> {
    if (!user) {
      return 'User not provided';
    }

    if (user.id?.length) {
      Logger.error(`User id must geenrate automaticly, but <${user.id}> provided`, 'UserService.addNewUser');
      return `User id must geenrate automaticly, but <${user.id}> provided`;
    }
    delete user.id;

    // if (
    //   user.exchanges &&
    //   (!Array.isArray(user.exchanges) ||
    //     !user.exchanges.every((exchange) => Object.keys(ENABLED_EXCHANGES).includes(exchange.exchangeId)))
    // ) {
    //   return `Allowed the trade only on these exchanges: ${Object.keys(ENABLED_EXCHANGES).toString()}`;
    // }

    const newUser = await this.redisUser.addNewUser(user);

    return newUser ? newUser : 'User not created';
  }

  async updateUser(user: User): Promise<User | string> {
    if (!user?.id?.length) {
      return 'userId is required';
    }

    // if (
    //   user.exchanges &&
    //   (!Array.isArray(user.exchanges) ||
    //     !user.exchanges.every((exchange) => getEnabledExchangeIds().includes(exchange.exchangeId)))
    // ) {
    //   return `Allowed the trade only on these exchanges: ${Object.keys(ENABLED_EXCHANGES).toString()}`;
    // }

    const newUser = await this.redisUser.setUser(user);

    return newUser ? newUser : 'User not updated';
  }

  //************************
  //*** FAVORITE SYMBOLS ***
  //************************

  async addFavoriteSymbols(props: {
    userId: string;
    exchangeId: string;
    favoriteSymbols: string[];
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId, favoriteSymbols } = props;

    if (!userId || !exchangeId || !favoriteSymbols?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    if (!user.exchanges) {
      user.exchanges = [];
    }

    let exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      exchange = { exchangeId, baseCurrency: getEnabledExchanges()[exchangeId].baseCurrencies[0] };
      user.exchanges.push(exchange);
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    }

    if (!exchange.favoriteSymbols) {
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
      exchange.favoriteSymbols = [];
    }

    exchange.favoriteSymbols = Array.from(
      new Set([
        ...exchange.favoriteSymbols,
        ...favoriteSymbols.filter(
          (symbol) =>
            symbol.indexOf('/') > 0 &&
            ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol) === exchange.baseCurrency
        ),
      ])
    );

    const savedUser = await this.redisUser.setUser(user);

    if (!savedUser?.exchanges?.find((exchange) => exchange.exchangeId === exchangeId)?.favoriteSymbols?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_UPDATED, `User <${userId}> not updated`, null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      savedUser.exchanges.find((exchange) => exchange.exchangeId === exchangeId).favoriteSymbols,
    ];
  }

  async deleteFavoriteSymbols(props: {
    userId: string;
    exchangeId: string;
    favoriteSymbols: string[];
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId, favoriteSymbols } = props;

    if (!userId || !exchangeId || !favoriteSymbols?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    if (!user.exchanges?.length) {
      user.exchanges = [];
    }

    let exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      exchange = { exchangeId, baseCurrency: getEnabledExchanges()[exchangeId].baseCurrencies[0] };
      user.exchanges.push(exchange);
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    }

    if (!exchange.favoriteSymbols) {
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
      exchange.favoriteSymbols = [];
    }

    exchange.favoriteSymbols = exchange.favoriteSymbols.filter((symbol) => !favoriteSymbols.includes(symbol));

    const savedUser = await this.redisUser.setUser(user);

    if (!savedUser?.exchanges?.find((exchange) => exchange.exchangeId === exchangeId)?.favoriteSymbols) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_UPDATED, `User <${userId}> not updated`, null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      savedUser.exchanges.find((exchange) => exchange.exchangeId === exchangeId).favoriteSymbols,
    ];
  }

  async clearFavoriteSymbols(props: {
    userId: string;
    exchangeId: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId } = props;

    if (!userId || !exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    if (!user.exchanges?.length) {
      user.exchanges = [];
    }

    let exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      exchange = { exchangeId, baseCurrency: getEnabledExchanges()[exchangeId].baseCurrencies[0] };
      user.exchanges.push(exchange);
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    }
    exchange.favoriteSymbols = [];

    const savedUser = await this.redisUser.setUser(user);

    if (!savedUser?.exchanges?.find((exchange) => exchange.exchangeId === exchangeId)?.favoriteSymbols) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_UPDATED, `User <${userId}> not updated`, null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      savedUser.exchanges.find((exchange) => exchange.exchangeId === exchangeId).favoriteSymbols,
    ];
  }

  async getFavoriteSymbols(props: {
    userId: string;
    exchangeId: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId } = props;

    if (!userId || !exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    const exchange = user.exchanges?.find((exchange) => exchange.exchangeId === exchangeId);

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, exchange?.favoriteSymbols || []];
  }

  //************************
  //*** EXCHANGE KEYS ***
  //************************

  async getExchanges(userId: string): Promise<[REST_API_RESPONSE_STATUS, string, ExchangeConfig[]]> {
    if (!userId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `User ID not provided`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    if (!user.exchanges) {
      user.exchanges = [];
      await this.redisUser.setUser(user, false);
    }

    const userProxies = await this.mongoPlatform.getUserProxies({ userId });
    const freeProxies = await this.mongoPlatform.getFreeProxies();

    user.exchanges = user.exchanges.map((exchange: ExchangeConfig) => ({
      ...exchange,
      proxyIp: userProxies?.find((proxy) => proxy.exchangeId === exchange.exchangeId)?.ip || undefined,
      dedicatedIp: this.mongoPlatform.getRandomFreeProxyArray(freeProxies)?.ip || undefined,
      status: exchange?.status === undefined ? USER_EXCHANGE_STATUS.NOT_CONFIGURED : exchange.status,
    }));

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, user.exchanges];
  }

  async getExchangeProxyList(exchangeId: string): Promise<[REST_API_RESPONSE_STATUS, string, ProxyInterface[]]> {
    if (!exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Exchange ID not provided`, null];
    }

    const proxies = await this.mongoPlatform.getProxyList({ exchangeId });

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      proxies.map((proxy) => ({ ...proxy, username: undefined, password: undefined, port: undefined })),
    ];
  }

  async getAllProxyList(): Promise<[REST_API_RESPONSE_STATUS, string, ProxyInterface[]]> {
    const proxies = await this.mongoPlatform.getProxyList({});

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, proxies];
  }

  async addProxyServer(data: ProxyInterface): Promise<[REST_API_RESPONSE_STATUS, string, ProxyInterface[]]> {
    const { exchangeId, ip } = data;

    if (!ip) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `IP not provided`, null];
    }

    if (!exchangeId) {
      const exchanges = getEnabledExchangeIds();

      for (const exchangeId of exchanges) {
        await this.mongoPlatform.addProxyServer({ ...data, exchangeId });
      }
    } else {
      await this.mongoPlatform.addProxyServer(data);
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      await this.mongoPlatform.getProxyList({
        exchangeId: exchangeId || undefined,
        ip,
      }),
    ];
  }

  async deleteProxyServer(data: ProxyInterface): Promise<[REST_API_RESPONSE_STATUS, string, ProxyInterface[]]> {
    const { exchangeId, ip } = data;

    console.log(`deleteProxyServer`, data);

    if (!ip) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `IP not provided`, null];
    }

    await this.mongoPlatform.deleteProxyServer({ ip, exchangeId });

    const proxies = await this.mongoPlatform.getProxyList({ ip, exchangeId });

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, proxies];
  }

  async setUserProxy(data: UserProxyInterface): Promise<[REST_API_RESPONSE_STATUS, string, UserProxyInterface]> {
    const { userId, exchangeId, ip } = data;

    if (!userId || !exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User "${userId}" not found`, null];
    }

    const exchange = user.exchanges?.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, `Exchange "${exchangeId}" not found`, null];
    }

    exchange.proxyIp = ip || undefined;
    await this.redisUser.setUser(user);

    if (ip) {
      const answer = await this.mongoPlatform.setUserProxy({ userId, exchangeId, ip });
      // if value exists, then it is an error
      if (answer) {
        return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, answer, null];
      }

      return [
        REST_API_RESPONSE_STATUS.SUCCESS,
        `Proxy has been set`,
        await this.mongoPlatform.getUserProxy({
          exchangeId,
          userId,
        }),
      ];
    }

    await this.mongoPlatform.deleteUserProxy({ userId, exchangeId });
    return [REST_API_RESPONSE_STATUS.SUCCESS, `Proxy has been deleted`, null];
  }

  async updateExchangeKeys(
    props: UpdateUserExchangeKeysBodyDto
  ): Promise<[REST_API_RESPONSE_STATUS, string, ExchangeConfig[]]> {
    const { userId, exchangeId, publicKey, secretKey, passphrase, proxyIp, status } = props;

    if (!userId || !exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange [${exchangeId}] not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User "${userId}" not found`, null];
    }

    if (!user.exchanges) {
      user.exchanges = [];
    }

    const newStatus =
      status ||
      (!(
        publicKey?.length &&
        secretKey?.length &&
        (exchangeId !== 'coinbasepro' || (exchangeId === 'coinbasepro' && passphrase?.length))
      )
        ? USER_EXCHANGE_STATUS.NOT_CONFIGURED
        : USER_EXCHANGE_STATUS.PENDING);

    let exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      exchange = {
        exchangeId,
        status: newStatus,
        baseCurrency: getEnabledExchanges()[exchangeId].baseCurrencies[0],
        publicKey: publicKey?.length ? publicKey : undefined,
        secretKey: secretKey?.length ? secretKey : undefined,
        passphrase: passphrase?.length ? passphrase : undefined,
        proxyIp: proxyIp || undefined,
        symbols: [],
      };

      user.exchanges.push(exchange);
    } else {
      exchange.publicKey = publicKey?.length ? publicKey : undefined;
      exchange.secretKey = secretKey?.length ? secretKey : undefined;
      exchange.passphrase = passphrase?.length ? passphrase : undefined;
      exchange.proxyIp = proxyIp || undefined;
      exchange.status = newStatus;

      delete exchange['active'];
    }

    if (proxyIp) {
      await this.mongoPlatform.setUserProxy({ userId, exchangeId, ip: proxyIp });
    } else {
      await this.mongoPlatform.deleteUserProxy({ userId, exchangeId });
    }

    const savedUser = await this.redisUser.setUser(user);

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, savedUser.exchanges];
  }

  //**********************
  //*** TRADING STATUS ***
  //**********************

  async changeTradingStatus(props: {
    active: boolean;
    userId: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, boolean]> {
    const { active, userId } = props;

    if (!userId || active === undefined) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    const status = await this.subService.changeTradingStatus(user, active);

    if (status === null) {
      return [REST_API_RESPONSE_STATUS.SUBSCRIPTION_EXPIRED, `Subscription expired`, null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, status];
  }

  //************************
  //*** EXCHANGE SYMBOLS ***
  //************************

  async addExchangeSymbols(props: {
    userId: string;
    exchangeId: string;
    symbols: string[];
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId, symbols } = props;

    if (!userId || !exchangeId || !symbols?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    if (!user.exchanges?.length) {
      user.exchanges = [];
    }

    let exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      exchange = { exchangeId, baseCurrency: getEnabledExchanges()[exchangeId].baseCurrencies[0] };
      user.exchanges.push(exchange);
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    }

    if (!exchange.symbols) {
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
      exchange.symbols = [];
    }

    exchange.symbols = Array.from(
      new Set([
        ...exchange.symbols,
        ...symbols.filter(
          (symbol) =>
            symbol.indexOf('/') > 0 &&
            ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol) === exchange.baseCurrency
        ),
      ])
    );

    const savedUser = await this.redisUser.setUser(user);

    if (!savedUser?.exchanges?.find((exchange) => exchange.exchangeId === exchangeId)?.symbols?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_UPDATED, `User <${userId}> not updated`, null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      savedUser.exchanges.find((exchange) => exchange.exchangeId === exchangeId).symbols,
    ];
  }

  async deleteExchangeSymbols(props: {
    userId: string;
    exchangeId: string;
    symbols: string[];
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId, symbols } = props;

    if (!userId || !exchangeId || !symbols?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    if (!user.exchanges?.length) {
      user.exchanges = [];
    }

    let exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      exchange = { exchangeId, baseCurrency: getEnabledExchanges()[exchangeId].baseCurrencies[0] };
      user.exchanges.push(exchange);
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    }

    if (!exchange.symbols) {
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
      exchange.symbols = [];
    }

    exchange.symbols = exchange.symbols.filter((symbol) => !symbols.includes(symbol));

    const savedUser = await this.redisUser.setUser(user);

    if (!savedUser?.exchanges?.find((exchange) => exchange.exchangeId === exchangeId)?.symbols) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_UPDATED, `User <${userId}> not updated`, null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      savedUser.exchanges.find((exchange) => exchange.exchangeId === exchangeId).symbols,
    ];
  }

  async clearExchangeSymbols(props: {
    userId: string;
    exchangeId: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId } = props;

    if (!userId || !exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    if (!user.exchanges?.length) {
      user.exchanges = [];
    }

    let exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      exchange = { exchangeId, baseCurrency: getEnabledExchanges()[exchangeId].baseCurrencies[0] };
      user.exchanges.push(exchange);
      exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    }
    exchange.symbols = [];

    const savedUser = await this.redisUser.setUser(user);

    if (!savedUser?.exchanges?.find((exchange) => exchange.exchangeId === exchangeId)?.symbols) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_UPDATED, `User <${userId}> not updated`, null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      savedUser.exchanges.find((exchange) => exchange.exchangeId === exchangeId).symbols,
    ];
  }

  async getExchangeSymbols(props: {
    userId: string;
    exchangeId: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[]]> {
    const { userId, exchangeId } = props;

    if (!userId || !exchangeId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters are incorrect`, null];
    }

    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null];
    }

    const exchange = user.exchanges.find((exchange) => exchange.exchangeId === exchangeId);
    if (exchange?.symbols) {
      return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, exchange.symbols];
    } else {
      return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, []];
    }
  }

  //**********************
  //*** Wallet Balance ***
  //**********************
  async getUserWalletBalance(
    userId: string,
    exchangeId: string
  ): Promise<[REST_API_RESPONSE_STATUS, string, UserWalletBalances | ExchangeConfig | null, number | null]> {
    if (!getEnabledExchanges()[exchangeId]) {
      return [REST_API_RESPONSE_STATUS.EXCHANGE_NOT_SUPPORTED, `Exchange <${exchangeId}> not supported`, null, null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId}> not found`, null, null];
    }

    const exchange = user.exchanges?.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange || !exchange.status) {
      return [
        REST_API_RESPONSE_STATUS.USER_EXCHANGE_NOT_CONFIGURED,
        `User <${userId}> exchange <${exchangeId}> not configured`,
        null,
        null,
      ];
    }

    if (exchange.status !== USER_EXCHANGE_STATUS.ACTIVE) {
      return [
        REST_API_RESPONSE_STATUS.USER_EXCHANGE_NOT_ENABLED,
        `User <${userId}> exchange <${exchangeId}> status <${exchange.status}>`,
        exchange,
        null,
      ];
    }

    const baseCurrency = await this.redisUser.getUserBaseCurrency(userId, exchangeId);
    if (!baseCurrency) {
      Logger.warn(`User [${userId}] baseCurrency not found`, 'UserService.getUserWalletBalance');
      return [
        REST_API_RESPONSE_STATUS.USER_BASE_CURRENCY_NOT_FOUND,
        `User <${userId}> Base Currency for <${exchangeId}> not configured`,
        null,
        null,
      ];
    }

    // const balances = await this.redisUser.getWalletBalance(userId, exchangeId);
    // if (!balances) {
    //   Logger.warn(`User [${userId}] has no balances on exchange [${exchangeId}]`, 'UserService.getUserWalletBalance');
    //   return [
    //     REST_API_RESPONSE_STATUS.USER_WALLET_BALANCE_NOT_FOUND,
    //     `User <${userId}> has no balances on exchange <${exchangeId}>`,
    //     null,
    //   ];
    // }

    const userBalance = await this.mongoUser.getUserWallet({ userId, exchangeId });
    if (!userBalance?.balance) {
      Logger.warn(`User [${userId}] has no balances on exchange [${exchangeId}]`, 'UserService.getUserWalletBalance');
      return [
        REST_API_RESPONSE_STATUS.USER_WALLET_BALANCE_NOT_FOUND,
        `User <${userId}> has no balances on exchange <${exchangeId}>`,
        null,
        null,
      ];
    }

    const balance: UserWalletBalances = {};

    const balances = Object.entries(userBalance.balance);
    for (const [currency, value] of balances) {
      if (!value?.free) {
        continue;
      }

      const symbol = `${currency}/${baseCurrency}`;
      const prevCandle = await this.redisCandle.getCandle(
        exchangeId,
        symbol,
        TIMEFRAME.H1,
        getCandleTime(TIMEFRAME.H1, Date.now() - MILLIS_IN_DAY)
      );

      let price = await this.redisTicker.getMarketPrice(exchangeId, `${currency}/${baseCurrency}`);
      if (price) {
        balance[currency] = {
          free: value.free || 0,
          cost: +((value?.free || 0) * (currency === baseCurrency ? 1 : price?.bid || 0)).toFixed(6),
          price: price?.ask || 0,
          prevPrice: prevCandle?.close || price?.ask || 0,
        };
      } else {
        price = await this.redisTicker.getMarketPrice(exchangeId, `${baseCurrency}/${currency}`);
        if (price) {
          balance[currency] = {
            free: value.free || 0,
            cost: +((value?.free || 0) * (currency === baseCurrency ? 1 : price?.bid || 0)).toFixed(6),
            price: price?.ask || 0,
            prevPrice: prevCandle?.close || price?.ask || 0,
          };
        } else {
          if (currency !== baseCurrency) {
            balance[currency] = {
              free: value.free || 0,
              cost: 0,
              price: 0,
              prevPrice: 0,
            };
          } else {
            balance[currency] = {
              free: value.free || 0,
              cost: +(value.free || 0).toFixed(6),
              price: 1,
              prevPrice: 1,
            };
          }
        }
      }
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, balance, userBalance.updated || 0];
  }

  //************************
  //*** Account Balances ***
  //************************
  async getAllUserAccountBalances(
    params: IGetAccountBalances
  ): Promise<{ totalItems: number; balances: UserAccountBalance[] }> {
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
    if (params?.userIds?.length === 1) {
      params.userId = params.userIds[0];
      delete params.userIds;
    }

    const { balances, totalItems } = await this.mongoAccount.getAllAccountBalances(params);

    if (totalItems && !Object.keys(users).length) {
      for (const order of balances) {
        const user = await this.redisUser.getUser({ userId: order.userId });

        if (user) {
          users[user.id] = user;
        }
      }
    }

    return {
      balances: balances.map((balance) => ({
        ...(balance.updated
          ? { updatedHumanTime: new Date(balance.updated) }
          : {
              updatedHumanTime: undefined,
              updated: undefined,
            }),
        ...balance,

        userName: users[balance.userId]?.name,
        userEmail: users[balance.userId]?.email,
        userPlatformId: users[balance.userId]?.platformId,
      })),
      totalItems,
    };
  }

  async getUserAccountBalance(userId: string): Promise<UserAccountBalance | null> {
    return this.subService.getUserAccountBalance({ userId });
  }

  async setUserAccountBalance(data: UserAccountChangeBalance): Promise<UserAccountBalance | null> {
    return this.subService.setUserAccountBalance(data);
  }

  async changeUserAccountBalance(data: UserAccountChangeBalance): Promise<UserAccountBalance | null> {
    return this.subService.changeUserAccountBalance(data);
  }

  async changeAutoRenewSubscriptionStatus(data: UserAccountChangeBalance): Promise<UserAccountBalance | null> {
    return this.subService.changeAutoRenewSubscriptionStatus(data);
  }

  async addUserAccountBalance(
    data: UserAccountChangeBalance
  ): Promise<[REST_API_RESPONSE_STATUS, string, UserAccountBalance | null]> {
    const { userId, toMainBalance, toBonusBalance, toReferralBalance, toSubscriptionDays } = data;

    if (!userId?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Invalid user id', null];
    }

    if (toMainBalance < 0 || toBonusBalance < 0 || toReferralBalance < 0 || toSubscriptionDays < 0) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Invalid balance', null];
    }

    const balance: UserAccountBalance = await this.subService.addUserAccountBalance(data);
    if (!balance) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found', null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'success', balance];
  }

  async transferReferralBalance(body: {
    userId: string;
    sum: number;
    writeOffReminder?: boolean;
  }): Promise<[REST_API_RESPONSE_STATUS, string, UserAccountBalance | null]> {
    const { userId, sum, writeOffReminder } = body;

    if (!userId?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Invalid user id', null];
    }

    if (!sum || sum <= 0) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Invalid sum to transfer', null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found', null];
    }

    const balance: UserAccountBalance = await this.getUserAccountBalance(userId);
    if (!balance) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, 'Balance not found', null];
    }
    const balanceBefore = { ...balance };

    const reminder: number = balance.referralBalance - sum;
    let withdrawSum: number = 0;

    if (
      (reminder < 0 && !writeOffReminder) ||
      (reminder <= -1 && writeOffReminder) // < -$1 is a reminder
    ) {
      return [REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH, 'Insufficient funds', null];
    }

    if (writeOffReminder && ((reminder > 0 && reminder < 1) || (reminder > -1 && reminder < 0))) {
      withdrawSum = balance.referralBalance;
      balance.referralBalance = 0;
    } else {
      withdrawSum = sum;
      balance.referralBalance -= withdrawSum;
    }
    balance.mainBalance += withdrawSum;
    await this.mongoAccount.updateAccountBalance(balance);

    const transfer: UserAccountTransferBalance = {
      fromReferralBalance: withdrawSum,
      toBalance: 'main',
      userId,
      balanceBefore,
      balanceAfter: balance,
    };
    await this.mongoAccount.addAccountBalanceTransaction(transfer);

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'success', balance];
  }

  async minusUserAccountBalance(
    body: UserAccountChangeBalanceBodyDto
  ): Promise<[REST_API_RESPONSE_STATUS, string, UserAccountBalance | null]> {
    if (!body.userId?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Invalid user id', null];
    }

    const { userId } = body;

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found', null];
    }

    const balance: UserAccountBalance = await this.getUserAccountBalance(userId);
    if (!balance) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, 'Balance not found', null];
    }

    const timestamp = Date.now();

    balance.mainBalance -= body.toMainBalance || 0;
    balance.bonusBalance -= body.toBonusBalance || 0;
    balance.referralBalance -= body.toReferralBalance || 0;

    if (body.toSubscriptionDays) {
      balance.subscriptionActiveTill -= body.toSubscriptionDays * MILLIS_IN_DAY;
      balance.subscriptionActiveTillHuman = new Date(balance.subscriptionActiveTill);
      balance.subscriptionDaysLeft = +Math.max((balance.subscriptionActiveTill - timestamp) / MILLIS_IN_DAY, 0).toFixed(
        2
      );
    }

    if (balance.subscriptionActiveTill < timestamp) {
      return [REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH, 'Subscription days are not enough', null];
    }
    if (balance.mainBalance < 0) {
      return [REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH, 'Main balance is not enough', null];
    }
    if (balance.bonusBalance < 0) {
      return [REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH, 'Bonus balance is not enough', null];
    }
    if (balance.referralBalance < 0) {
      return [REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH, 'Referral balance is not enough', null];
    }

    await this.mongoAccount.updateAccountBalance(balance);

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'success', balance];
  }

  async continueUserAccountSubscription(
    data: ContinueUserAccountSubscription
  ): Promise<[REST_API_RESPONSE_STATUS, string, UserAccountBalance | null]> {
    const { userId, days, paymentId } = data;

    const products: EnabledProductInterface = await this.subService.getUserProducts(userId);
    let product: ProductInterface;
    if (data.product && products[data.product]) {
      product = products[data.product];
    } else {
      product = Object.values(products).find((product) => product.value === days);
    }
    if (!product) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, `Invalid subscription with ${days} days`, null];
    }

    if (!userId?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Invalid user ID', null];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found', null];
    }

    if (paymentId) {
      const payments = await this.mongoAccount.getPaymentsList({ paymentId, userId });
      if (!payments) {
        return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, 'Database error', null];
      }
      if (!payments.length) {
        return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, `Payment <${paymentId}> not found`, null];
      }
    }

    const balance = await this.subService.continueUserAccountSubscription(user.id, product, data.useReferral === true);
    if (!balance) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, 'Balance not found', null];
    }
    if (typeof balance === 'string') {
      return [REST_API_RESPONSE_STATUS.CONTINUE_SUBSCRIPTION_ERROR, balance, null];
    }
    if (typeof balance === 'number') {
      return [REST_API_RESPONSE_STATUS.BALANCE_NOT_ENOUGH, `Insufficient funds $${balance.toFixed(2)}`, null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'success', balance];
  }

  async resetTrials(userId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    if (!userId?.length) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Invalid user ID'];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found'];
    }

    let changed = false;

    if (!user.activatedSubscriptions) {
      user.activatedSubscriptions = user.activatedSubscriptions || [];
      changed = true;
    }

    const products: ProductInterface[] = Object.values(getAllProducts()).filter((product) => product.isTrial);
    const productIds = products.map((product) => product.id);

    productIds.forEach((productId) => {
      const index = user.activatedSubscriptions.indexOf(productId);
      if (index > -1) {
        user.activatedSubscriptions.splice(index, 1);
        changed = true;
      }
    });

    if (changed) {
      await this.redisUser.setUser(user);
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'success'];
  }

  async resetUserAccountBalance(userId: string): Promise<UserAccountBalance | null> {
    const user = await this.redisUser.getUser({ userId });

    let balance;
    if (user?.id?.length) {
      balance = await this.getUserAccountBalance(userId);
    }

    if (!balance) {
      return null;
    }

    balance.mainBalance = 0;
    balance.bonusBalance = 0;
    balance.referralBalance = 0;

    balance.subscriptionAutoRenewStatus = false;
    balance.subscriptionAutoRenewDays = DEFAULT_PRODUCT.value;

    balance.subscriptionActiveTill = Date.now();
    balance.subscriptionActiveTillHuman = new Date(balance.subscriptionActiveTill);
    balance.subscriptionDaysLeft = 0;

    await this.mongoAccount.updateAccountBalance(balance);

    return balance;
  }

  async getUserAccountSnapshot(userIdParam: string): Promise<UserSnapshotResponse | null> {
    return this.subService.getUserAccountSnapshot(userIdParam);
  }

  //*****************
  //*** REFERRALS ***
  //*****************
  async getReferralsReward(partnerId: string): Promise<ReferralReward[]> {
    return this.mongoAccount.getReferralRewards(partnerId);
  }

  async getReferrals(userIdParam: string): Promise<[REST_API_RESPONSE_STATUS, string, UserReferralsResponse | null]> {
    const user = await this.redisUser.getUser({ userId: userIdParam });
    if (!user?.id?.length) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found', null];
    }

    try {
      const { level1Referrals, level2Referrals } = await this.mongoAccount.getReferrals(userIdParam);
      const { level1Partner, level2Partner } = await this.mongoAccount.getReferralPartners(userIdParam);

      let level1ReferralsReward = 0,
        level2ReferralsReward = 0;
      if (level1Referrals.length || level1Referrals.length) {
        const rewards: ReferralReward[] = await this.mongoAccount.getReferralRewards(userIdParam);
        rewards.forEach((reward) => {
          if (reward.level === 1) {
            level1ReferralsReward += reward.sum;
          } else if (reward.level === 2) {
            level2ReferralsReward += reward.sum;
          }
        });
      }

      return [
        REST_API_RESPONSE_STATUS.SUCCESS,
        'success',
        {
          userId: userIdParam,
          level1Referrals,
          level2Referrals,
          level1Partner,
          level2Partner,
          level1ReferralsReward,
          level2ReferralsReward,
        },
      ];
    } catch (e) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, e.message, null];
    }
  }

  async addReferral(body: UserReferral): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return this.subService.addReferral(body);
  }

  async getUserProducts(userId: string): Promise<EnabledProductInterface> {
    return this.subService.getUserProducts(userId);
  }

  async allowUserManageOrders(data: IGetAllUsers): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const { userId, userEmail, userPlatformId } = data;

    if (!userId && !userEmail && !userPlatformId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `User ID not provided`];
    }

    const user = await this.redisUser.getUser({ email: userEmail, userId, platformId: userPlatformId });
    if (!user?.email) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User "${JSON.stringify(data)}" not found`];
    }

    user.allowManageOrders = true;
    await this.redisUser.setUser(user);

    await this.events.addUserEvent({
      userId: user.id,
      type: EVENT_TYPE.USER_MANAGE_ORDERS,
      event: 'User have requested permission to manage orders',
    });

    return [REST_API_RESPONSE_STATUS.SUCCESS, `User ${userRepresentation(user)} can manage orders`];
  }
}
