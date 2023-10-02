import { getEmailTemplate, init, smtpSendMail } from 'sendpulse-api';
import { Injectable, Logger } from '@nestjs/common';
import { SendPulseOptionsType } from '@cupo/backend/interface';

@Injectable()
export class SendPulseProvider {
  async init() {
    const sendPulseApiId = process.env.SENDPULSE_API_ID;
    const sendPulseApiSecret = process.env.SENDPULSE_API_SECRET;
    const sendPulseApiTokenStorage = process.env.SENDPULSE_API_TOKEN_STORAGE;

    Logger.log(`SendPulse authorization ${sendPulseApiId}...`);

    return new Promise((resolve, reject) => {
      init(sendPulseApiId, sendPulseApiSecret, sendPulseApiTokenStorage, (token) => {
        if (!token || token.is_error) {
          if (token?.message === 'Invalid credentials') {
            Logger.error('SendPulse critical error: Invalid credentials');
          }

          reject(token);
        } else {
          Logger.log('SendPulse authorization succeeded.');

          resolve(token);
        }
      });
    });
  }

  async getTemplate(id: number): Promise<any> {
    return new Promise((resolve, reject) => {
      getEmailTemplate((template) => {
        if (!template || template.is_error) {
          if (template?.message === 'Invalid credentials') {
            Logger.error(`SendPulse critical error: Invalid credentials`);
          } else {
            Logger.error(`SendPulse critical error: ${template?.message || 'Unknown error'}`);
          }

          reject(null);
        } else {
          Logger.debug(`SendPulse use template ${id}`);

          resolve(template);
        }
      }, id);
    });
  }

  prepareSendPulseTemplate(email: SendPulseOptionsType, template): void {
    if (template && !email.subject) {
      let subject = template.name;

      if (email.template.variables && subject.includes('{{')) {
        Object.keys(email.template.variables).forEach((key) => {
          subject = subject.replace(`{{${key}}}`, email.template.variables[key]);
        });
      }

      email.subject = subject;
    }
  }

  async send(email: SendPulseOptionsType): Promise<any> {
    try {
      if (email?.template?.id) {
        const template = await this.getTemplate(email.template.id);
        if (!template) throw new Error(`SendPulse template [${email?.template?.id}] not found`);

        this.prepareSendPulseTemplate(email, template);
      }

      return await this.sendEmail(email);
    } catch (error) {
      if (error.message === 'Invalid credentials') {
        Logger.error(`Error occurred ${JSON.stringify(error || {})}. Reinitializing...`);

        await this.init();

        if (email?.template?.id) {
          const template = await this.getTemplate(email.template.id);
          if (!template) return new Error(`SendPulse template [${email?.template?.id}] not found`);

          this.prepareSendPulseTemplate(email, template);
        }

        return await this.sendEmail(email);
      }

      Logger.error(`SendPulse email sending error ${JSON.stringify(error || {})}`);
    }
  }

  /**
   * Check if SendPulse enabled and all configs are defined
   */
  isEnabled(): boolean {
    return (
      process.env.SENDPULSE_ENABLED === 'true' &&
      !!process.env.SENDPULSE_API_ID &&
      !!process.env.SENDPULSE_API_SECRET &&
      !!process.env.SENDPULSE_API_TOKEN_STORAGE
    );
  }

  /**
   * Send email
   * @member sendEmail
   * @param email SendPulseOptionsType
   */
  private async sendEmail(email: SendPulseOptionsType): Promise<any> {
    return new Promise((resolve, reject) => {
      Logger.log('SendPulse sending email...');

      return smtpSendMail(
        (result) => {
          if (result?.result) {
            Logger.log(`SendPulse Email sent: ${JSON.stringify(result || {})}`);

            return resolve(result);
          }

          Logger.error(`SendPulse email sending failed: ${JSON.stringify(result || {})}`);

          return reject(result);
        },
        { ...email }
      );
    });
  }
}
