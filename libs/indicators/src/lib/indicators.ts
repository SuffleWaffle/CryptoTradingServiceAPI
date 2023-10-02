import { CandleObject } from '@cupo/timeseries';
import {
  getAppliedPrice,
  INDICATOR_NAME,
  INDICATOR_PARAMS_CM_U_MTF_V2,
  INDICATOR_PARAMS_COMMON,
  INDICATOR_PARAMS_MA,
  INDICATOR_PARAMS_MACD,
} from './indicator.constant';
import { IndicatorCard, IndicatorsObject } from './indicator.interface';
import { EMA, LWMA, SMA } from './averages';

export function indicators(): number {
  return EMA([1.1, 2.2, 3.4, 2.1], 13)[0];
}

export const calculateSMA = (
  candles: CandleObject[],
  params: Record<string, number | string>,
  precision = 6
): number => {
  const row = params[INDICATOR_PARAMS_COMMON.SHIFT] ? candles.slice(+params[INDICATOR_PARAMS_COMMON.SHIFT]) : candles;

  // console.log(
  //   'calculateSMA:',
  //   candles.length,
  //   params[INDICATOR_PARAMS_SMA.PERIOD],
  //   row.length,
  //   simpleMovingAverage(
  //     row.map((candle) =>
  //       getAppliedPrice(
  //         candle,
  //         Number(params[INDICATOR_PARAMS_SMA.APPLIED_PRICE])
  //       )
  //     ),
  //     +params[INDICATOR_PARAMS_SMA.PERIOD]
  //   )[0]
  // );

  return SMA(
    row.map((candle) => getAppliedPrice(candle, Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE]))),
    +params[INDICATOR_PARAMS_MA.PERIOD]
  )[0];
};

export const calculateEMA = (
  candles: CandleObject[],
  params: Record<string, number | string>,
  precision = 6
): number => {
  const row = params[INDICATOR_PARAMS_COMMON.SHIFT]
    ? candles.slice(+params[INDICATOR_PARAMS_COMMON.SHIFT])
    : [...candles];

  // console.log(
  //   params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE],
  //   getAppliedPrice(
  //     row[0],
  //     Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE])
  //   ),
  //   'SMA:',
  //   tw.ma(
  //     row.map((candle) =>
  //       getAppliedPrice(
  //         candle,
  //         Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE])
  //       )
  //     ),
  //     +params[INDICATOR_PARAMS_EMA.PERIOD]
  //   )[0],
  //   'TW:',
  //   tw.ema(
  //     row.map((candle) =>
  //       getAppliedPrice(
  //         candle,
  //         Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE])
  //       )
  //     ),
  //     +params[INDICATOR_PARAMS_EMA.PERIOD]
  //   )[0],
  //   'ME:',
  //   myExponentialMovingAverage(
  //     row.map((candle) =>
  //       getAppliedPrice(
  //         candle,
  //         Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE])
  //       )
  //     ),
  //     +params[INDICATOR_PARAMS_EMA.PERIOD]
  //   )[0]
  // );

  return EMA(
    row.map((candle) => getAppliedPrice(candle, Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE]))),
    +params[INDICATOR_PARAMS_MA.PERIOD]
  )[0];
};

export const calculateLWMA = (
  candles: CandleObject[],
  params: Record<string, number | string>,
  precision = 6
): number => {
  const row = params[INDICATOR_PARAMS_COMMON.SHIFT]
    ? candles.slice(+params[INDICATOR_PARAMS_COMMON.SHIFT])
    : [...candles];

  return LWMA(
    row.map((candle) => getAppliedPrice(candle, Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE]))),
    +params[INDICATOR_PARAMS_MA.PERIOD]
  )[0];
};

// MACD
// short_term_ema = 12, long_term_ema = 26, signal_ema = 9
// fastEMA = ema(close, short_term_ema)
// slowEMA = ema(close, long_term_ema)
// macd = fastEMA - slowEMA
// signal = sma(macd, signal_ema)
export const calculateMACD = (
  candles: CandleObject[],
  params: Record<string, number | string>,
  precision = 6
): Record<string, number> | null => {
  const period =
    Math.max(
      Math.max(+params[INDICATOR_PARAMS_MACD.FAST_PERIOD], +params[INDICATOR_PARAMS_MACD.SLOW_PERIOD]),
      +params[INDICATOR_PARAMS_MACD.SIGNAL_PERIOD]
    ) + 1;
  if (!candles || candles.length - 1 < period) {
    return null;
  }

  const row = candles.map((candle) => getAppliedPrice(candle, Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE])));

  const fast = EMA(row, +params[INDICATOR_PARAMS_MACD.FAST_PERIOD]);

  const slow = EMA(row, +params[INDICATOR_PARAMS_MACD.SLOW_PERIOD]);

  if (!fast?.length || !slow?.length) {
    return null;
  }

  const macd = [];

  for (let i = 0; i < period; i++) {
    macd.push(fast[i] - slow[i]);
  }

  const [signal] = SMA(macd, +params[INDICATOR_PARAMS_MACD.SIGNAL_PERIOD]);

  return {
    macd: macd[0],
    signal: signal,
    histogram: macd[0] - signal,
  };
};

export function calculateSM_Ultimate_MTF_V2(
  candles: CandleObject[],
  params: Record<string, number | string>,
  precision = 6
): { value: number; trend: number } {
  const period = +params[INDICATOR_PARAMS_CM_U_MTF_V2.PERIOD];
  const smooth = +params[INDICATOR_PARAMS_CM_U_MTF_V2.SMOOTH];

  if (!candles || candles.length - 1 < period) {
    return null;
  }
  const res: { value: number; trend: number } = { value: 0, trend: 0 };

  const row = candles.map((candle) => getAppliedPrice(candle, Number(params[INDICATOR_PARAMS_COMMON.APPLIED_PRICE])));

  const hull_wma_fast = LWMA(row, period / 2);
  const hull_wma_slow = LWMA(row, period);

  const hull_wma_step = [];
  const color = [];

  let n;
  for (n = 0; n < row.length; n++) {
    hull_wma_step.push(hull_wma_fast[n] - hull_wma_slow[n]);
  }
  // const hull = LWMA(hull_wma_step, Math.sqrt(period));

  //AVR
  const avr = SMA(row, period);
  if (!avr?.length) {
    return null;
  }

  for (n = 0; n < avr.length; n++) {
    if (avr.length > n + smooth) {
      color.push(avr[n] >= avr[n + smooth] ? 1 : -1);
    }
  }
  if (!color?.length) {
    return null;
  }

  res.value = avr[0];
  res.trend = color[0];

  return res;
}

export function calculateIndicators(
  candles: CandleObject[],
  indicators: IndicatorCard[],
  pricePrecision: number,
  shift = 0
): Record<string, number | Record<string, number>> {
  const values = {};
  const ts: CandleObject[] = shift === 0 ? candles : candles.slice(shift);

  indicators
    .filter((idx) => idx.isArchived !== true)
    .forEach((idx) => {
      switch (idx.name) {
        case INDICATOR_NAME.SMA:
          if (ts?.length > idx?.params?.[INDICATOR_PARAMS_MA.PERIOD]) {
            values[idx.id] = calculateSMA(ts, idx.params, pricePrecision);
          }
          break;
        case INDICATOR_NAME.EMA:
          if (ts?.length > idx?.params?.[INDICATOR_PARAMS_MA.PERIOD]) {
            values[idx.id] = calculateEMA(ts, idx.params, pricePrecision);
          }
          break;
        case INDICATOR_NAME.LWMA:
          values[idx.id] = calculateLWMA(ts, idx.params, pricePrecision);
          break;
        case INDICATOR_NAME.MACD:
          if (ts?.length > idx?.params?.[INDICATOR_PARAMS_MACD.SLOW_PERIOD]) {
            values[idx.id] = calculateMACD(ts, idx.params, pricePrecision);
          }
          break;
        case INDICATOR_NAME.CM_U_MTF_V2:
          if (ts?.length > idx?.params?.[INDICATOR_PARAMS_CM_U_MTF_V2.PERIOD]) {
            values[idx.id] = calculateSM_Ultimate_MTF_V2(ts, idx.params, pricePrecision);
          }
          break;
        default:
          break;
      }
    });

  return values;
}

export function getIndicatorValue(candleTime: number, indicators: IndicatorsObject[]): IndicatorsObject | undefined {
  for (const indicator of indicators) {
    if (indicator.time === candleTime) {
      return indicator;
    }
    if (indicator.time < candleTime) {
      return undefined;
    }
  }

  return undefined;
}
