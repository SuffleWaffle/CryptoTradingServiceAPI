export enum REST_API_RESPONSE_STATUS {
  SUCCESS = 'SUCCESS',
  OTP_CODE_SENT = 'OTP_CODE_SENT',
  OTP_CODE_NOT_SENT = 'OTP_CODE_NOT_SENT',
  OTP_CODE_NOT_FOUND = 'OTP_CODE_NOT_FOUND',
  OTP_CODE_EXPIRED = 'OTP_CODE_EXPIRED',
  OTP_CODE_NOT_VALID = 'OTP_CODE_NOT_VALID',
  PARAMETER_NOT_PROVIDED = 'PARAMETER_NOT_PROVIDED',
  PARAMETER_WRONG_PROVIDED = 'WRONG_PARAMETER_PROVIDED',

  BALANCE_NOT_ENOUGH = 'BALANCE_NOT_ENOUGH',

  EXCHANGE_NOT_SUPPORTED = 'EXCHANGE_NOT_SUPPORTED',

  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_NOT_UPDATED = 'USER_NOT_UPDATED',
  USER_EMAIL_NOT_VERIFIED = 'USER_EMAIL_NOT_VERIFIED',
  USER_NAME_NOT_PROVIDED = 'USER_NAME_NOT_PROVIDED',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_EMAIL_NOT_FOUND = 'USER_EMAIL_NOT_FOUND',
  USER_EMAIL_NOT_PROVIDED = 'USER_EMAIL_NOT_PROVIDED',
  USER_EXCHANGE_NOT_CONFIGURED = 'USER_EXCHANGE_NOT_CONFIGURED',
  USER_EXCHANGE_NOT_ENABLED = 'USER_EXCHANGE_NOT_ENABLED',
  USER_BASE_CURRENCY_NOT_FOUND = 'USER_BASE_CURRENCY_NOT_FOUND',
  USER_WALLET_BALANCE_NOT_FOUND = 'USER_WALLET_BALANCE_NOT_FOUND',
  AUTH_UNAUTHORIZED = 'CREDENTIALS_NOT_VALID',
  AUTH_WRONG_ROLE = 'AUTH_WRONG_ROLE',
  AUTH_ADMIN_NOT_APPROVED = 'AUTH_ADMIN_NOT_APPROVED',

  PASSWORD_NOT_VALID = 'PASSWORD_NOT_VALID',
  PASSWORD_OLD_NOT_VALID = 'OLD_PASSWORD_NOT_VALID',
  PASSWORD_NOT_PROVIDED = 'PASSWORD_NOT_PROVIDED',

  SEND_EMAIL_ERROR = 'SEND_EMAIL_ERROR',

  REQUEST_EXTERNAL_ERROR = 'EXTERNAL_REQUEST_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RESPONSE_EMPTY = 'RESPONSE_EMPTY',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  ENTITY_ALREADY_EXISTS = 'ENTITY_ALREADY_EXISTS',
  RECAPTCHA_VALIDATION_ERROR = 'RECAPTCHA_VALIDATION_ERROR',

  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  CONTINUE_SUBSCRIPTION_ERROR = 'CONTINUE_SUBSCRIPTION_ERROR',
}

export const USER_API_URL = 'https://user.cupocoin.com';

export enum USER_ROLES {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  NEUTRAL = 'neutral',
}

export const ROLE: { [role: string]: USER_ROLES } = {
  CUSTOMER: USER_ROLES.CUSTOMER,
  ADMIN: USER_ROLES.ADMIN,
  NEUTRAL: USER_ROLES.NEUTRAL,
};

export enum PayoutRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
  Paid = 'paid',
}

export enum PaymentRequestStatus {
  Pending = 'pending',
  Paid = 'paid',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}
