export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogRecordType = {
  action: string; // action name
  timestamp?: number; // timestamp of the log record
  timestampHuman?: Date; // timestamp of the log record in human view
  data?: object; // action data
  level?: LogLevel; // log level
  userId?: string; // userId of the user who made the action
  orderId?: string; // orderId of the order
  symbol?: string; // symbol of the order
  exchangeId?: string; // exchangeId of the exchange where the action was made
};
