import { IsOptional, IsString } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export type GetExchangesDto = string[];

export class GetMarketsQueryDto {
  @Expose()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: 'USDT',
  })
  @IsOptional()
  @IsString()
  baseCurrency?: string;
}

export class GetMarketQueryDto {
  @Expose()
  @Type(() => String)
  @ApiProperty({
    type: String,
    example: 'BTC/USDT',
  })
  @IsString()
  symbol: string;
}
