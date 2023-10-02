import { CandleObject, getClosedCandle, getClosedCandleByShift, TIMEFRAME } from '@cupo/timeseries';
import { getIndicatorValue, IndicatorsObject } from '@cupo/indicators';
import { ExchangePrice, INDICATOR_SIGNAL, StrategyCondition, StrategyParameters } from '@cupo/backend/interface';

export function cupoIndicatorsStrategy(options: {
  exchangeId?: string;
  symbol?: string;
  timeframe?: string;
  params: StrategyParameters;
  price: ExchangePrice;
  candles: CandleObject[];
  indicatorsBase: IndicatorsObject[];
  indicatorsU1: IndicatorsObject[];
  indicatorsU2: IndicatorsObject[];
}): StrategyCondition[] {
  const { params, price, candles, indicatorsBase, indicatorsU1, indicatorsU2 } = options;

  const timeframe = params.timeframe as TIMEFRAME;
  // const uTimeframe1 = params.uTimeframe1 as TIMEFRAME;
  // const uTimeframe2 = params.uTimeframe2 as TIMEFRAME;

  const signal: StrategyCondition[] = [];

  // Closed candle
  const closedCandle1 = getClosedCandle(timeframe, candles);
  const closedCandle1IsGreen = closedCandle1 ? closedCandle1.close > closedCandle1.open : undefined;
  const closedCandle2 = getClosedCandleByShift(timeframe, 2, candles);
  const closedCandle2IsGreen = closedCandle2 ? closedCandle2.close > closedCandle2.open : undefined;
  const closedCandle3 = getClosedCandleByShift(timeframe, 3, candles);
  const closedCandle3IsGreen = closedCandle3 ? closedCandle3.close > closedCandle3.open : undefined;
  const closedCandle4 = getClosedCandleByShift(timeframe, 4, candles);

  // Moving averages
  const idx1 = getIndicatorValue(closedCandle1?.time, indicatorsBase);
  const ma1 = Math.max(+idx1?.['sma_len3_ap0_shift2'] || 0, +idx1?.['sma_len32_ap1_shift2'] || 0);
  const emaMin1 = Math.min(+idx1?.['ema_len8_ap0_shift0'] || 0, +idx1?.['ema_len89_ap0_shift0'] || 0);
  const emaMax1 = Math.max(+idx1?.['ema_len8_ap0_shift0'] || 0, +idx1?.['ema_len89_ap0_shift0'] || 0);

  const idx2 = getIndicatorValue(closedCandle2?.time, indicatorsBase);
  const ma2 = Math.max(+idx2?.['sma_len3_ap0_shift2'] || 0, +idx2?.['sma_len32_ap1_shift2'] || 0);

  const idx3 = getIndicatorValue(closedCandle3?.time, indicatorsBase);
  const ma3 = Math.max(+idx3?.['sma_len3_ap0_shift2'] || 0, +idx3?.['sma_len32_ap1_shift2'] || 0);

  const idx4 = getIndicatorValue(closedCandle4?.time, indicatorsBase);
  const ma4 = Math.max(+idx4?.['sma_len3_ap0_shift2'] || 0, +idx4?.['sma_len32_ap1_shift2'] || 0);

  // CM ULTIMATE TREND COLOR
  const u1 = indicatorsU1?.[0]?.['CM_Ultimate_MTF_V2_tf0_period20_t3factor7_mamode0_smooth1'];
  if (u1?.['trend'] === 1) {
    signal.push({
      signal: INDICATOR_SIGNAL.TREND_UP,
      comment: 'CMU TREND: GREEN',
      candleTime: +indicatorsU1?.[0]?.time,
    });
  } else if (u1?.['trend'] === -1) {
    signal.push({
      signal: INDICATOR_SIGNAL.TREND_DOWN,
      comment: 'CMU TREND: RED',
      candleTime: +indicatorsU1?.[0]?.time,
    });
  }

  // EMA SIGNAL
  if (price?.ask && emaMin1 && price.ask < emaMin1) {
    // if (closedCandle1 && emaMin1 && price.ask < emaMin1 && closedCandle1.close < emaMin1) {
    signal.push({
      signal: INDICATOR_SIGNAL.EMA_PRICE_LOWER,
      comment: 'EMAs show BUY',
      candleTime: +idx1?.time || Date.now(),
    });
  } else if (price.bid && emaMax1 && price.bid > emaMax1) {
    // } else if (closedCandle1 && emaMax1 && price.bid > emaMax1 && closedCandle1.close > emaMax1) {
    signal.push({
      signal: INDICATOR_SIGNAL.EMA_PRICE_HIGHER,
      comment: 'EMAs show SELL',
      candleTime: +idx1?.time || Date.now(),
    });
  }

  // MACD SIGNAL
  const macd1 = idx1?.['macd_fastema12_slowema26_ap0_signalsma9'];
  const macd2 = idx2?.['macd_fastema12_slowema26_ap0_signalsma9'];
  if (
    macd1?.['macd'] &&
    macd1?.['signal'] &&
    macd1?.['histogram'] &&
    macd1['macd'] > macd1['signal'] &&
    macd2?.['macd'] &&
    macd2?.['signal'] &&
    macd2?.['histogram'] &&
    macd2['macd'] < macd2['signal']
  ) {
    signal.push({
      signal: INDICATOR_SIGNAL.MACD_CROSSES_UP,
      comment: 'MACD SHOW RAISING',
      candleTime: +idx1?.time || Date.now(),
    });
    signal.push({
      signal: INDICATOR_SIGNAL.OPEN_LONG_MACD,
      comment: 'OPEN LONG AND CLOSE SHORT',
      candleTime: +idx1?.time || Date.now(),
    });
  } else if (
    macd1?.['macd'] &&
    macd1?.['signal'] &&
    macd1?.['histogram'] &&
    macd1['macd'] < macd1['signal'] &&
    macd2?.['macd'] &&
    macd2?.['signal'] &&
    macd2?.['histogram'] &&
    macd2['macd'] > macd2['signal']
  ) {
    signal.push({
      signal: INDICATOR_SIGNAL.MACD_CROSSES_DOWN,
      comment: 'MACD SHOW FALLING',
      candleTime: +idx1?.time || Date.now(),
    });
    signal.push({
      signal: INDICATOR_SIGNAL.OPEN_SHORT_MACD,
      comment: 'OPEN SHORT AND CLOSE LONG',
      candleTime: +idx1?.time || Date.now(),
    });
  }

  // CM ULTIMATE HIGH TREND COLOR
  const u2 = indicatorsU2?.[0]?.['CM_Ultimate_MTF_V2_tf0_period20_t3factor7_mamode0_smooth1'];
  if (u2?.['trend'] === 1) {
    signal.push({
      signal: INDICATOR_SIGNAL.HIGH_TREND_UP,
      comment: 'CMU HIGH TREND: GREEN',
      candleTime: +indicatorsU2?.[0]?.time,
    });
  } else if (u2?.['trend'] === -1) {
    signal.push({
      signal: INDICATOR_SIGNAL.HIGH_TREND_DOWN,
      comment: 'CMU HIGH TREND: RED',
      candleTime: +indicatorsU2?.[0]?.time,
    });
  }

  // 2. ВХОД В СДЕЛКУ
  // должна закрыться зеленая свеча
  if (closedCandle1 && closedCandle1IsGreen) {
    // MACD рисует пересечение (синяя полоса находится над красной) образуя тем самым смену настроения рынка на покупку
    const macd = idx1?.['macd_fastema12_slowema26_ap0_signalsma9'];
    if (macd?.['macd'] && macd?.['signal'] && macd?.['histogram'] && macd['macd'] > macd['signal']) {
      // Indicators
      if (ma1 && ma2 && ma3 && ma4 && u1) {
        // const closedCandle = getClosedCandle(timeframe, candles);
        // const closedCandleIsGreen = closedCandle ? closedCandle.close > closedCandle.open : undefined;
        // должна закрыться зеленая свеча ( растущая ) над мувингами 1 и 2 и не касаться их ни телом ни тенью
        if (
          price.bid > ma1 &&
          ((closedCandle1.low > ma1 && closedCandle2.low <= ma2) ||
            (closedCandle1.low > ma1 && closedCandle2.low > ma2 && closedCandle3.low <= ma2) ||
            (closedCandle1.low > ma1 && closedCandle2.low > ma2 && closedCandle3.low > ma3 && closedCandle4.low <= ma4))
        ) {
          // в завершение должен быть зеленый цвет индикатора CM_Ultimate_MA_MTF_V2 (“U-Time 1”).
          if (signal.some((s) => s.signal === INDICATOR_SIGNAL.TREND_UP)) {
            signal.push({
              signal: INDICATOR_SIGNAL.OPEN_LONG_NEW,
              comment: '2. ВХОД В СДЕЛКУ',
              candleTime: +candles?.[0]?.time,
            });
          }
        }
      }
    }
  }

  // 3. ВХОД В СДЕЛКУ
  // должна закрыться зеленая свеча
  if (closedCandle1 && closedCandle1IsGreen && closedCandle2 && closedCandle3) {
    // ордер не открывается до тех пор, пока не произошло пересечение МАСD но не больше чем 2 новые свечи
    const macd1 = idx1?.['macd_fastema12_slowema26_ap0_signalsma9'];
    const macd2 = idx2?.['macd_fastema12_slowema26_ap0_signalsma9'];
    if (
      macd1?.['macd'] &&
      macd1?.['signal'] &&
      macd1?.['histogram'] &&
      macd1['macd'] > macd1['signal'] &&
      macd2?.['macd'] &&
      macd2?.['signal'] &&
      macd2?.['histogram'] &&
      macd2['macd'] <= macd2['signal']
    ) {
      if (ma1 && ma2 && ma3 && ma4 && u1) {
        // ордер не открывается до тех пор пока не произошло пересечение но не больше чем 2 новые свечи,
        // если появилась 3 свеча (имеется в виду над МА), а пересечение так и не произошло тогда робот ищет точку входа
        if (
          (closedCandle1.low > ma1 && closedCandle2.low <= ma2) ||
          (closedCandle1.low > ma1 && closedCandle2.low > ma2 && closedCandle2IsGreen && closedCandle3.low <= ma2) ||
          (closedCandle1.low > ma1 &&
            closedCandle2.low > ma2 &&
            closedCandle2IsGreen &&
            closedCandle3.low > ma3 &&
            closedCandle3IsGreen &&
            closedCandle4.low <= ma4)
        ) {
          // в завершение должен быть зеленый цвет индикатора CM_Ultimate_MA_MTF_V2 (“U-Time 1”).
          if (signal.some((s) => s.signal === INDICATOR_SIGNAL.TREND_UP)) {
            signal.push({
              signal: INDICATOR_SIGNAL.OPEN_LONG_NEW,
              comment: '3. ВХОД В СДЕЛКУ',
              candleTime: +candles?.[0]?.time,
            });
          }
        }
      }
    }
  }

  return signal;
}
