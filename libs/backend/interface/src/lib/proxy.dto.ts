import { UserProxyInterface } from './proxy.interface';
import { Expose, Transform, Type } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UserProxy implements UserProxyInterface {
  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => value || null)
  ip: string | null;

  @Expose()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => value?.toLowerCase() || undefined)
  userId: string;

  @Expose()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => value?.toLowerCase() || undefined)
  exchangeId: string;
}
