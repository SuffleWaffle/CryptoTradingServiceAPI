import { Ticker } from 'ccxt';
import { TIMEFRAME } from './timeseries.interface';

export enum CandleArrayOrder {
  Time,
  Open = 1,
  High = 2,
  Low = 3,
  Close = 4,
  Volume = 5,
}

export type CandleProps = {
  time: number; // timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleObject = CandleProps & {
  candle: CandleArray;
  update?: number;
  finished?: boolean;
};

export type HumanCandleObject = CandleObject & {
  humanTime: Date;
  shift: number;
};

// export type CandleRedisObject = {
//   candle: string; // JSON.stringify(candle)
//   time: string; // String(candle[CandleEnum.Time])
//   open: string; // String(candle[CandleEnum.Open])
//   high: string; // String(candle[CandleEnum.High])
//   low: string; // String(candle[CandleEnum.Low])
//   close: string; // String(candle[CandleEnum.Close])
//   volume: string; // String(candle[CandleEnum.Volume])
// };

export type CandleArray = [number, number, number, number, number, number];


export type GarbageCollectOrdersParams = {
  exchangeId: string;
  userId: string;
};

export type GarbageCollectCandlesParams = {
  exchangeId: string;
  symbol: string;
  timeframe: TIMEFRAME;
  limit?: number;
};

export type GetCandlesParams = {
  exchangeId: string;
  symbol: string;
  timeframe: TIMEFRAME;
  since?: number;
  limit?: number;
  force?: boolean;
};

export type GetZeroCandlesParams = {
  exchangeId: string;
  tickers: Record<string, Ticker>;
};

export type GetTickersParams = {
  exchangeId: string;
  symbols?: string[];
};
