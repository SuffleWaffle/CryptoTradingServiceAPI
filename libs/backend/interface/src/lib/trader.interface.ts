import { Market } from 'ccxt';
import { ExchangePrice } from './exchange.interface';
import { User } from './user.interface';

export type TradeOrderIdType = string;

export enum OPERATION_TYPE {
  BUY = 'BUY',
  SELL = 'SELL',
  BUY_LIMIT = 'BUY_LIMIT',
  SELL_LIMIT = 'SELL_LIMIT',
  BUY_STOP = 'BUY_STOP',
  SELL_STOP = 'SELL_STOP',
}

export enum ORDER_STATUS {
  PLACED = 'PLACED', // for limited orders
  OPENED = 'OPENED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED', // for limited orders
  WAIT_OPEN = 'PENDING OPEN',
  WAIT_CLOSE = 'PENDING CLOSE',
  WAIT_CANCEL = 'PENDING CANCEL',
}

export type TradeOrder = {
  id?: string; // order UUID
  userId: string; // user UID (form USER API)
  exchangeId: string; // exchange ID (name)
  symbol: string; // symbol
  signal?: TADE_SIGNAL; // signal type
  signalTime?: number; // time of calculated signal
  openTime: number; // order open timestamp
  openHumanTime?: Date; // order open Date
  openPrice: number; // order open price by market
  volume: number; // order volume from 10.5 to market maximum
  openCost?: number; // order open cost in base currency
  openVolume?: number; // order volume before decreased by commission fee
  type: OPERATION_TYPE; // order type (BUY or SELL)
  status?: ORDER_STATUS; // order status (OPENED, CLOSED, CANCELED)
  isVirtual?: boolean; // order is virtual - not opened on exchange
  closeTime?: number; // order close timestamp
  closeHumanTime?: Date; // order close Date
  closePrice?: number; // order close price by market
  stopLoss?: number; // price of order Stop Loss price (not implemented)
  takeProfit?: number; // price of order Take Profit (not implemented)
  swap?: number; // order Swap (not implemented)
  commission?: number; // exchange commission  (not implemented)
  tax?: number; // sum of taxes  (not implemented)
  currentPrice?: number; // curren bid price
  profit?: number; // order profit (closePrice - openPrice)
  commentClose?: string; // comment when order close (any text)
  errorEvents?: number; // count of error events
  errorEventsUnread?: number; // count of unread error events

  isDeleted?: boolean; // order is deleted (the mark in the DB)
  created?: number; // created timestamp
  updated?: number; // updated timestamp
  comment?: string; // comment (any text)
  client?: string; // managing server id
};

export interface TradeSignalType {
  userId: string;
  exchangeId: string;
  symbol?: string;
  time?: number;
  virtual?: boolean;
  type: TADE_SIGNAL;
  comment?: string;
  order?: TradeOrder;
  orderIds?: string[];
}

export interface StrategyCondition {
  signal: INDICATOR_SIGNAL;
  comment?: string;
  candleTime?: number;
}

export interface StrategyOrderSignalsCUPO {
  user: User;
  exchangeId: string;
  symbol: string;
  conditions: StrategyCondition[];
  market: Market;
  price: ExchangePrice;
}

export enum INDICATOR_SIGNAL {
  OPEN_LONG_NEW = 'CUPO Open  BUY',
  OPEN_SHORT_NEW = 'CUPO Open SELL',
  OPEN_LONG_MACD = 'MACD open BUY',
  OPEN_SHORT_MACD = 'MACD open SELL',

  TREND_UP = 'Trend RAISING',
  TREND_DOWN = 'Trend FALLING',
  HIGH_TREND_UP = 'High Trend RAISING',
  HIGH_TREND_DOWN = 'High Trend FALLING',

  CANDLE = 'Candle',
  CM_ULTIMATE_TREND_GREEN = 'CM Ultimate trend is GREEN',
  CM_ULTIMATE_HIGH_TREND_GREEN = 'CM Ultimate high trend is GREEN',
  MA_CROSSES = 'MA crosses',
  MACD_CROSSES_UP = 'MACD cross RAISING',
  MACD_CROSSES_DOWN = 'MACD cross FALLING',

  EMA_PRICE_LOWER = 'EMA price RAISE',
  EMA_PRICE_HIGHER = 'EMA price FALL',
}

export enum TADE_SIGNAL {
  NONE = 'No signal',
  CANCEL = 'CANCEL limit orders',
  CANCEL_ALL_VIRTUAL = 'CANCEL virtual orders',

  BUY = 'BUY',
  BUY_PYRAMIDING = 'BUY_pyramiding',
  BUY_AVERAGING = 'BUY_averaging',

  SELL = 'SELL',
  SELL_PYRAMIDING = 'SELL_pyramiding',
  SELL_AVERAGING = 'SELL_averaging',

  CLOSE = 'CLOSE_orders',
  CLOSE_DISABLED = 'CLOSE_orders_with_disables_symbols',

  CLOSE_FIRST_BUY = 'Close the first buy order',
  CLOSE_LAST_BUY = 'Close the last buy order',
  CLOSE_ALL_BUY_PROFIT = 'Close all profit buy orders',
  CLOSE_ALL_BUY = 'Close_ALL_BUY_orders',

  CLOSE_FIRST_SELL = 'Close the first sell order',
  CLOSE_LAST_SELL = 'Close the last buy order',
  CLOSE_ALL_SELL_PROFIT = 'Close all profit sell orders',
  CLOSE_ALL_SELL = 'Close_ALL_SELL_orders',

  CLOSE_FIRST = 'Close the first order',
  CLOSE_LAST = 'Close the last order',
  CLOSE_ONE_MAX_PROFIT = 'Close a max profit order',
  CLOSE_ALL_PROFIT = 'Close all profit orders',
  CLOSE_ALL = 'Close_ALL_orders',
  CLOSE_ALL_VIRTUAL = 'Close all virtual orders',
  CLOSE_TP = 'Close orders by TP',
  CLOSE_SL = 'Close orders by SL',
}
