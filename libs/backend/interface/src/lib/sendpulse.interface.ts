import { USER_NOTIFICATION } from './notification.interface';

export type SendEmailNotificationType = {
  userId?: string;
  email?: string;
  templateId: number;
  variables?: { [key: string]: string };
  otpCodeIdPrefix?: string;
  otpCodeEmailPrefix?: string;
  queryUserParams?: true;

  // USE THESE PARAMETERS WHEN YOU NEED TO SET THE FLAG OF SENDING REPEATING
  notificationType?: USER_NOTIFICATION;
  notificationExpire?: number; // seconds
};

/**
 * Type of SendPulse options
 * @type SendPulseOptionsType
 */
export type SendPulseOptionsType = {
  subject: string;
  to: {
    name?: string;
    email: string;
  }[];
  from: {
    name: string;
    email: string;
  };
  template?: {
    id: number;
    variables?: {
      [key: string]: string;
    };
  };
  html?: string;
  text?: string;
};
