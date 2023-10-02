import { TIMEFRAME } from '@cupo/timeseries';

export type CalculateIndicatorsParams = {
  exchangeId: string;
  symbol: string;
  timeframe: TIMEFRAME;
  indexId?: string;
  shift?: number;
  limit?: number;
};

export interface IndicatorCard {
  id: string;
  name: string;
  description: string;
  type: string;
  params: Record<string, number | string>;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export type IndicatorsObject = Record<string, string | number | boolean | Record<string, string | number | boolean>>;

export type IndicatorsValues = IndicatorsObject & {
  time: number;
  update?: number;
  finished?: boolean;
  humanTime?: Date;
  shift?: number;
};
