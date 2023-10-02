import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InsertOneResult, ObjectId, Sort, UpdateResult } from 'mongodb';
import {
  DEFAULT_PRODUCT,
  MILLIS_IN_DAY,
  PaymentRequestStatus,
  PAYOUT_PROFILE_STATUS,
  PayoutRequestStatus,
  REST_API_RESPONSE_STATUS,
} from '@cupo/backend/constant';
import {
  IGetAccountBalances,
  PayoutProfile,
  ReferralReward,
  UserAccountBalance,
  UserAccountTransferBalance,
  UserPayment,
  UserReferral,
} from '@cupo/backend/interface';
import { CollectionNames } from './collections';
import { MongodbService } from './mongodb.service';

@Injectable()
export class AccountMongodbService extends MongodbService implements OnModuleDestroy {
  // ***********************
  // *** ACCOUNT BALANCE ***
  // ***********************
  async getAllAccountBalances(
    params: IGetAccountBalances
  ): Promise<{ balances: UserAccountBalance[]; totalItems: number }> {
    const { userId, userIds } = params;

    const query = {};

    if (userIds?.length) {
      query['userId'] = { $in: userIds };
    } else if (userId) {
      query['userId'] = userId;
    }

    let balances = [];
    const totalItems = await this.count(CollectionNames.AccountBalance, query);

    if (totalItems > 0) {
      const page = Math.max(params.page || 1, 1);
      const limit = Math.min(Math.max(params.itemsPerPage || 25, 1), 100);
      const sortField: string = params.sort;
      const sortDirection: number = params.sortOrder || -1;
      const sort = sortField
        ? ({ [sortField]: sortDirection } as Sort)
        : ({
            updated: sortDirection,
          } as Sort);

      balances = await this.find<UserAccountBalance>(CollectionNames.AccountBalance, query, {
        sort,
        skip: (page - 1) * limit,
        limit,
      });
    }

    // .filter(
    //   (order) =>
    //     order &&
    //     (status === undefined || order.status === status) &&
    //     (active === undefined ||
    //       (active === true &&
    //         (order.status?.toUpperCase() === ORDER_STATUS.OPENED ||
    //           order.status?.toUpperCase() === ORDER_STATUS.WAIT_OPEN)) ||
    //       (active === false &&
    //         order.status?.toUpperCase() !== ORDER_STATUS.OPENED &&
    //         order.status?.toUpperCase() !== ORDER_STATUS.WAIT_OPEN)) &&
    //     (symbol === undefined || order.symbol === symbol) &&
    //     (active === undefined ||
    //       (active === true && order.status === ORDER_STATUS.OPENED) ||
    //       (active === false && order.status === ORDER_STATUS.WAIT_OPEN)) &&
    //     (virtual === undefined ||
    //       (virtual === false && order.isVirtual === false) ||
    //       (virtual === true && (order.isVirtual === true || order.isVirtual === undefined)))
    // );

    return { balances, totalItems };
  }

  async getAccountBalance(userId: string): Promise<UserAccountBalance | null> {
    const balance: UserAccountBalance | null = await this.findOne<UserAccountBalance>(CollectionNames.AccountBalance, {
      userId,
    });

    const timestamp = Date.now();

    if (!balance) {
      return {
        userId,
        mainBalance: 0,
        bonusBalance: 0,
        referralBalance: 0,

        subscriptionActiveTill: timestamp,
        subscriptionActiveTillHuman: new Date(timestamp),
        subscriptionDaysLeft: 0,

        subscriptionAutoRenewDays: DEFAULT_PRODUCT.value,
        subscriptionAutoRenewStatus: false,
      };
    }

    balance.mainBalance = balance.mainBalance || 0;
    balance.bonusBalance = balance.bonusBalance || 0;
    balance.referralBalance = balance.referralBalance || 0;

    balance.subscriptionAutoRenewStatus =
      balance.subscriptionAutoRenewStatus !== undefined ? balance.subscriptionAutoRenewStatus : false;
    balance.subscriptionAutoRenewDays = balance.subscriptionAutoRenewDays || DEFAULT_PRODUCT.value;

    balance.subscriptionActiveTill = balance.subscriptionActiveTill || timestamp;
    balance.subscriptionActiveTillHuman = new Date(balance.subscriptionActiveTill);
    balance.subscriptionDaysLeft = balance.subscriptionActiveTill
      ? Math.max((balance.subscriptionActiveTill - timestamp) / MILLIS_IN_DAY, 0)
      : 0;

    return balance;
  }

  async updateAccountBalance(balance: UserAccountBalance): Promise<boolean> {
    const { userId, subscriptionDaysLeft, subscriptionActiveTillHuman, ...rest } = balance;
    const result: UpdateResult = await this.upsertOne<UserAccountBalance>(
      CollectionNames.AccountBalance,
      { userId },
      {
        ...(rest || {}),
        updated: Date.now(),
      }
    );

    return result.acknowledged && (result.modifiedCount > 0 || result.upsertedCount > 0);
  }

  async addAccountBalanceTransaction(transfer: UserAccountTransferBalance): Promise<string> {
    const result: InsertOneResult = await this.insertOne<UserAccountTransferBalance>(
      CollectionNames.AccountBalanceTransactions,
      { ...transfer, created: new Date() }
    );

    return result?.insertedId.toString();
  }

  //*****************
  //*** REFERRALS ***
  //*****************
  async getReferrals(userId: string): Promise<{ level1Referrals: string[]; level2Referrals: string[] }> {
    const res = { level1Referrals: [], level2Referrals: [] };

    const referrals = await this.find<UserReferral>(CollectionNames.Referrals, {
      partnerId: userId,
      deleted: { $ne: true },
    });

    for (const referral of referrals) {
      if (referral.userId && res.level1Referrals.indexOf(referral.userId) < 0) {
        res.level1Referrals.push(referral.userId);

        const level2Referrals = await this.find<UserReferral>(CollectionNames.Referrals, {
          partnerId: referral.userId,
          deleted: { $ne: true },
        });
        level2Referrals.forEach((referral2) => {
          if (referral2.userId && res.level2Referrals.indexOf(referral2.userId) < 0) {
            res.level2Referrals.push(referral2.userId);
          }
        });
      }
    }

    return res;
  }

  async getReferralPartners(userId: string): Promise<{ level1Partner: string; level2Partner: string }> {
    const res = { level1Partner: undefined, level2Partner: undefined };

    const partnerLevel1 = await this.findOne<UserReferral>(CollectionNames.Referrals, {
      userId,
      deleted: { $ne: true },
    });

    if (partnerLevel1) {
      res.level1Partner = partnerLevel1.partnerId;

      const partnerLevel2 = await this.findOne<UserReferral>(CollectionNames.Referrals, {
        userId: partnerLevel1.partnerId,
        deleted: { $ne: true },
      });
      if (partnerLevel2) {
        res.level2Partner = partnerLevel2.partnerId;
      }
    }

    return res;
  }

  async addReferral(data: UserReferral): Promise<string | null> {
    const stamp = new Date();
    const res = await this.insertOne<UserReferral>(CollectionNames.Referrals, { ...data, created: stamp });

    if (res.acknowledged && res.insertedId) {
      return res.insertedId.toString();
    }

    return null;
  }

  async addReferralReward(data: ReferralReward): Promise<string | null> {
    const balance = await this.getAccountBalance(data.partnerId);
    if (!balance) {
      Logger.error(`Referral reward: balance not found for user ${data.partnerId}`);
      return null;
    }

    const balanceUpdated = await this.updateAccountBalance({
      ...balance,
      referralBalance: (balance.referralBalance || 0) + data.sum,
    });
    if (!balanceUpdated) {
      Logger.error(
        `Balance not updated for partner ${data.partnerId} from referral ${data.referralId}`,
        'addReferralReward'
      );
    }

    const res = await this.insertOne<ReferralReward>(CollectionNames.ReferralReward, {
      ...data,
      created: new Date(),
    });

    if (res.acknowledged && res.insertedId) {
      return res.insertedId.toString();
    }
    return null;
  }

  async getReferralRewards(partnerId: string): Promise<ReferralReward[]> {
    return this.find<ReferralReward>(CollectionNames.ReferralReward, { partnerId, deleted: { $ne: true } });
  }

  //****************
  //*** PAYMENTS ***
  //****************
  async addPayment(data: UserPayment): Promise<string | null> {
    const stamp = new Date();
    const res = await this.insertOne<UserPayment>(CollectionNames.WalletDeposits, {
      ...data,
      created: stamp,

      // fixme: add the check to the payment gateway
      // status: PaymentRequestStatus.Pending,
      status: data.status ?? PaymentRequestStatus.Paid,
    });

    if (res.acknowledged && res.insertedId) {
      return res.insertedId.toString();
    }

    return null;
  }

  async cancelPaymentRequest(props: {
    requestId: string;
    userId: string;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const { requestId, userId, comment } = props;

    try {
      await this.updateOne(
        CollectionNames.WalletDeposits,
        { _id: new ObjectId(requestId), userId },
        {
          status: PaymentRequestStatus.Cancelled,
          ...(comment ? { comment } : {}),

          update: new Date(),
        }
      );

      return [REST_API_RESPONSE_STATUS.SUCCESS, `Request [${requestId}] cancelled`];
    } catch (e) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, e.message];
    }
  }

  async deletePaymentRequest(requestId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    try {
      await this.updateOne(
        CollectionNames.WalletDeposits,
        { _id: new ObjectId(requestId) },
        {
          deleted: true,
          update: new Date(),
        }
      );

      return [REST_API_RESPONSE_STATUS.SUCCESS, `Request [${requestId}] deleted`];
    } catch (e) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, e.message];
    }
  }

  async changePaymentRequestStatus(props: {
    requestId: string;
    userId: string;
    requestStatus: PaymentRequestStatus;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const { requestId, userId, requestStatus, comment } = props;

    try {
      await this.updateOne(
        CollectionNames.WalletDeposits,
        { _id: new ObjectId(requestId), userId },
        {
          status: requestStatus,
          ...(comment ? { comment } : {}),

          update: new Date(),
        }
      );

      return [REST_API_RESPONSE_STATUS.SUCCESS, `Request [${requestId}] status changed to ${requestStatus}`];
    } catch (err) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, err.message];
    }
  }

  async getPaymentsList(props?: {
    status?: PaymentRequestStatus;
    userId?: string;
    paymentId?: string;
    _id?: ObjectId;
  }): Promise<any[] | null> {
    try {
      if (props) {
        if (props._id === undefined) {
          delete props._id;
        }

        if (props.status === undefined) {
          delete props.status;
        }

        if (props.userId === undefined) {
          delete props.userId;
        }

        if (props.paymentId === undefined) {
          delete props.paymentId;
        }

        if (props.paymentId) {
          props._id = new ObjectId(props.paymentId);
          delete props.paymentId;
        }
      }

      return await this.find(
        CollectionNames.WalletDeposits,
        { ...(props || {}), deleted: { $ne: true } },
        {
          sort: { timestamp: -1 },
          limit: 100,
        }
      );
    } catch (e) {
      Logger.error(e.message);
      return null;
    }
  }

  //***********************
  //*** PAYOUT PROFILE ***
  //***********************
  async getPayoutProfile(filter: { profileId: string; userId: string }): Promise<PayoutProfile | null> {
    return this.findOne<PayoutProfile>(CollectionNames.WithdrawalsProfile, {
      _id: new ObjectId(filter.profileId),
      userId: filter.userId,
    });
  }

  async getAllPayoutProfiles(userId: string): Promise<PayoutProfile[] | string> {
    try {
      return this.find<PayoutProfile>(
        CollectionNames.WithdrawalsProfile,
        { userId, status: { $ne: PAYOUT_PROFILE_STATUS.DELETED } },
        {
          limit: 100,
        }
      );
    } catch (err) {
      return err.message;
    }
  }

  async addPayoutProfile(profile: PayoutProfile): Promise<InsertOneResult<PayoutProfile>> {
    return this.insertOne(CollectionNames.WithdrawalsProfile, profile);
  }

  async changePayoutProfile(props: {
    userId: string;
    profileId: string;
    description?: string;
    firstName?: string;
    lastName?: string;
    paypalEmail?: string;
    phone?: string;
    status: PAYOUT_PROFILE_STATUS;
    comment?: string;
  }): Promise<undefined | string> {
    try {
      const { userId, profileId, description, firstName, lastName, paypalEmail, phone, status, comment } = props;

      await this.updateOne(
        CollectionNames.WithdrawalsProfile,
        { _id: new ObjectId(profileId), userId },
        {
          status: PAYOUT_PROFILE_STATUS.PENDING,
          ...(description ? { description } : {}),
          ...(comment ? { comment } : {}),
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(paypalEmail ? { paypalEmail } : {}),
          ...(phone ? { phone } : {}),
          ...(status ? { status } : { status: PAYOUT_PROFILE_STATUS.PENDING }),

          update: new Date(),
        }
      );

      return undefined;
    } catch (err) {
      Logger.error(err.message, err.stack);

      return err.message;
    }
  }

  async getPayoutRequests(filter: any): Promise<any[]> {
    return await this.find(
      CollectionNames.WalletWithdrawals,
      { ...(filter || {}), deleted: { $ne: true } },
      {
        sort: { timestamp: -1 },
        limit: 100,
      }
    );
  }

  async addPayoutRequest(data: { userId: string; sum: number; comment?: string }): Promise<object | string> {
    try {
      return this.insertOne(CollectionNames.WalletWithdrawals, {
        ...data,
        time: new Date(),
        status: PayoutRequestStatus.Pending,
      });
    } catch (e) {
      return e.message;
    }
  }

  async cancelPayoutRequest(props: {
    requestId: string;
    userId: string;
    comment?: string;
  }): Promise<string | undefined> {
    const { requestId, userId, comment } = props;

    try {
      await this.updateOne(
        CollectionNames.WalletWithdrawals,
        { _id: new ObjectId(requestId), userId },
        {
          $set: {
            status: PayoutRequestStatus.Cancelled,
            ...(comment ? { comment } : {}),

            update: new Date(),
          },
        }
      );

      return undefined;
    } catch (e) {
      return e.message;
    }
  }

  async changePayoutRequestStatus(props: {
    requestId: string;
    userId: string;
    requestStatus: PayoutRequestStatus;
    comment?: string;
  }): Promise<string | undefined> {
    const { requestId, userId, comment, requestStatus } = props;

    try {
      await this.updateOne(
        CollectionNames.WalletWithdrawals,
        { _id: new ObjectId(requestId), userId },
        {
          $set: {
            status: requestStatus,
            ...(comment ? { comment } : {}),

            update: new Date(),
          },
        }
      );

      return undefined;
    } catch (e) {
      return e.message;
    }
  }

  async deletePayoutRequest(requestId: string): Promise<string | undefined> {
    try {
      await this.updateOne(
        CollectionNames.WalletWithdrawals,
        { _id: new ObjectId(requestId) },
        {
          $set: {
            deleted: true,
            update: new Date(),
          },
        }
      );

      return undefined;
    } catch (e) {
      return e.message;
    }
  }
}
