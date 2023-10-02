import { getCandleTime, getCandleTimeByShift } from './timeseries';
import { CandleObject } from './candle.interface';
import { TIMEFRAME } from './timeseries.interface';

export function getZeroCandle(timeframe: TIMEFRAME, candles: CandleObject[]): CandleObject | undefined {
  if (candles?.length && candles[0].time === getCandleTime(timeframe)) {
    return candles[0];
  }

  return undefined;
}

export function getClosedCandle(timeframe: TIMEFRAME, candles: CandleObject[]): CandleObject | undefined {
  if (candles?.length && candles[0].time === getCandleTimeByShift(timeframe, 1)) {
    return candles[0];
  }

  if (candles?.length > 1 && candles[1].time === getCandleTimeByShift(timeframe, 1)) {
    return candles[1];
  }

  return undefined;
}

export function getClosedCandleByShift(timeframe: TIMEFRAME, shift: number, candles: CandleObject[]): CandleObject | undefined {
  if (candles?.length) {
    for (let i = 0; i < candles.length && i <= shift; i++) {
      if (candles[i].time === getCandleTimeByShift(timeframe, shift)) {
        return candles[i];
      }
    }
  }

  return undefined;
}
