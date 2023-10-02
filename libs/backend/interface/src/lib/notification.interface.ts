export interface UserNotification {
  userId: string;
  type: string;
  timestamp: number;
}

export enum USER_NOTIFICATION {
  BILLING_OK = 'BILLING_OK',
  REPLENISHMENT_MAIN_BALANCE_OK = 'REPLENISHMENT_MAIN_BALANCE_OK',
  WITHDRAWAL_MAIN_BALANCE_OK = 'WITHDRAWAL_MAIN_BALANCE_OK',
  SUBSCRIPTION_ENDED = 'SUBS-ENDED',
  SUBSCRIPTION_ENDING = 'SUBS-ENDING',
  ROBOT_STOPPED = 'ROBOT_STOPPED',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_VERIFICATION = 'PASSWORD_VERIFICATION',
  DELETE_ACCOUNT_VERIFICATION = 'DELETE_ACCOUNT_VERIFICATION',
}
