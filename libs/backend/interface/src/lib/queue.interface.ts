import { TradeOrder, TradeSignalType } from './trader.interface';
import { ExchangePrice, Tickers } from './exchange.interface';
import { SendPulseOptionsType } from './sendpulse.interface';
import { Balances } from "ccxt";

// todo: change long strings to short names in the future
export enum QUEUE_TYPE {
  CANDLE = 'process-candles',
  COLLECTOR = 'process-garbage-collector',
  EXCHANGE = 'process-exchange',
  INDICATOR = 'process-indicator',
  ORDER = 'process-orders',
  SIGNAL = 'process-trade-signals',
  EMAIL = 'process-email',
  EVENT = 'process-events',
}

// todo: change long strings to short names in the future
export enum QUEUE_NAME {
  UPDATE_CANDLES = 'update-candles',

  CALCULATE_INDICATOR = 'calculate-indicator',

  CHECK_SIGNAL_INDICATORS = 'check-signal-indicator',
  CHECK_SIGNAL_OPEN_ORDERS = 'check-signal-open-orders',

  OPEN_ORDER = 'open-order',
  CANCEL_ORDER = 'cancel-order',
  CLOSE_ORDER = 'close-order',
  UPDATE_ORDER = 'update-order',

  COLLECT_ORDERS = 'collect-orders',
  COLLECT_CANDLES = 'collect-candles',
  COLLECT_INDICATORS = 'collect-indicators',

  SEND_EMAIL = 'send-email',

  ADD_ORDER_EVENT = 'add-order-event',
  ADD_USER_EVENT = 'add-user-event',
  ADD_SYSTEM_EVENT = 'add-system-event',
  UPDATE_USER_WALLET = 'update-user-wallet',
}

export type QueueParamsOpenOrder = TradeSignalType;
// {
//   userId: string;
//   exchangeId: string;
//   symbol: string;
//   orderType: OPERATION_TYPE;
//   comment?: string;
// };

export type QueueParamsCancelOrders = TradeSignalType;

export type QueueParamsCloseOrders = TradeSignalType;
// {
//   userId: string;
//   exchangeId: string;
//   symbol?: string;
//   comment?: string;
//   orderIds?: string[];
//   orders?: TradeOrderType[];
// };

export type QueueParamsUpdateOrders = {
  userId: string;
  exchangeId: string;
  orders: TradeOrder[];
};

export type QueueParamsUpdateOrdersProfit = {
  exchangeId: string;
  tickers: Tickers | ExchangePrice[];
};

export type QueueParamsCalculateIndicatorSignal = {
  exchangeId: string;
  symbol: string;
};

export type QueueParamsSendEmail = {
  email: SendPulseOptionsType;
  payload?: { [key: string]: any };
};

export type QueueParamsUpdateBalances = {
  userId: string;
  exchangeId: string;
  balance: Balances;
  updated?: number;
};
