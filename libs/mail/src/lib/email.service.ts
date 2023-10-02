import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Job } from 'bull';
import { RedisNotificationService, RedisUserService } from '@cupo/backend/storage';
import { generateOTP, REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { SendEmailNotificationType, SendPulseOptionsType } from '@cupo/backend/interface';
import { SENDPULSE_TEMPLATES } from './constant/sendpulse.constant';
import { SendPulseProvider } from './providers/sendPulse.provider';
import { QueueService } from '@cupo/backend/queue';

@Injectable()
export class EmailService implements OnApplicationBootstrap {
  private readonly isEmailSendingEnabled: boolean;

  private readonly emailVerificationTemplate: string;
  private readonly changePasswordVerificationTemplate: string;
  private readonly deleteAccountTemplate: string;

  constructor(
    private readonly queueService: QueueService,
    private readonly emailProvider: SendPulseProvider,
    private readonly redisUser: RedisUserService,
    private readonly redisNotify: RedisNotificationService
  ) {
    this.isEmailSendingEnabled = this.emailProvider.isEnabled();

    if (!this.isEmailSendingEnabled) this.send = async () => null;

    // this.emailVerificationTemplate = fs.readFileSync(
    //   join(__dirname, 'assets/templates/email-verification.hbs'),
    //   'utf8'
    // );
    // this.deleteAccountTemplate = fs.readFileSync(join(__dirname, 'assets/templates/email-verification.hbs'), 'utf8');
    // this.changePasswordVerificationTemplate = fs.readFileSync(
    //   join(__dirname, 'assets/templates/password-verification.hbs'),
    //   'utf8'
    // );
  }

  async onApplicationBootstrap() {
    if (this.isEmailSendingEnabled) {
      await this.emailProvider.init();
    }
  }

  async sendEmailNotification(props: SendEmailNotificationType): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const {
      userId,
      email,
      templateId,
      variables,
      otpCodeIdPrefix,
      otpCodeEmailPrefix,
      queryUserParams,
      notificationType,
      notificationExpire,
    } = props;

    if (!templateId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `User <templateId> not provided`];
    }
    if (!userId && !email) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Parameters <userId> or <email> not provided`];
    }

    const vars = variables || {};

    let user;
    if (userId) {
      user = await this.redisUser.getUser({ userId });
      if (!user?.email) {
        return [REST_API_RESPONSE_STATUS.USER_EMAIL_NOT_FOUND, `User email not provided`];
      }
    } else {
      user = await this.redisUser.getUser({ email });
    }
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${userId ?? email}> not found`];
    }

    if (otpCodeIdPrefix !== undefined) {
      const code = generateOTP();
      await this.redisUser.addOtpCode(`${otpCodeIdPrefix?.length ? otpCodeIdPrefix : ''}${user.id}`, code);
      vars.code = code;
    } else if (otpCodeEmailPrefix !== undefined) {
      const code = generateOTP();
      await this.redisUser.addOtpCode(`${otpCodeEmailPrefix?.length ? otpCodeEmailPrefix : ''}${user.email}`, code);
      vars.code = code;
    }

    if (queryUserParams) {
      vars.queryParams = `?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email)}${
        vars.code ? '&code=' + vars.code : ''
      }`;
    }

    try {
      const result = await this.sendPulseEmail(user.email, templateId, vars);

      if (result && notificationType) {
        await this.redisNotify.setLastUserNotification(user.id, notificationType, notificationExpire);
      }

      return [REST_API_RESPONSE_STATUS.SUCCESS, `Email sent to <${user.email}>: ${JSON.stringify(result || {})}`];
    } catch (err) {
      return [REST_API_RESPONSE_STATUS.SEND_EMAIL_ERROR, err.message];
    }
  }

  async sendPulseEmail(email: string, templateId: number, variables?: { [key: string]: string }): Promise<any> {
    const fromName = process.env.MAIL_FROM_NAME;
    const fromEmail = process.env.MAIL_FROM_EMAIL;
    // const fromName = this.configService.get('MAIL_FROM_NAME');
    // const fromEmail = this.configService.get('MAIL_FROM_EMAIL');

    return await this.send({
      subject: undefined,
      from: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email }],
      template: {
        id: templateId,
        variables,
      },
    });
  }

  async sendDeleteAccountVerification(email: string, code: string): Promise<any> {
    const fromName = process.env.MAIL_FROM_NAME;
    const fromEmail = process.env.MAIL_FROM_EMAIL;

    return await this.send({
      subject: 'CUPO delete user account - verification code',
      from: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email }],
      html: this.deleteAccountTemplate.replace('{{code}}', code),
    });
  }

  async sendDeleteAccountVerificationTemplate(email: string, code: string): Promise<any> {
    const fromName = process.env.MAIL_FROM_NAME;
    const fromEmail = process.env.MAIL_FROM_EMAIL;

    const template = await this.emailProvider.getTemplate(SENDPULSE_TEMPLATES.DELETE_ACCOUNT_VERIFICATION);
    if (!template) throw new Error('Delete account template not found');

    return await this.send({
      subject: template.name,
      from: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email }],
      template: {
        id: template.id,
        variables: {
          code,
        },
      },
    });
  }

  async sendEmailVerification(email: string, code: string): Promise<any> {
    const fromName = process.env.MAIL_FROM_NAME;
    const fromEmail = process.env.MAIL_FROM_EMAIL;

    return await this.send({
      subject: 'CUPO email verification code',
      from: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email }],
      html: this.emailVerificationTemplate.replace('{{code}}', code),
    });
  }

  // fixme: deprecated method
  async sendEmailVerificationTemplate(email: string, code: string): Promise<any> {
    const fromName = process.env.MAIL_FROM_NAME;
    const fromEmail = process.env.MAIL_FROM_EMAIL;

    const template = await this.emailProvider.getTemplate(SENDPULSE_TEMPLATES.EMAIL_VERIFICATION);
    if (!template) throw new Error('Email verification template not found');

    return await this.send({
      subject: template.name,
      from: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email }],
      template: {
        id: template.id,
        variables: {
          code,
        },
      },
    });
  }

  async sendPasswordVerification(email: string, code: string): Promise<any> {
    const fromName = process.env.MAIL_FROM_NAME;
    const fromEmail = process.env.MAIL_FROM_EMAIL;

    return await this.send({
      subject: 'CUPO reset password - verification code',
      from: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email }],
      html: this.changePasswordVerificationTemplate.replace('{{code}}', code),
    });
  }

  async sendPasswordVerificationTemplate(email: string, code: string): Promise<any> {
    const fromName = process.env.MAIL_FROM_NAME;
    const fromEmail = process.env.MAIL_FROM_EMAIL;

    const template = await this.emailProvider.getTemplate(SENDPULSE_TEMPLATES.PASSWORD_VERIFICATION);
    if (!template) throw new Error('Password verification template not found');

    return await this.send({
      subject: template.name,
      from: {
        name: fromName,
        email: fromEmail,
      },
      to: [{ email }],
      template: {
        id: template.id,
        variables: {
          code,
        },
      },
    });
  }

  async send(email: SendPulseOptionsType): Promise<any> {
    return await this.emailProvider.send(email);
  }

  async sendEmail(email: SendEmailNotificationType): Promise<Job<SendEmailNotificationType>> {
    return this.queueService.sendEmail(email);
  }

  async sendBulkEmails(emails: Array<SendEmailNotificationType>): Promise<Array<Job<SendEmailNotificationType>>> {
    return this.queueService.sendBulkEmails(emails);
  }
}
