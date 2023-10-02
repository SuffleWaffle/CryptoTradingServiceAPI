import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Balances } from 'ccxt';
import { REDIS_ENTITY_TYPE, USER_EXCHANGE_STATUS } from '@cupo/backend/constant';
import { User } from '@cupo/backend/interface';
import { RedisService } from './redis.service';

@Injectable()
export class RedisUserService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.USERS);
  }

  // *** common methods ***

  private async setUserHash(user: User): Promise<void> {
    await this.setHash(this.getUsersKey(), { [user.id]: JSON.stringify(user) });
  }

  async deleteUser(userId: string): Promise<User | null> {
    let user = await this.getUser({ userId });
    if (!user) {
      return null;
    }

    user = {
      ...user,
      deleted: true,
      active: false,
      email: `Deleted`,
      name: `Deleted`,
      password: `Deleted`,
      exchanges: user.exchanges?.map((exchange) => ({
        ...exchange,
        active: false,
        publicKey: undefined,
        secretKey: undefined,
        passphrase: undefined,
      })),
    };
    delete user['info'];
    delete user['userId'];
    delete user['nickname'];
    delete user['badRequestCount'];

    return this.setUser(user);
  }

  async getUsers(active?: boolean, deleted: boolean = false): Promise<User[]> {
    const res: User[] = [];

    const users = await this.getHash(this.getUsersKey());

    Object.entries(users || {}).forEach(([, userHash]) => {
      const user = JSON.parse(userHash);

      if (
        (active === undefined || user.active === active) &&
        ((deleted && user.deleted) || (!deleted && !user.deleted))
      ) {
        res.push(user);
      }
    });

    return res;
  }

  async getDeletedUsers(): Promise<User[]> {
    const res: User[] = [];

    const users = await this.getHash(this.getUsersKey());

    Object.entries(users || {}).forEach(([, userHash]) => {
      const user = JSON.parse(userHash);

      if (user.deleted) {
        res.push(user);
      }
    });

    return res;
  }

  async getUser(props: { userId?: string; email?: string; platformId?: number }): Promise<User | null> {
    const { userId, email, platformId } = props;

    let user, hash;

    if (userId) {
      hash = await this.getHashValue(this.getUsersKey(), userId);
      if (hash?.length) {
        user = JSON.parse(hash);
      }
    } else if (email) {
      const users = await this.getUsers();

      user = users.find((usr) => usr.email?.toLowerCase() === email?.toLowerCase());
    } else if (platformId) {
      const users = await this.getUsers();

      user = users.find((usr) => +usr.platformId === platformId);
    }

    return user || null;
  }

  async getNewPlatformId(): Promise<number> {
    const hash = await this.getKey(this.getUsersKey() + 'platformId');

    const platformId: number = parseInt(hash || '100122', 10) + 1;

    await this.setKey(this.getUsersKey() + 'platformId', platformId.toString());

    return platformId;
  }

  async addNewUser(user: User): Promise<User | null> {
    return user ? await this.setUser({ ...user, id: user.id || randomUUID() }) : null;
  }

  async setUser(user: User, updateTimestamp = true): Promise<User | null> {
    if (!user?.id?.length) {
      Logger.error(`User id not provided`, 'RedisUserService.setUser');
      return null;
    }

    const storedUser: User = await this.getUser({ userId: user.id });

    const userObj = { ...user };
    Object.keys(userObj).forEach((key) =>
      userObj[key] === undefined || userObj[key] === null ? delete userObj[key] : {}
    );

    if (!userObj.platformId) {
      userObj.platformId = await this.getNewPlatformId();
    }

    // const newUser: User = {
    //   ...(storedUser || {}),
    //   ...userObj,
    //   update: new Date().getTime(),
    // };

    const timestamp = new Date().getTime();

    const newUser: User = {
      ...userObj,
      active: user.active === undefined && storedUser ? storedUser.active : user?.active,
      avatarId: user.avatarId || storedUser?.avatarId,
      name: user.name || storedUser?.name || user['nickname'] || storedUser?.['nickname'],
      email: user.email || storedUser?.email,
      emailVerified: user.emailVerified === undefined && storedUser ? storedUser?.emailVerified : user?.emailVerified,
      adminApproved: user.adminApproved ?? storedUser.adminApproved ?? false,
      password: user.password || storedUser?.password,
      exchanges: user.exchanges || storedUser?.exchanges,
      currencies: user.currencies || storedUser?.currencies,
      excludedCurrencies: user.excludedCurrencies || storedUser?.excludedCurrencies,
      strategy: user.strategy || storedUser?.strategy,
      badRequestCount: user.badRequestCount || storedUser?.badRequestCount,
      virtualBalance: user.virtualBalance || storedUser?.virtualBalance,

      referralCode: user.referralCode || storedUser?.referralCode,
      subscriptionBought: user.subscriptionBought || storedUser?.subscriptionBought || 0,

      created: storedUser?.created || timestamp,
      update: updateTimestamp ? timestamp : storedUser?.update || timestamp,
    };

    await this.setUserHash(newUser);

    return this.getUser({ userId: newUser.id });
  }

  // ********************
  // *** USER BALANCE ***
  // ********************

  async getUserBaseCurrency(userId: string, exchangeId: string): Promise<string | null> {
    const userHash = await this.getHashValue(this.getUsersKey(), userId);
    if (!userHash?.length) {
      Logger.warn(`User hash ${userId} not found`);
      return null;
    }
    const user = JSON.parse(userHash);

    const exchange = user.exchanges?.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      Logger.warn(`Exchange ${exchangeId} not found for user ${userId}`);
      return null;
    }

    return exchange?.baseCurrency?.length ? exchange?.baseCurrency : null;
  }

  async setWalletBalance(props: { userId: string; exchangeId: string; balances: Balances }): Promise<void> {
    const { userId, exchangeId, balances } = props;

    if (!userId || !exchangeId) {
      Logger.error(`Invalid params ${exchangeId} ${userId}`, 'RedisUserService.setWalletBalance');
      return null;
    }

    if (!balances) {
      await this.deleteHash(this.getBalanceKey(exchangeId), userId);
      await this.setHash(`${this.getBalanceKey(exchangeId)}Update`, { [userId]: new Date().getTime().toString() });
      return;
    }

    const { info, free, used, total, ...rest } = balances;

    if (rest && Object.keys(rest).length) {
      Object.entries(rest).forEach(([currency]) => {
        if ((rest[currency]?.total || 0) <= 0) {
          delete rest[currency];
        }
      });
    }

    await this.setHash(this.getBalanceKey(exchangeId), { [userId]: JSON.stringify(rest) });
    await this.setHash(`${this.getBalanceKey(exchangeId)}Update`, { [userId]: new Date().getTime().toString() });
  }

  async getWalletBalanceLastUpdate(userId: string, exchangeId: string): Promise<number> {
    const balanceUpdate = await this.getHashValue(`${this.getBalanceKey(exchangeId)}Update`, userId);

    return +(balanceUpdate || 0);
  }

  async getWalletBalance(userId: string, exchangeId: string): Promise<Balances | null> {
    const balanceHash = await this.getHashValue(this.getBalanceKey(exchangeId), userId);

    return balanceHash ? JSON.parse(balanceHash) : null;
  }

  async decreaseWalletBalance(props: {
    userId: string;
    exchangeId: string;
    currency: string;
    sum: number;
  }): Promise<number | null> {
    const { userId, exchangeId, currency, sum } = props;

    if (!userId || !exchangeId || !currency || !sum) {
      Logger.error(
        `Invalid params ${exchangeId} ${userId} ${currency} ${sum}`,
        'RedisUserService.decreaseWalletBalance'
      );
      return null;
    }

    const balanceHash = await this.getHashValue(this.getBalanceKey(props.exchangeId), props.userId);
    const balances = balanceHash ? JSON.parse(balanceHash) : null;

    if (!balances || balances[props.currency] === undefined || balances[props.currency].free === undefined) {
      return null;
    }

    if (balances[props.currency].free < props.sum) {
      return 0;
    }

    balances[props.currency].free = balances[props.currency].free - props.sum;

    await this.setWalletBalance({ userId, exchangeId, balances });

    return balances[props.currency].free;
  }

  // *************************
  // *** EXCHANGE KEYS ***
  // *************************

  async changeExchangeStatus(
    userId: string,
    exchangeId: string,
    status: USER_EXCHANGE_STATUS,
    error?: string
  ): Promise<boolean> {
    const user = await this.getUser({ userId });
    if (!user?.id) {
      return false;
    }

    const exchange = user.exchanges?.find((exchange) => exchange.exchangeId === exchangeId);
    if (!exchange) {
      Logger.warn(`Exchange ${exchangeId} not found for user ${userId}`);
      return false;
    }

    if (exchange.status === status && (exchange.lastError || '') === (error || '')) {
      return false;
    }

    exchange.status = status;

    if (status === USER_EXCHANGE_STATUS.ACTIVE) {
      exchange.lastError = '';
    } else if (!status || status === USER_EXCHANGE_STATUS.NOT_CONFIGURED) {
      exchange.lastError = 'Key are configured incorrectly';
    } else {
      exchange.lastError = error ?? exchange.lastError;
    }

    return !!(await this.setUser(user));
  }

  // ***********************
  // *** VIRTUAL BALANCE ***
  // ***********************

  async getVirtualBalance(params: { userId: string; exchangeId: string }): Promise<number> {
    const { userId, exchangeId } = params;

    const user = await this.getUser({ userId });
    if (!user?.id) {
      return 0;
    }

    if (!user.virtualBalance || typeof user.virtualBalance !== 'object') {
      user.virtualBalance = {};

      await this.setUserHash(user);
    }
    if (!user.virtualBalance[exchangeId]) {
      user.virtualBalance[exchangeId] = 1000000;

      await this.setUserHash(user);
    }

    return user.virtualBalance[exchangeId];
  }

  async renewVirtualBalance(params: { userId: string; exchangeId: string }): Promise<number> {
    const { userId, exchangeId } = params;

    const user = await this.getUser({ userId });
    if (!user?.id) {
      return 0;
    }

    if (!user.virtualBalance || typeof user.virtualBalance !== 'object') {
      user.virtualBalance = {};
    }
    user.virtualBalance[exchangeId] = 1000000;

    await this.setUserHash(user);

    return user.virtualBalance[exchangeId];
  }

  async decreaseVirtualBalance(params: { userId: string; exchangeId: string; sum: number }): Promise<number> {
    const { userId, exchangeId, sum } = params;

    const user = await this.getUser({ userId });
    if (!user?.id) {
      return 0;
    }

    const userBalance = await this.getVirtualBalance({ userId, exchangeId });

    if (sum > userBalance) {
      Logger.warn(
        `decreaseVirtualBalance(): Sum must be smaller than balance ${+userBalance.toFixed(2)} for ${JSON.stringify(
          params
        )}`
      );

      return userBalance;
    }

    if (!user.virtualBalance) {
      user.virtualBalance = {};
    }
    user.virtualBalance[exchangeId] = userBalance - sum;

    await this.setUserHash(user);

    return user.virtualBalance[exchangeId];
  }

  async increaseVirtualBalance(params: { userId: string; exchangeId: string; sum: number }): Promise<number> {
    const { userId, exchangeId, sum } = params;

    const user = await this.getUser({ userId });
    if (!user?.id) {
      return 0;
    }

    const userBalance = await this.getVirtualBalance({ userId, exchangeId });

    if (sum <= 0) {
      Logger.warn(`increaseVirtualBalance(): Sum must be greater than 0 for ${JSON.stringify(params)}`);

      return userBalance;
    }

    if (!user.virtualBalance) {
      user.virtualBalance = {};
    }
    user.virtualBalance[exchangeId] = userBalance + sum;

    await this.setUserHash(user);

    return user.virtualBalance[exchangeId];
  }

  // ********************
  // *** VERIFY CODES ***
  // ********************

  // OTP code expires in 30 minutes
  async addOtpCode(uniqueUserKey: string, code: string, expiration?: number): Promise<void> {
    await this.setKey(`${this.getUsersKey()}:OTP:${uniqueUserKey}`, code, expiration || 60 * 30);
  }

  async deleteOtpCode(uniqueUserKey: string): Promise<void> {
    await this.deleteKey(`${this.getUsersKey()}:OTP:${uniqueUserKey}`);
  }

  async getOtpCode(uniqueUserKey: string): Promise<string | null> {
    return this.getKey(`${this.getUsersKey()}:OTP:${uniqueUserKey}`);
  }
}
