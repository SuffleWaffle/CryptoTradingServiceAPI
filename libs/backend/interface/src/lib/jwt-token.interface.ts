import { USER_ROLES } from '@cupo/backend/constant';

export enum DEVICE_TYPE {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
}

export interface JwtToken {
  sessionId: string;
  userId: string;
  role: USER_ROLES;
  deviceType?: DEVICE_TYPE;
  iat?: number;
  exp?: number;
}
