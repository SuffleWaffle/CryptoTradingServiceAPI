import { CandleObject, TIMEFRAME } from '@cupo/timeseries';
import { IndicatorsObject } from '@cupo/indicators';
import { StrategyCondition } from './trader.interface';

export type StrategyParameters = Record<string, number | string | boolean | TIMEFRAME>;

export interface StrategyIndicatorSignalsCUPO {
  exchangeId: string;
  symbol: string;
  conditions: StrategyCondition[];
  candles: CandleObject[];
  indicatorsBase: IndicatorsObject[];
  indicatorsU1: IndicatorsObject[];
  indicatorsU2: IndicatorsObject[];
}
