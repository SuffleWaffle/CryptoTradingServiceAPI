import { Injectable } from '@nestjs/common';
import { AccountMongodbService, PlatformMongodbService } from '@cupo/backend/storage';
import { SubscriptionService } from '@cupo/backend/services';
import { PaymentRequestStatus, REFERRAL_REWARD, REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { ReferralReward, UserPayment } from '@cupo/backend/interface';

@Injectable()
export class PaymentService {
  constructor(
    private readonly subService: SubscriptionService,
    private readonly mongoAcc: AccountMongodbService,
    private readonly mongoPlatform: PlatformMongodbService
  ) {}

  async savePaypalEvent(data: any): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    return this.mongoPlatform.savePaypalEvent(data);
  }

  async getPayPalEvents(): Promise<any[]> {
    return this.mongoPlatform.getPayPalEvents();
  }

  async getAllPaymentsList(props?: { status?: PaymentRequestStatus; userId?: string }): Promise<any[]> {
    if (props) {
      if (props.status === undefined) {
        delete props.status;
      }

      if (props.userId === undefined) {
        delete props.userId;
      }
    }

    return await this.mongoAcc.getPaymentsList(props);

    // return await this.mongo.find(
    //   CollectionNames.WalletDeposits,
    //   { ...(props || {}), deleted: { $ne: true } },
    //   {
    //     sort: { timestamp: -1 },
    //     limit: 100,
    //   }
    // );
  }

  async addPaymentRequest(data: UserPayment): Promise<[REST_API_RESPONSE_STATUS, string, string]> {
    try {
      const { userId, sum } = data;

      if (sum <= 0) {
        return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Sum must be greater than 0', null];
      }

      const balance = await this.subService.addUserAccountBalance({ userId, toMainBalance: sum });
      if (!balance) {
        return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found', null];
      }

      const paymentId = await this.mongoAcc.addPayment({ ...data, status: data.status ?? PaymentRequestStatus.Paid });
      if (!paymentId) {
        return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, 'Error while saving payment request', null];
      }

      // fixme: move it after referral spent uploaded money
      const partners: { level1Partner: string; level2Partner: string } = await this.mongoAcc.getReferralPartners(
        userId
      );
      if (partners.level1Partner) {
        const reward: ReferralReward = {
          paymentId,
          referralId: userId,
          partnerId: partners.level1Partner,
          sum: +((sum * REFERRAL_REWARD.LEVEL_1) / 100).toFixed(2),
          level: 1,
        };

        const rewardId = await this.mongoAcc.addReferralReward(reward);
        if (!rewardId) {
          return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, 'Error while saving LEVEL_1 reward', null];
        }

        if (partners.level2Partner) {
          const reward: ReferralReward = {
            paymentId,
            referralId: userId,
            partnerId: partners.level2Partner,
            sum: +((sum * REFERRAL_REWARD.LEVEL_2) / 100).toFixed(2),
            level: 2,
          };

          const rewardId = await this.mongoAcc.addReferralReward(reward);
          if (!rewardId) {
            return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, 'Error while saving LEVEL_2 reward', null];
          }
        }
      }

      return [REST_API_RESPONSE_STATUS.SUCCESS, 'Payment request added', paymentId];
    } catch (e) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, e.message, null];
    }
  }

  async cancelPaymentRequest(params: {
    requestId: string;
    userId: string;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return this.mongoAcc.cancelPaymentRequest(params);
  }

  async deletePaymentRequest(requestId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return this.mongoAcc.deletePaymentRequest(requestId);
  }

  async changePaymentRequestStatus(props: {
    requestId: string;
    userId: string;
    requestStatus: PaymentRequestStatus;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return this.mongoAcc.changePaymentRequestStatus(props);
  }
}
