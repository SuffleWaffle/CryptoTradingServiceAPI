import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TIMEFRAME } from '@cupo/timeseries';

export class FetchCandlesBodyDto {
  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: 'binance',
  })
  exchangeId: string;

  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: 'BTC/USDT',
  })
  symbol: string;

  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: '1h',
  })
  timeframe: TIMEFRAME;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({
    type: Number,
    example: 1656325980000,
  })
  since?: number;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({
    type: Number,
    example: 1,
  })
  limit?: number;
}

export class GetTickersQueryDto {
  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(({ value }) => value && value.split(','))
  @ApiProperty({
    type: Array,
    example: 'USDT,BTC',
  })
  baseCurrencies?: string[];
}

export class GetTickerQueryDto {
  @Expose()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'LTC/BTC',
  })
  symbol: string;
}

export class GetIndicatorValuesQueryDto {
  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: 'BTC/USDT',
  })
  symbol: string;

  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: '1h',
  })
  timeframe: TIMEFRAME;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: 'sma_len3_ap0_shift2',
  })
  indexId?: string;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({
    type: Number,
    description: 'Candles count from 0 to N',
    example: 34,
  })
  limit?: number;
}
