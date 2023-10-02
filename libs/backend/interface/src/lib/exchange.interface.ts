import { Market, Ticker } from 'ccxt';

export type Tickers = Ticker[];

export type MarketsType = {
  [symbol: string]: Market;
};

export type TickersType = {
  [symbol: string]: Ticker;
};

export type DiffArbitrage = {
  minAsk?: number;
  maxBid?: number;
  minDiff?: number;
  maxDiff?: number;
  minDiffExchangeId?: string;
  maxDiffExchangeId?: string;
};

export type TickerArbitrage = {
  [exchangeId: string]: {
    ticker?: Ticker;
    buy?: DiffArbitrage;
    sell?: DiffArbitrage;

    buyDiff?: number;
    sellDiff?: number;
    symbol?: string;
  };
};

export type TickersArbitrage = {
  [symbol: string]: TickerArbitrage;
};

export type ExchangePrice = {
  exchangeId: string;
  symbol: string;
  timestamp: number;
  datetime: Date;
  bid: number;
  ask: number;
  close: number;
  bidVolume: number;
  askVolume: number;
};
