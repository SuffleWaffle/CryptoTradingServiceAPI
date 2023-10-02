import { CandleObject } from '@cupo/timeseries';

export enum INDICATOR_TYPE {
  OSCILLATOR = 'oscillator',
  TREND = 'trend',
  SIGNAL = 'signal',
}

export enum INDICATOR_NAME {
  ADX = 'ADX',
  ATR = 'ATR',
  BBANDS = 'BBANDS',
  CM = 'CM',
  CM_U_MTF_V2 = 'CM Ultimate MTF v2',
  CCI = 'CCI',
  SMA = 'SMA',
  EMA = 'EMA',
  LWMA = 'LWMA',
  SSMA = 'SSMA',
  MACD = 'MACD',
  MTF = 'MTF',
  OBV = 'OBV',
  RSI = 'RSI',
  ROC = 'ROC',
  STOCH = 'STOCH',
  WILLR = 'WILLR',
}

export enum PRICE_TYPE {
  CLOSE = 0,
  OPEN = 1,
  HIGH = 2,
  LOW = 3,
  MEDIAN = 4,
  TYPICAL = 5,
  WEIGHTED = 6,
  FULL_WEIGHTED = 7,
}

export enum INDICATOR_PARAMS_COMMON {
  SHIFT = 'shift',
  APPLIED_PRICE = 'appliedPrice',
}

export enum INDICATOR_PARAMS_MA {
  PERIOD = 'period',
}

export enum INDICATOR_PARAMS_MACD {
  FAST_PERIOD = 'fast',
  SLOW_PERIOD = 'slow',
  SIGNAL_PERIOD = 'signal',
}

export enum INDICATOR_PARAMS_CM_U_MTF_V2 {
  TIMEFRAME = 'timeframe', // ENUM_TIMEFRAMES resCustom = PERIOD_CURRENT;//Timeframe:
  PERIOD = 'period', // int             len       = 20;            //Moving Average Length - LookBack Period:
  T3_FACTOR = 't3Factor', // int             factorT3  = 7;             //Tilson T3 Factor - *.10 - so 7 = .7 etc.:
  MA_MODE = 'maMode', // var_ind_type    atype     = SMA;           //Mode:
  SMOOTH = 'smooth', // int             smooth   = 1;             //Color Smoothing - Setting 1 = No Smoothing:
}

export const getAppliedPrice = (candle: CandleObject, appliedPrice = 0): number => {
  switch (appliedPrice) {
    case 0: // CLOSE
      return candle.close;
    case 1: // OPEN
      return candle.open;
    case 2: // HIGH
      return candle.high;
    case 3: // LOW
      return candle.low;
    case 4: // MEDIAN
      return (candle.high + candle.low) / 2;
    case 5: // TYPICAL
      return (candle.high + candle.low + candle.close) / 3;
    case 6: // WEIGHTED
      return (candle.high + candle.low + candle.close * 2) / 4;
    case 7: // FULL WEIGHTED
      return (candle.high + candle.low + candle.open + candle.close) / 4;
    default:
      return candle.close;
  }
};
