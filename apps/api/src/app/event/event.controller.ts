import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { REST_API_RESPONSE_STATUS, ROLE } from '@cupo/backend/constant';
import { ApiOperation } from '@nestjs/swagger';
import { EVENT, GetAllEventsQueryDto, ORDER_EVENT, SYSTEM_EVENT, USER_EVENT } from '@cupo/backend/interface';
import { HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';
import { EventApiService } from './event-api.service';
import { JwtAuthGuard } from '../provider/jwt-auth.guard';
import { Roles } from '@cupo/backend/common';

@Controller('event')
export class EventController {
  constructor(private readonly service: EventApiService) {}

  @Get('/list')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get order events`,
    parameters: [{ name: 'time', in: 'path', schema: { type: 'number' } }],
  })
  async getAllEventsList(
    @Query(new ValidationPipe({ transform: true })) query: GetAllEventsQueryDto
  ): Promise<HTTP_RESPONSE<EVENT[]>> {
    const { totalItems, events } = await this.service.getAllEventsList({ ...query });

    if (events) {
      return {
        statusCode: HttpStatus.OK,
        totalItems: totalItems,
        length: events.length,
        data: events,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ERROR GETTING ALL EVENTS',
        error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Get('/item/:time')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get event item`,
    parameters: [{ name: 'time', in: 'path', schema: { type: 'number' } }],
  })
  async getEventItem(@Param('time') time: string): Promise<HTTP_RESPONSE<EVENT>> {
    const event = await this.service.getEventItem(+time);

    if (event) {
      return {
        statusCode: HttpStatus.OK,
        data: event,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `ERROR GETTING EVENT ITEM ${time ?? ''}`,
        error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Get('/order/:orderId')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Header('content-type', 'application/json')
  async getOrderEvents(
    @Param('orderId') orderId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetAllEventsQueryDto
  ): Promise<HTTP_RESPONSE<ORDER_EVENT[]>> {
    const { totalItems, events } = await this.service.getOrderEvents({ ...query, orderId });

    if (events) {
      return {
        statusCode: HttpStatus.OK,
        totalItems: totalItems,
        length: events.length,
        data: events,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ERROR GETTING ORDER EVENTS',
        error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Get('/user/:userId')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Header('content-type', 'application/json')
  async getUserEvents(
    @Param('userId') userId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetAllEventsQueryDto
  ): Promise<HTTP_RESPONSE<USER_EVENT[]>> {
    const { totalItems, events } = await this.service.getUserEvents({ ...query, userId });

    if (events) {
      return {
        statusCode: HttpStatus.OK,
        totalItems: totalItems,
        length: events.length,
        data: events,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ERROR GETTING USER EVENTS',
        error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Get('/system/:entityId')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Header('content-type', 'application/json')
  async getSystemEvents(
    @Param('entityId') entityId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetAllEventsQueryDto
  ): Promise<HTTP_RESPONSE<SYSTEM_EVENT[]>> {
    const { totalItems, events } = await this.service.getSystemEvents({ ...query, entityId });

    if (events) {
      return {
        statusCode: HttpStatus.OK,
        totalItems: totalItems,
        length: events.length,
        data: events,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ERROR GETTING SYSTEM EVENTS',
        error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }
}
