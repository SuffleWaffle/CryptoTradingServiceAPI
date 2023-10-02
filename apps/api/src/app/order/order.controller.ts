import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CancelVirtualOrdersBodyDto,
  CloseOrdersBodyDto,
  GetAllOrdersQueryDto,
  GetEarningQueryDto,
  GetOrdersQueryDto,
  GetProfitOrdersQueryDto,
  GetSymbolsOrdersQueryDto,
  OpenOrderBodyDto,
  TradeOrder,
} from '@cupo/backend/interface';
import { Public, REST_API_RESPONSE_STATUS, ROLE } from '@cupo/backend/constant';
import { HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';
import { Roles } from '@cupo/backend/common';
import { JwtAuthGuard } from '../provider/jwt-auth.guard';

@ApiTags('trader', 'order')
@Controller('order')
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Get('/')
  async getTotalOrders(): Promise<HTTP_RESPONSE<Record<string, number>>> {
    return {
      statusCode: HttpStatus.OK,
      data: await this.service.getTotalOrders(),
    };
  }

  @Get('earnings/:userId')
  @ApiOperation({
    description: `Get earning profit of user `,
    parameters: [
      { name: 'userId', in: 'path', schema: { type: 'string' } },
      { name: 'virtual', in: 'query', schema: { type: 'boolean', nullable: true } },
    ],
  })
  async getUserEarnings(
    @Param('userId') userId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetEarningQueryDto
  ): Promise<HTTP_RESPONSE<{ [symbol: string]: number | { [key: string]: number } }>> {
    const response = await this.service.getUserEarnings({ userId, virtual: query.virtual });

    return {
      statusCode: HttpStatus.OK,
      data: response,
    };
  }

  @Get('earnings/:exchangeId/:userId')
  @ApiOperation({
    description: `Get earning profit of user `,
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'userId', in: 'path', schema: { type: 'string' } },
      { name: 'virtual', in: 'query', schema: { type: 'boolean', nullable: true } },
    ],
  })
  async getUserExchangeEarnings(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetEarningQueryDto
  ): Promise<HTTP_RESPONSE<{ [symbol: string]: number | { [key: string]: number } }>> {
    const response = await this.service.getUserEarnings({ userId, exchangeId, virtual: query.virtual });

    return {
      statusCode: HttpStatus.OK,
      data: response,
    };
  }

  @Public()
  @Get('/:exchangeId/:userId')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get user orders`,
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'userId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'active', in: 'query', schema: { type: 'boolean', nullable: true } },
      { name: 'virtual', in: 'query', schema: { type: 'boolean', nullable: true } },
    ],
  })
  async getUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetOrdersQueryDto
  ): Promise<HTTP_RESPONSE<{ [symbol: string]: TradeOrder[] | number }>> {
    const { symbol, active, virtual, status } = query;

    const { length, orders } = await this.service.getUserOrders(userId, exchangeId, symbol, active, virtual, status);

    if (orders) {
      return {
        statusCode: HttpStatus.OK,
        length: length,
        data: orders,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        error: REST_API_RESPONSE_STATUS.USER_EXCHANGE_NOT_CONFIGURED,
        message: 'User exchange not configured',
      } as HTTP_RESPONSE<void>,
      HttpStatus.CONFLICT
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/list/item/:orderId')
  @ApiOperation({
    description: `Get order item`,
    parameters: [{ name: 'orderId', in: 'path', schema: { type: 'string' } }],
  })
  async getOrderItem(@Param('orderId') orderId: string): Promise<HTTP_RESPONSE<TradeOrder>> {
    const order = await this.service.getOrderItem(orderId);

    if (order) {
      return {
        statusCode: HttpStatus.OK,
        data: order,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND,
        message: 'Order not found',
      } as HTTP_RESPONSE<void>,
      HttpStatus.CONFLICT
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Get('list')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    description: `Get all orders`,
    parameters: [
      { name: 'exchangeId', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'userId', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'userEmail', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'userName', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'symbol', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'active', in: 'query', schema: { type: 'boolean', nullable: true } },
      { name: 'virtual', in: 'query', schema: { type: 'boolean', nullable: true } },
    ],
  })
  async getAllOrders(@Query() query: GetAllOrdersQueryDto): Promise<HTTP_RESPONSE<TradeOrder[]>> {
    const { totalItems, orders } = await this.service.getAllOrders(query);

    if (orders) {
      return {
        statusCode: HttpStatus.OK,
        totalItems,
        page: query.page || undefined,
        itemsPerPage: query.itemsPerPage || undefined,
        length: orders.length,
        data: orders,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: REST_API_RESPONSE_STATUS.USER_EXCHANGE_NOT_CONFIGURED,
        message: 'User exchange not configured',
      } as HTTP_RESPONSE<void>,
      HttpStatus.CONFLICT
    );
  }

  @Get('brokenOrders/:exchangeId/:userId')
  @ApiOperation({
    description: `Get broken user orders`,
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'userId', in: 'path', schema: { type: 'string' } },
    ],
  })
  async getBrokenUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string
  ): Promise<
    HTTP_RESPONSE<{ [currency: string]: { balance: number; cost: number; ordersBalance: number; orders: string[] } }>
  > {
    const orders = await this.service.getBrokenUserOrders(userId, exchangeId);

    return {
      statusCode: HttpStatus.OK,
      length: Object.keys(orders || {}).length,
      data: orders,
    };
  }

  @Get('profit/:exchangeId/:userId')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get profit of user orders`,
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'userId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'virtual', in: 'query', schema: { type: 'boolean', nullable: true } },
    ],
  })
  async getProfitOfUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetProfitOrdersQueryDto
  ): Promise<HTTP_RESPONSE<{ [symbol: string]: number | string | { [key: string]: number } }>> {
    const { symbol, virtual } = query;

    const profit = await this.service.getProfitOfUserOrders(userId, exchangeId, symbol, virtual);

    if (profit) {
      return {
        statusCode: HttpStatus.OK,
        data: profit,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        error: REST_API_RESPONSE_STATUS.USER_EXCHANGE_NOT_CONFIGURED,
        message: 'User exchange not configured',
      } as HTTP_RESPONSE<void>,
      HttpStatus.CONFLICT
    );
  }

  @Get('symbols/:exchangeId/:userId')
  @ApiOperation({
    description: `Get symbols into the opened user orders`,
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'userId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'virtual', in: 'query', schema: { type: 'boolean', nullable: true } },
    ],
  })
  async getSymbolsOfOpenedOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetSymbolsOrdersQueryDto
  ): Promise<HTTP_RESPONSE<string[]>> {
    const { virtual } = query;

    const symbols = await this.service.getSymbolsOfOpenedOrders(userId, exchangeId, virtual);
    return {
      statusCode: HttpStatus.OK,
      length: symbols?.length,
      data: symbols?.sort(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('close/:exchangeId/:userId')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    description: `Close all user orders`,
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'userId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string', nullable: true } },
      { name: 'ordersId', in: 'query', schema: { type: 'boolean', nullable: true } },
    ],
  })
  async closeUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    // @Body(new ValidationPipe({ transform: true })) body: CloseOrdersBodyDto
    @Body() body: CloseOrdersBodyDto
  ): Promise<HTTP_RESPONSE<void>> {
    const { orderIds, symbol, virtual } = body;

    await this.service.closeAllUserOrders(userId, exchangeId, symbol, orderIds, virtual);
    return {
      statusCode: HttpStatus.OK,
      message: 'Started a job to close all user orders',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('userOrder/closeRegular')
  @UsePipes(new ValidationPipe({ transform: true }))
  async closeUserOrderRegular(@Body() body: CloseOrdersBodyDto): Promise<HTTP_RESPONSE<TradeOrder>> {
    const [error, message, result] = await this.service.closeUserOrder(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
        data: result,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error,
        message,
      },
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('userOrder/closeReminder')
  @UsePipes(new ValidationPipe({ transform: true }))
  async closeUserOrderReminder(@Body() body: CloseOrdersBodyDto): Promise<HTTP_RESPONSE<TradeOrder>> {
    const [error, message, result] = await this.service.closeUserOrder(body, true);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
        data: result,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error,
        message,
      },
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('userOrder/cancel')
  @UsePipes(new ValidationPipe({ transform: true }))
  async cancelUserOrder(@Body() body: CloseOrdersBodyDto): Promise<HTTP_RESPONSE<TradeOrder>> {
    const [error, message, result] = await this.service.cancelUserOrder(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
        data: result,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error,
        message,
      },
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('closeOne/:exchangeId/:userId/:orderId')
  @UsePipes(new ValidationPipe({ transform: true }))
  async closeOneUserOrder(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() body: CloseOrdersBodyDto
  ): Promise<HTTP_RESPONSE<void>> {
    await this.service.closeOneUserOrder(userId, exchangeId, body.symbol, orderId, body.virtual);
    return {
      statusCode: HttpStatus.OK,
      message: 'Started a job to close one user order',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancelVirtual/:exchangeId/:userId')
  async cancelVirtualUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: CancelVirtualOrdersBodyDto
  ): Promise<HTTP_RESPONSE<void>> {
    const { symbol } = body;

    await this.service.cancelVirtualUserOrders(userId, exchangeId, symbol);
    return {
      statusCode: HttpStatus.OK,
      message: 'Started a job to close orders',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancelReal/:exchangeId/:userId/:orderId')
  async cancelRealUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body(new ValidationPipe({ transform: true })) body: CancelVirtualOrdersBodyDto
  ): Promise<HTTP_RESPONSE<void>> {
    const { symbol } = body;

    await this.service.cancelVirtualUserOrders(userId, exchangeId, symbol);
    return {
      statusCode: HttpStatus.OK,
      message: 'Started a job to close orders',
    };
  }

  @Post('open/:exchangeId/:userId')
  async openUserOrder(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: OpenOrderBodyDto
  ): Promise<HTTP_RESPONSE<void>> {
    const { type, symbol, amount, virtual } = body;

    await this.service.openUserOrder(userId, exchangeId, symbol, type, virtual, amount);

    return {
      statusCode: HttpStatus.OK,
      message: `Started a job to open order ${userId} ${exchangeId} ${symbol} ${type} volume: ${amount}`,
    };
  }

  @Post('closeVirtual/:exchangeId')
  async closeAllVirtualOrders(@Param('exchangeId') exchangeId: string): Promise<HTTP_RESPONSE<void>> {
    await this.service.closeAllVirtualOrders(exchangeId);

    return {
      statusCode: HttpStatus.OK,
      message: `Started a job to close all virtual orders [${exchangeId}]`,
    };
  }

  @Delete('delete/:exchangeId/:userId/:orderId')
  async deleteUserOrder(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string,
    @Param('orderId') orderId: string
  ): Promise<HTTP_RESPONSE<void>> {
    await this.service.deleteUserOrder(userId, exchangeId, orderId);

    // todo: return an order deletion status
    return {
      statusCode: HttpStatus.OK,
      message: `Deleted trade order ID: ${orderId} of user: ${userId} exchange: ${exchangeId}`,
    };
  }

  @Delete('deleteAll/:exchangeId/:userId')
  async deleteAllUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string
  ): Promise<HTTP_RESPONSE<void>> {
    await this.service.deleteAllUserOrder(userId, exchangeId);

    // todo: return an order deletion status
    return {
      statusCode: HttpStatus.OK,
      message: `Deleted all trade orders of user: ${userId} exchange: ${exchangeId}`,
    };
  }

  @Delete('deleteVirtual/:exchangeId/:userId')
  async deleteAllVirtualUserOrders(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string
  ): Promise<HTTP_RESPONSE<void>> {
    const res = await this.service.deleteAllUserVirtualOrder(userId, exchangeId);

    // todo: return an order deletion status
    return {
      statusCode: HttpStatus.OK,
      message: res
        ? `Deleted all virtual orders [${exchangeId}] of user: ${userId}`
        : `No virtual orders [${exchangeId}] of user: ${userId}`,
    };
  }

  @Delete('deleteVirtual')
  async deleteAllVirtualOrders(): Promise<HTTP_RESPONSE<void>> {
    await this.service.deleteAllVirtualOrder();

    // todo: return an order deletion status
    return {
      statusCode: HttpStatus.OK,
      message: `Deleted all virtual orders`,
    };
  }
}
