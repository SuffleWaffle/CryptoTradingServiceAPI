import { Injectable, Logger } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { User } from "@cupo/backend/interface";

// https://notiz.dev/blog/send-emails-with-nestjs

/**
 * SendPulse transport provider
 * @class SendPulseProvider
 */
@Injectable()
export class SmtpProvider {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation(email: string, payload: { user: User; token: string }) {
    const url = `/auth/confirm?token=${payload.token}`;

    await this.mailerService.sendMail({
      to: email,
      // from: '"Support Team" <support@example.com>', // override default from
      subject: 'Welcome to Nice App! Confirm your Email',
      template: './confirmation', // `.hbs` extension is appended automatically
      context: {
        // ✏️ filling curly brackets with content
        name: payload.user.name,
        url,
      },
    });
  }

  async send(email: string, payload?: any): Promise<void> {
    try {
      await this.sendUserConfirmation(email, payload);
    } catch (error) {
      Logger.error(`Error occurred send email: ${error.message}`);
    }
  }

  /**
   * Check if SendPulse enabled and all configs are defined
   */
  isEnabled(): boolean {
    return process.env.SMTP_ENABLED === 'true';
  }
}
