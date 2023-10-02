import { Dictionary, Market, Ticker } from 'ccxt';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IndicatorCard, IndicatorsValues } from '@cupo/indicators';
import { CandleObject } from '@cupo/timeseries';

export class HTTP_RESPONSE<T> {
  @Expose()
  @ApiProperty({
    description: 'Status code',
    type: Number,
  })
  statusCode: number;

  @Expose()
  @ApiProperty({
    description: 'Error message',
    type: String,
  })
  message?: string;

  @Expose()
  @ApiProperty({
    description: 'Payload',
    type: Object,
  })
  error?: string;

  @Expose()
  @ApiProperty({
    description: 'Payload',
    type: Object,
  })
  data?: T;

  @Expose()
  @ApiProperty({
    description: 'url',
    type: Object,
  })
  urls?: { [key: string]: string };

  @Expose()
  @ApiProperty({
    description: 'Array length',
    type: Number,
  })
  length?: number;

  @Expose()
  @ApiProperty({
    description: 'Answer sum',
    type: Number,
  })
  sum?: number;

  @Expose()
  @ApiProperty({
    description: 'Last update',
    type: Number,
  })
  updated?: string;

  @Expose()
  @ApiProperty({
    description: 'Current page',
    type: Number,
  })
  page?: number;

  @Expose()
  @ApiProperty({
    description: 'Total records',
    type: Number,
  })
  totalItems?: number;

  @Expose()
  @ApiProperty({
    description: 'Records per page',
    type: Number,
  })
  itemsPerPage?: number;
}

export type Markets_HTTP_RESPONSE = HTTP_RESPONSE<{
  [symbol: string]: Market;
}>;

export type Tickers_HTTP_RESPONSE = HTTP_RESPONSE<{
  [symbol: string]: Ticker;
}>;

export type Candles_HTTP_RESPONSE = HTTP_RESPONSE<CandleObject[]>;

export type Candle_HTTP_RESPONSE = HTTP_RESPONSE<CandleObject>;

export type IndicatorsList_HTTP_RESPONSE = HTTP_RESPONSE<Dictionary<IndicatorCard>>;

export type IndicatorsValues_HTTP_RESPONSE = HTTP_RESPONSE<IndicatorsValues[]>;

export type IndicatorsValue_HTTP_RESPONSE = HTTP_RESPONSE<IndicatorsValues>;
