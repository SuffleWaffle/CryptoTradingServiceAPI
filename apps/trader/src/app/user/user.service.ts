import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AccountMongodbService, RedisOrderService, RedisUserService } from '@cupo/backend/storage';
import { EmailService, SENDPULSE_TEMPLATES } from '@cupo/mail';
import { SubscriptionService } from '@cupo/backend/services';
import { DEFAULT_PRODUCT, getIPAddress, ProductInterface, userRepresentation } from '@cupo/backend/constant';
import { UserAccountBalance } from '@cupo/backend/interface';
import { ExchangeLibService } from '@cupo/exchange';

@Injectable()
export class UserService {
  private managerId = getIPAddress();

  constructor(
    private readonly exchange: ExchangeLibService,
    private readonly mongo: AccountMongodbService,
    private readonly emailService: EmailService,
    private readonly subService: SubscriptionService,
    private readonly redisUser: RedisUserService,
    private readonly redisOrder: RedisOrderService
  ) {}

  @Cron('* */5 * * * *')
  private async updateTradingStatus(): Promise<void> {
    if (!(await this.redisOrder.isMainOrderManager(this.managerId))) {
      return;
    }

    const users = await this.redisUser.getUsers(true);
    for (const user of users) {
      const balance = await this.mongo.getAccountBalance(user.id);

      if (balance?.subscriptionDaysLeft <= 0) {
        await this.redisUser.setUser({ ...user, active: false });

        await this.emailService.sendEmail({
          userId: user.id,
          templateId: SENDPULSE_TEMPLATES.ROBOT_STOPPED,
        });
      }
    }
  }

  @Cron('20 */1 * * * *')
  private async continueUserAccountSubscription(): Promise<void> {
    if (!(await this.redisOrder.isMainOrderManager(this.managerId))) {
      return;
    }

    const users = await this.redisUser.getUsers();
    for (const user of users) {
      const balance = await this.subService.getUserAccountBalance({ user });
      if (
        !(
          (
            balance &&
            balance.subscriptionAutoRenewStatus &&
            balance.subscriptionAutoRenewDays &&
            balance.subscriptionDaysLeft >= 0 &&
            balance.subscriptionDaysLeft <= 0.020833333333333
          ) // 30 minutes in Days = 30 / 1440
        )
      ) {
        continue;
      }

      const userProducts = await this.subService.getUserProducts(user.id);
      let product: ProductInterface = Object.values(userProducts).find(
        (product) => product.value === balance.subscriptionAutoRenewDays
      );
      if (!product) {
        product = DEFAULT_PRODUCT;

        Logger.warn(
          `*** Error updating user subscription ${userRepresentation(user)}: subscription not found`,
          'continueUserAccountSubscription'
        );
        // Logger.error(`*** Error updating user subscription ${user.id}: subscription not found`);
        // continue;

        await this.subService.changeAutoRenewSubscriptionStatus({
          userId: user.id,
          subscriptionAutoRenewStatus: true,
          subscriptionAutoRenewDays: product.value,
        });
      }

      if (product.cost > balance.mainBalance + balance.bonusBalance) {
        continue;
      }

      const res: UserAccountBalance | number | string | null = await this.subService.continueUserAccountSubscription(
        user.id,
        product,
        false
      );
      if (!balance) {
        Logger.warn(`*** Error updating user subscription ${user.id}: balance not found`);
        continue;
      }
      if (typeof res === 'number') {
        Logger.warn(`*** Insufficient funds to continue subscription ${user.id}: ${res}`);
        continue;
      }
      if (typeof res === 'string') {
        Logger.warn(`*** Error updating user subscription ${user.id}: ${balance}`);
        continue;
      }

      Logger.warn(`*** Updated user subscription ${user.id}: ${res.subscriptionAutoRenewDays} days`);

      await this.emailService.sendEmail({
        userId: user.id,
        templateId: SENDPULSE_TEMPLATES.SUBSCRIPTION_RENEWED,
        variables: {
          renewedDays: res.subscriptionAutoRenewDays.toString(),
          withdrawnAmount: product.cost.toString(),
        },
      });
    }
  }
}
