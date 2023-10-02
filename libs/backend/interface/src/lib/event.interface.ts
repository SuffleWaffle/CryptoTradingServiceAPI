export enum EVENT_KIND {
  ORDER = 'order',
  USER = 'user',
  SYSTEM = 'system',
}

export enum EVENT_TYPE {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_OPENED_EXCHANGE = 'ORDER_OPENED_EXCHANGE',
  ORDER_OPENED = 'ORDER_OPENED',
  ORDER_CLOSED_EXCHANGE = 'ORDER_CLOSED_EXCHANGE',
  ORDER_CLOSED = 'ORDER_CLOSED',
  ORDER_CANCELED = 'ORDER_CANCELED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_ERROR = 'ORDER_ERROR',
  ORDER_INFO = 'ORDER_INFO',
  INDICATOR_UPDATED = 'INDICATOR_UPDATED',
  OTHER = 'OTHER',
  TP_CROSSED = 'TP_CROSSED',
  SL_CROSSED = 'SL_CROSSED',
  PARTIAL_CLOSED = 'PARTIAL_CLOSED',
  APP_STARTED = 'APP_STARTED',
  USER_MANAGE_ORDERS = 'USER_MANAGE_ORDERS',
}

export type COMMON_EVENT = {
  type: EVENT_TYPE; // fixed event tag
  kind?: EVENT_KIND;
  event?: string; // event message
  time?: number;
  humanTime?: Date;
  data?: number | string | boolean | any;
  _id?: string;
  read?: boolean;
};

export interface ORDER_EVENT extends COMMON_EVENT {
  kind?: EVENT_KIND.ORDER;
  orderId?: string;
  symbol?: string;
  exchangeId?: string;
  userId?: string;
  isVirtual?: boolean;
}

export interface USER_EVENT extends COMMON_EVENT {
  kind?: EVENT_KIND.USER;
  userId?: string;
}

export interface SYSTEM_EVENT extends COMMON_EVENT {
  kind?: EVENT_KIND.SYSTEM;
  entityId?: string;
}

export type EVENT = ORDER_EVENT | USER_EVENT | SYSTEM_EVENT;
