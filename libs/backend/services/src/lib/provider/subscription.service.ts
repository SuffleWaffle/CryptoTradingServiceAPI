import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_PRODUCT,
  EnabledProductInterface,
  getAllProducts,
  ISSUED_COUPONS,
  MILLIS_IN_DAY,
  ProductInterface,
  REST_API_RESPONSE_STATUS,
  USER_EXCHANGE_STATUS,
  userIdRepresentation,
} from '@cupo/backend/constant';
import { AccountMongodbService, PlatformMongodbService, RedisUserService } from '@cupo/backend/storage';
import {
  ExchangeConfig,
  User,
  UserAccountBalance,
  UserAccountChangeBalance,
  UserReferral,
  UserSnapshotResponse,
} from '@cupo/backend/interface';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly redisUser: RedisUserService,
    private readonly mongoAccount: AccountMongodbService,
    private readonly mongoPlatform: PlatformMongodbService
  ) {}

  //**********************
  //*** TRADING STATUS ***
  //**********************

  async changeTradingStatus(user: User, active: boolean): Promise<boolean | null> {
    if (user.active === active) {
      return true;
    }

    if (active) {
      const balance = await this.mongoAccount.getAccountBalance(user.id);
      if (!balance.subscriptionDaysLeft || balance.subscriptionDaysLeft <= 0) {
        return null;
      }
    }

    user.active = active;

    const savedUser = await this.redisUser.setUser(user);

    return savedUser.active;
  }

  //*****************
  //*** REFERRALS ***
  //*****************
  async addReferral(body: UserReferral): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const { userId, partnerId } = body;

    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found'];
    }

    const partner = await this.redisUser.getUser({ userId: partnerId });
    if (!partner) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'Partner not found'];
    }

    try {
      const id = await this.mongoAccount.addReferral({
        userId,
        partnerId,
      });

      return [REST_API_RESPONSE_STATUS.SUCCESS, id];
    } catch (e) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, e.message];
    }
  }

  async getReferralPartners(
    userId: string
  ): Promise<{ level1Partner: User | undefined; level2Partner: User | undefined }> {
    let level1Partner, level2Partner;
    const partners = await this.mongoAccount.getReferralPartners(userId);

    if (partners?.level1Partner) {
      level1Partner = await this.redisUser.getUser({ userId: partners.level1Partner });
    }

    if (partners?.level2Partner) {
      level2Partner = await this.redisUser.getUser({ userId: partners.level2Partner });
    }

    return { level1Partner, level2Partner };
  }

  async getUserProducts(userId: string): Promise<EnabledProductInterface> {
    const products = getAllProducts();
    const user = await this.redisUser.getUser({ userId });

    let array = [
      ...Object.values(products).filter(
        (product) => !(product.isTrial && (user.activatedSubscriptions || []).includes(product.id))
      ),
    ];

    // *** USER COUPONS ***
    // if a non-trial product is not already activated, test the discount coupon - DISCOUNT_50_PERCENT_REFERRAL
    if (!user.activatedSubscriptions?.includes(ISSUED_COUPONS.DISCOUNT_50_PERCENT_REFERRAL)) {
      const partners = await this.getReferralPartners(userId);
      // console.log('partners', partners, user);

      if (
        partners?.level1Partner?.activatedCoupons?.length &&
        partners.level1Partner.activatedCoupons.includes(ISSUED_COUPONS.DISCOUNT_50_PERCENT_REFERRAL)
      ) {
        array = array.map((product) => {
          // reset links to the base product object
          const res = { ...product };
          res.cost = +((res.cost || 0) / 2).toFixed(2);

          return res;
        });
      }
    }

    return array.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
  }

  //*********************
  //*** USER SNAPSHOT ***
  //*********************
  async getUserAccountSnapshot(userIdParam: string): Promise<UserSnapshotResponse | null> {
    const user = await this.redisUser.getUser({ userId: userIdParam });
    if (!user) {
      return null;
    }

    const { userId, _id, ...accountBalance } = await this.getUserAccountBalance({ userId: userIdParam });

    const userProxies = await this.mongoPlatform.getUserProxies({ userId });
    const freeProxies = await this.mongoPlatform.getFreeProxies();

    return {
      userId,
      accountBalance,
      generalInfo: {
        email: user.email || '',
        name: user.name || user['nickname'] || '',
        emailVerified: user.emailVerified || false,
        adminApproved: user.adminApproved || false,
        allowManageOrders: user.allowManageOrders || false,
        avatarId: user.avatarId || '',
        registerDate: user.created || 0,
      },
      subscription: {
        autoRenew: accountBalance.subscriptionAutoRenewStatus,
        subscriptionActiveTill: accountBalance.subscriptionActiveTill,
        subscriptionActiveTillHuman: accountBalance.subscriptionActiveTillHuman,
        subscriptionDaysLeft: accountBalance.subscriptionDaysLeft,
      },
      tradeInfo: {
        active: user.active || false,
        currencies: user.currencies || [],
        excludedCurrencies: user.excludedCurrencies || [],
      },
      exchanges: (user.exchanges || [])?.map((exchange: ExchangeConfig) => ({
        ...exchange,
        proxyIp: userProxies?.find((proxy) => proxy.exchangeId === exchange.exchangeId)?.ip || undefined,
        dedicatedIp: this.mongoPlatform.getRandomFreeProxyArray(freeProxies)?.ip || undefined,
        status: exchange?.status === undefined ? USER_EXCHANGE_STATUS.NOT_CONFIGURED : exchange.status,
      })),
    };
  }

  //************************
  //*** Account Balances ***
  //************************
  async getUserAccountBalance(data: { userId?: string; user?: User }): Promise<UserAccountBalance | null> {
    const { userId, user } = data;

    if (user) {
      return this.mongoAccount.getAccountBalance(user.id);
    }

    if (userId) {
      const user = await this.redisUser.getUser({ userId });
      if (!user) {
        return null;
      }

      return this.mongoAccount.getAccountBalance(userId);
    }

    return null;
  }

  async setUserAccountBalance(data: UserAccountChangeBalance): Promise<UserAccountBalance | null> {
    const {
      userId,
      subscriptionAutoRenewStatus,
      subscriptionAutoRenewDays,
      toMainBalance,
      toBonusBalance,
      toReferralBalance,
      toSubscriptionDays,
    } = data;

    const balance: UserAccountBalance = await this.getUserAccountBalance({ userId });
    if (!balance) {
      return null;
    }

    const timestamp = Date.now();

    balance.mainBalance = toMainBalance !== undefined ? toMainBalance : balance.mainBalance || 0;
    balance.bonusBalance = toBonusBalance !== undefined ? toBonusBalance : balance.bonusBalance || 0;
    balance.referralBalance = toReferralBalance !== undefined ? toReferralBalance : balance.referralBalance || 0;

    balance.subscriptionAutoRenewStatus =
      subscriptionAutoRenewStatus !== undefined
        ? subscriptionAutoRenewStatus
        : balance.subscriptionAutoRenewStatus || false;

    const products = await this.getUserProducts(userId);
    if (
      subscriptionAutoRenewDays &&
      !Object.values(products).find((product) => product.value === subscriptionAutoRenewDays)
    ) {
      Logger.error(
        `Invalid subscriptionAutoRenewDays value: ${subscriptionAutoRenewDays} user <${userIdRepresentation(userId)}>`,
        'SubscriptionService.setUserAccountBalance'
      );
      balance.subscriptionAutoRenewDays = balance.subscriptionAutoRenewDays || DEFAULT_PRODUCT.value;
    } else {
      balance.subscriptionAutoRenewDays =
        subscriptionAutoRenewDays || balance.subscriptionAutoRenewDays || DEFAULT_PRODUCT.value;
    }

    if (balance.subscriptionActiveTill !== (toSubscriptionDays || 0) * MILLIS_IN_DAY) {
      balance.subscriptionActiveTill = timestamp + (Math.max(toSubscriptionDays || 0, 0) || 0) * MILLIS_IN_DAY;
      balance.subscriptionActiveTillHuman = new Date(balance.subscriptionActiveTill);
      balance.subscriptionDaysLeft = Math.round(
        Math.max((balance.subscriptionActiveTill - timestamp) / MILLIS_IN_DAY, 0)
      );
    }

    await this.mongoAccount.updateAccountBalance(balance);

    return balance;
  }

  async changeUserAccountBalance(data: UserAccountChangeBalance): Promise<UserAccountBalance | null> {
    const { userId, toMainBalance, toBonusBalance, toReferralBalance, toSubscriptionDays } = data;

    const balance: UserAccountBalance = await this.getUserAccountBalance({ userId });
    if (!balance) {
      return null;
    }

    if (toMainBalance !== undefined && toMainBalance >= 0) {
      balance.mainBalance = toMainBalance;
    }

    if (toBonusBalance !== undefined && toBonusBalance >= 0) {
      balance.bonusBalance = toBonusBalance;
    }

    if (toReferralBalance !== undefined && toReferralBalance >= 0) {
      balance.referralBalance = toReferralBalance;
    }

    if (toSubscriptionDays !== undefined && toSubscriptionDays >= 0) {
      const timestamp = Date.now();
      balance.subscriptionActiveTill = timestamp + toSubscriptionDays * MILLIS_IN_DAY;
      balance.subscriptionActiveTillHuman = new Date(balance.subscriptionActiveTill);
      balance.subscriptionDaysLeft = Math.round(
        Math.max((balance.subscriptionActiveTill - timestamp) / MILLIS_IN_DAY, 0)
      );
    }

    await this.mongoAccount.updateAccountBalance(balance);

    return balance;
  }

  async addUserAccountBalance(data: UserAccountChangeBalance): Promise<UserAccountBalance | null> {
    const { userId, toMainBalance, toBonusBalance, toReferralBalance, toSubscriptionDays } = data;

    const balance: UserAccountBalance = await this.getUserAccountBalance({ userId });
    if (!balance) {
      return null;
    }

    const timestamp = Date.now();

    balance.mainBalance += toMainBalance || 0;
    balance.bonusBalance += toBonusBalance || 0;
    balance.referralBalance += toReferralBalance || 0;

    if (toSubscriptionDays) {
      balance.subscriptionActiveTill += toSubscriptionDays * MILLIS_IN_DAY;
      balance.subscriptionActiveTillHuman = new Date(balance.subscriptionActiveTill);
      balance.subscriptionDaysLeft = +Math.max((balance.subscriptionActiveTill - timestamp) / MILLIS_IN_DAY, 0).toFixed(
        2
      );
    }

    await this.mongoAccount.updateAccountBalance(balance);

    return balance;
  }

  //********************
  //*** Subscription ***
  //********************

  async changeAutoRenewSubscriptionStatus(data: UserAccountChangeBalance): Promise<UserAccountBalance | null> {
    const { userId, subscriptionAutoRenewStatus, subscriptionAutoRenewDays } = data;

    const balance: UserAccountBalance = await this.getUserAccountBalance({ userId });
    if (!balance) {
      return null;
    }
    const balanceBefore = { ...balance };

    balance.subscriptionAutoRenewStatus =
      subscriptionAutoRenewStatus !== undefined
        ? subscriptionAutoRenewStatus
        : balance.subscriptionAutoRenewStatus ?? false;

    if (balance.subscriptionAutoRenewStatus) {
      const products = await this.getUserProducts(userId);
      if (
        subscriptionAutoRenewDays &&
        !Object.values(products).find((product) => product.value === subscriptionAutoRenewDays)
      ) {
        balance.subscriptionAutoRenewDays = balance.subscriptionAutoRenewDays || DEFAULT_PRODUCT.value;

        Logger.error(
          `Invalid subscriptionAutoRenewDays value: ${subscriptionAutoRenewDays} user <${userIdRepresentation(
            userId
          )}>`,
          'SubscriptionService.setUserAccountBalance'
        );
      } else {
        balance.subscriptionAutoRenewDays =
          subscriptionAutoRenewDays || balance.subscriptionAutoRenewDays || DEFAULT_PRODUCT.value;
      }
    }

    if (
      subscriptionAutoRenewStatus !== balanceBefore.subscriptionAutoRenewStatus ||
      subscriptionAutoRenewDays !== balanceBefore.subscriptionAutoRenewDays
    ) {
      await this.mongoAccount.updateAccountBalance(balance);
    }

    return balance;
  }

  async continueUserAccountSubscription(
    userId: string,
    product: ProductInterface,
    useReferral: boolean
  ): Promise<UserAccountBalance | number | string | null> {
    const user = await this.redisUser.getUser({ userId });
    if (!user) {
      return `user ${userId} not found`;
    }

    user.activatedSubscriptions = user.activatedSubscriptions || [];

    if (product.isTrial && user.activatedSubscriptions.indexOf(product.id) >= 0) {
      return `user ${userId} already activated this trial subscription`;
    }

    let balance: UserAccountBalance = await this.getUserAccountBalance({ userId });
    if (!balance) {
      return null;
    }

    let withdrawLeft = product.cost ?? 0;
    if (withdrawLeft > 0 && balance.bonusBalance > 0) {
      const withdrawSum = Math.min(balance.bonusBalance, withdrawLeft);
      withdrawLeft -= withdrawSum;
      balance.bonusBalance -= withdrawSum;
    }

    if (withdrawLeft > 0 && useReferral && balance.referralBalance > 0) {
      const withdrawSum = Math.min(balance.referralBalance, withdrawLeft);
      withdrawLeft -= withdrawSum;
      balance.referralBalance -= withdrawSum;
    }

    if (withdrawLeft > 0 && balance.mainBalance > 0) {
      const withdrawSum = Math.min(balance.mainBalance, withdrawLeft);
      withdrawLeft -= withdrawSum;
      balance.mainBalance -= withdrawSum;
    }

    if (withdrawLeft > 0) {
      return withdrawLeft;
    }

    const timestamp = Date.now();
    if (balance.subscriptionActiveTill && balance.subscriptionActiveTill > timestamp) {
      balance.subscriptionActiveTill = balance.subscriptionActiveTill + product.value * MILLIS_IN_DAY;
    } else {
      balance.subscriptionActiveTill = timestamp + product.value * MILLIS_IN_DAY;
    }

    if (await this.mongoAccount.updateAccountBalance(balance)) {
      balance = await this.getUserAccountBalance({ userId });
    }

    user.subscriptionBought = user.subscriptionBought ?? 0;
    user.subscriptionBought++;
    if (user.activatedSubscriptions.indexOf(product.id) === -1) {
      user.activatedSubscriptions.push(product.id);
    }
    // coupons
    const partners = await this.getReferralPartners(userId);
    if (
      partners?.level1Partner?.activatedSubscriptions &&
      partners.level1Partner.activatedSubscriptions.includes(ISSUED_COUPONS.DISCOUNT_50_PERCENT_REFERRAL)
    ) {
      user.activatedSubscriptions.push(ISSUED_COUPONS.DISCOUNT_50_PERCENT_REFERRAL);
    }

    await this.redisUser.setUser(user);

    return balance;
  }
}
