import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUS } from './trader.interface';
import { IGetListDto } from './list.dto';

export class CloseOrdersBodyDto {
  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  userId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  exchangeId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  orderId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'LTC/BTC',
  })
  symbol?: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => Array)
  // @Transform(({ value }) => value && JSON.parse(value))
  @ApiProperty({
    type: Array,
    example: '["02111d1e-a550-467a-afef-c10aeb18bee5","ed427be9-edb8-4977-bc25-0ae8f9789124"]',
  })
  orderIds?: string[];

  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  virtual?: boolean;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({
    type: Number,
  })
  volume?: number;
}

export class CancelVirtualOrdersBodyDto {
  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'LTC/BTC',
  })
  symbol?: string;
}

export class OpenOrderBodyDto {
  @Expose()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'LTC/BTC',
  })
  symbol: string;

  @Expose()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'sell | buy',
  })
  type: string; // 'byu' || 'sell'

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({
    type: String,
    example: '0.01',
  })
  amount?: number; // if undefined then amount is equal to minimum amount of operation

  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  virtual?: boolean;
}

export enum ORDERS_SORT_FIELD {
  OPEN_TIME = 'openTime',
  CLOSE_TIME = 'closeTime',
  OPEN_PRICE = 'openPrice',
  CLOSE_PRICE = 'closePrice',
  VOLUME = 'volume',
  PROFIT = 'profit',
  STATUS = 'status',
  USER_ID = 'userId',
  EXCHANGE_ID = 'exchangeId',
  SYMBOL = 'symbol',
  TYPE = 'type',
  IS_VIRTUAL = 'isVirtual',
  IS_DELETED = 'isDeleted',
  USER_NAME = 'userName',
  USER_EMAIL = 'userEmail',
}

export interface IGetAllOrders extends IGetListDto {
  userId?: string;
  userIds?: string[];

  userName?: string;

  userEmail?: string;

  userPlatformId?: number;

  orderId?: string;
  orderIds?: string[];

  exchangeId?: string;

  symbol?: string;

  status?: ORDER_STATUS;

  active?: boolean;

  virtual?: boolean;

  sort?: ORDERS_SORT_FIELD;
}

export class GetAllOrdersQueryDto implements IGetAllOrders {
  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  userId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  userName?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  userEmail?: string;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  userPlatformId?: number;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  exchangeId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'LTC/BTC',
  })
  symbol?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  orderId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => value?.toUpperCase() || undefined)
  @ApiProperty({
    type: String,
    example: 'CLOSED',
  })
  status?: ORDER_STATUS;

  @Expose()
  @IsOptional()
  @IsBoolean()
  // @Type(() => Boolean)
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  active?: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  deleted?: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  virtual?: boolean;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  itemsPerPage?: number;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  sort?: ORDERS_SORT_FIELD;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  readonly sortOrder?: number = 1;
}

export class GetOrdersQueryDto {
  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'LTC/BTC',
  })
  symbol?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'CLOSED',
  })
  status?: ORDER_STATUS;

  @Expose()
  @IsOptional()
  @IsBoolean()
  // @Type(() => Boolean)
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  active?: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  virtual?: boolean;
}

export class GetEarningQueryDto {
  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  virtual?: boolean;
}

export class GetProfitOrdersQueryDto {
  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toUpperCase()))
  @ApiProperty({
    type: String,
    example: 'LTC/BTC',
  })
  symbol?: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  virtual?: boolean;
}

export class GetSymbolsOrdersQueryDto {
  @Expose()
  @IsOptional()
  @IsBoolean()
  @Type(() => String)
  @Transform(({ value }) => (value?.length ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  virtual?: boolean;
}
