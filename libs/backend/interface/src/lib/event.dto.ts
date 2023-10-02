import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Expose, Transform, Type } from 'class-transformer';
import { IGetListDto } from './list.dto';
import { EVENT_KIND } from './event.interface';

export enum EVENTS_SORT_FIELD {
  USER_NAME = 'userName',
  USER_EMAIL = 'userEmail',
}

export interface IGetAllEvents extends IGetListDto {
  time?: number;
  userId?: string;
  orderId?: string;
  entityId?: string;
  kind?: EVENT_KIND;
  sort?: EVENTS_SORT_FIELD;
}

export class GetAllEventsQueryDto implements IGetAllEvents {
  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  readonly time?: number = 0;

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
  orderId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform(({ value }) => (!value || value === '' ? undefined : value.toLowerCase()))
  entityId?: string;

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
  sort?: EVENTS_SORT_FIELD;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  readonly sortOrder?: number = 1;
}
