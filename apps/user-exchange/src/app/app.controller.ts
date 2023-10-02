import { Body, Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';

import { AppService } from './app.service';
import { HTTP_RESPONSE, TradeOrder } from '@cupo/backend/interface';
import { REST_API_RESPONSE_STATUS, USER_EXCHANGE_STATUS } from '@cupo/backend/constant';
import { TIMEFRAME } from '@cupo/timeseries';
import { Dictionary } from 'ccxt';

@Controller()
export class AppController {
  constructor(private readonly service: AppService) {}

  @Get()
  getData() {
    return this.service.getData();
  }

  @Post('setUserExchange')
  setUserExchange(@Body('userId') userId: string, @Body('userExchange') userExchange: string) {
    // return this.appService.setUserExchange(userExchange);
    console.log('userExchange', userExchange);
  }

  @Post('closeOrder')
  async closeOrder(@Body() order: TradeOrder): Promise<HTTP_RESPONSE<any>> {
    const [error, message, result] = await this.service.closeOrder(order);

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

  @Post('openBuy')
  async openBuy(@Body() order: TradeOrder): Promise<HTTP_RESPONSE<any>> {
    const [error, message, result] = await this.service.openBuy(order);

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

  @Post('openSell')
  async openSell(@Body() order: TradeOrder): Promise<HTTP_RESPONSE<any>> {
    const [error, message, result] = await this.service.openSell(order);

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

  @Post('getWalletBalances')
  async getWalletBalances(
    @Body() body: { userId: string; exchangeId: string; status?: USER_EXCHANGE_STATUS }
  ): Promise<HTTP_RESPONSE<any>> {
    const [error, message, result] = await this.service.getWalletBalances(body);

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

  @Post('fetchCandles')
  async fetchCandles(
    @Body()
    body: {
      exchangeId: string;
      symbol: string;
      timeframe: TIMEFRAME; // 1m, 1h, 1d
      since?: number;
      limit?: number;
    }
  ): Promise<HTTP_RESPONSE<any>> {
    const [error, message, result] = await this.service.fetchCandles({
      ...body,
      since: body.since ? +body.since : undefined,
      limit: body.limit ? +body.limit : undefined,
    });

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

  @Post('fetchMarkets')
  async fetchMarkets(
    @Body()
    body: {
      exchangeId: string;
      baseOnly: boolean;
      activeOnly: boolean;
      spotOnly: boolean;
    }
  ): Promise<HTTP_RESPONSE<any>> {
    const [error, message, result] = await this.service.fetchMarkets({
      ...body,
      baseOnly: typeof body.baseOnly === 'string' ? body.baseOnly === 'true' : body.baseOnly,
      activeOnly: typeof body.activeOnly === 'string' ? body.activeOnly === 'true' : body.activeOnly,
      spotOnly: typeof body.spotOnly === 'string' ? body.spotOnly === 'true' : body.spotOnly,
    });

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

  @Post('getTimeframes')
  async getTimeframes(@Body() body: { exchangeId: string }): Promise<HTTP_RESPONSE<Dictionary<number | string>>> {
    const [error, message, result] = await this.service.getTimeframes(body?.exchangeId);

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
}
