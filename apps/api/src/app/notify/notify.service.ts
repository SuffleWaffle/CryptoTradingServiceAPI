import { Injectable } from '@nestjs/common';
import { EmailService, OTP_PREFIX, SENDPULSE_TEMPLATES } from '@cupo/mail';
import { AccountMongodbService, RedisNotificationService, RedisUserService } from '@cupo/backend/storage';
import { Cron } from '@nestjs/schedule';
import { MILLIS_IN_DAY, ProductInterface, REST_API_RESPONSE_STATUS, SEC_IN_DAY } from '@cupo/backend/constant';
import { SendEmailNotificationType, USER_NOTIFICATION } from '@cupo/backend/interface';
import { SubscriptionService } from '@cupo/backend/services';

@Injectable()
export class NotifyService {
  constructor(
    private readonly redisUser: RedisUserService,
    private readonly subService: SubscriptionService,
    private readonly mongo: AccountMongodbService,
    private readonly emailService: EmailService,
    private readonly redisNotification: RedisNotificationService
  ) {}

  async sendEmailVerification(email: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return await this.emailService.sendEmailNotification({
      email,
      templateId: SENDPULSE_TEMPLATES.EMAIL_VERIFICATION,
      otpCodeEmailPrefix: OTP_PREFIX.EMAIL_VERIFICATION,
      queryUserParams: true,
    });
  }

  async sendPasswordVerification(email: string): Promise<[string, string]> {
    return await this.emailService.sendEmailNotification({
      email,
      templateId: SENDPULSE_TEMPLATES.PASSWORD_VERIFICATION,
      otpCodeEmailPrefix: OTP_PREFIX.PASSWORD_VERIFICATION,
    });
  }

  async sendDeleteAccountVerification(userId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return await this.emailService.sendEmailNotification({
      userId,
      templateId: SENDPULSE_TEMPLATES.DELETE_ACCOUNT_VERIFICATION,
      otpCodeIdPrefix: OTP_PREFIX.DELETE_ACCOUNT_VERIFICATION,
    });
  }

  async subscriptionBillingCompleted(userId: string, billingDays: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return await this.emailService.sendEmailNotification({
      userId,
      templateId: SENDPULSE_TEMPLATES.BILLING_OK,
      variables: {
        billingDays,
        billingTime: new Date().toString(),
      },
    });
  }

  async replenishmentMainBalance(userId: string, billingSumm: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return await this.emailService.sendEmailNotification({
      userId,
      templateId: SENDPULSE_TEMPLATES.REPLENISHMENT_MAIN_BALANCE_OK,
      variables: {
        billingSumm,
        billingTime: new Date().toString(),
      },
    });
  }

  async withdrawalMainBalance(userId: string, billingSumm: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    return await this.emailService.sendEmailNotification({
      userId,
      templateId: SENDPULSE_TEMPLATES.WITHDRAWAL_MAIN_BALANCE_OK,
      variables: {
        billingSumm,
        billingTime: new Date().toString(),
      },
    });
  }

  async subscriptionEnded(userId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const [error, message] = await this.emailService.sendEmailNotification({
      userId,
      templateId: SENDPULSE_TEMPLATES.SUBSCRIPTION_ENDED,
    });

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      await this.redisNotification.setLastUserNotification(userId, USER_NOTIFICATION.SUBSCRIPTION_ENDED);
    }

    return [error, message];
  }

  async subscriptionEnding(userId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const [error, message] = await this.emailService.sendEmailNotification({
      userId,
      templateId: SENDPULSE_TEMPLATES.SUBSCRIPTION_ENDING,
    });

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      await this.redisNotification.setLastUserNotification(
        userId,
        USER_NOTIFICATION.SUBSCRIPTION_ENDING,
        SEC_IN_DAY - 300
      );
    }

    return [error, message];
  }

  @Cron('10 */1 * * * *')
  async checkUserSubscriptionEnding() {
    const users = await this.redisUser.getUsers();

    const jobs: Array<SendEmailNotificationType> = [];
    for (const user of users) {
      const balance = await this.mongo.getAccountBalance(user.id);
      if (
        balance?.subscriptionActiveTill === undefined ||
        balance.subscriptionDaysLeft > 3 ||
        balance.subscriptionDaysLeft <= 0
      ) {
        continue;
      }

      const userProducts = await this.subService.getUserProducts(user.id);
      const product: ProductInterface = Object.values(userProducts).find(
        (product) => product.value === balance.subscriptionAutoRenewDays
      );
      if (product && product.cost < balance.mainBalance + balance.bonusBalance) {
        continue;
      }

      const notify = await this.redisNotification.getLastUserNotification(
        user.id,
        USER_NOTIFICATION.SUBSCRIPTION_ENDING
      );
      if (notify && notify > Date.now() - MILLIS_IN_DAY) {
        continue;
      }

      jobs.push({
        userId: user.id,
        templateId: SENDPULSE_TEMPLATES.SUBSCRIPTION_ENDING,
        variables: { daysLeft: Math.round(balance.subscriptionDaysLeft).toString() },
        notificationType: USER_NOTIFICATION.SUBSCRIPTION_ENDING,
        notificationExpire: SEC_IN_DAY,
      });
    }

    if (jobs.length) {
      await this.emailService.sendBulkEmails(jobs);
    }
  }

  @Cron('0 */1 * * * *')
  async checkUserSubscriptionEnded() {
    const users = await this.redisUser.getUsers();

    const jobs: Array<SendEmailNotificationType> = [];
    for (const user of users) {
      const balance = await this.mongo.getAccountBalance(user.id);
      if (
        !user?.subscriptionBought ||
        balance?.subscriptionActiveTill === undefined ||
        balance.subscriptionDaysLeft > 0
      ) {
        continue;
      }

      const notify = await this.redisNotification.getLastUserNotification(
        user.id,
        USER_NOTIFICATION.SUBSCRIPTION_ENDED
      );
      if (notify && notify > Date.now() - MILLIS_IN_DAY * 7) {
        continue;
      }

      jobs.push({
        userId: user.id,
        templateId: SENDPULSE_TEMPLATES.SUBSCRIPTION_ENDED,
        notificationType: USER_NOTIFICATION.SUBSCRIPTION_ENDED,
        notificationExpire: SEC_IN_DAY * 7,
      });
    }

    if (jobs.length) {
      await this.emailService.sendBulkEmails(jobs);
    }
  }
}
