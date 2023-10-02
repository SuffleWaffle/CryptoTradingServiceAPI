import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CandleObject, HumanCandleObject } from '@cupo/timeseries';
import {
  FetchCandlesBodyDto,
  GetCandleQueryDto,
  GetCandlesQueryDto,
  GetTickerQueryDto,
  GetTickersQueryDto,
} from './tickers.dto';
import { TickersService } from './tickers.service';
import { REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { TickersType } from '@cupo/backend/interface';
import {
  Candle_HTTP_RESPONSE,
  Candles_HTTP_RESPONSE,
  HTTP_RESPONSE,
  Tickers_HTTP_RESPONSE,
} from '@cupo/backend/interface/src/lib/rest-api.interface';

@ApiTags('trader', 'tickers')
@ApiTags('tickers')
@Controller('tickers')
export class TickersController {
  timeframes: string[] = ['1m', '5m', '15m', '30m', '1h', '2h', '4h'];

  constructor(private readonly tickerService: TickersService) {}

  @Get('timeframes')
  @ApiOperation({
    description: 'Get timeframes list',
  })
  async getTimeframesList() {
    return this.timeframes;
  }

  @Post('fetchCandles')
  @ApiOperation({
    description: 'Start a job to fetch candles of the timeframe and the symbol',
  })
  async fetchCandles(@Body() fetchCandle: FetchCandlesBodyDto): Promise<HTTP_RESPONSE<any>> {
    const result = await this.tickerService.fetchCandles({ ...fetchCandle, force: true }).catch((e) => {
      Logger.error(`fetchCandles error ${e.message}`);

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `fetchCandles error ${e.message}`,
          error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
        } as HTTP_RESPONSE<void>,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    });

    if (typeof result === 'string') {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: result,
          error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
        } as HTTP_RESPONSE<void>,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: result.toString(),
    };
  }

  @Get('list/:exchangeId')
  @ApiOperation({
    description: 'Get the list of tickers from the exchange',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'baseCurrencies', in: 'query', schema: { type: 'string[]' } },
    ],
  })
  async getTickers(
    @Param('exchangeId') exchangeId: string,
    @Query(new ValidationPipe({ transform: true })) query: GetTickersQueryDto
  ): Promise<Tickers_HTTP_RESPONSE> {
    if (!exchangeId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'exchangeId is not defined in the request',
      };
    }

    const tickers: TickersType = await this.tickerService.getTickers(
      exchangeId,
      query && query.baseCurrencies ? query.baseCurrencies : undefined
    );
    if (!tickers || !Object.keys(tickers).length) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NO_CONTENT,
          message: `There are no tickers [${exchangeId}]. Fetching... Try again later.`,
          error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NO_CONTENT
      );
    }

    return {
      statusCode: HttpStatus.OK,
      data: tickers,
    };
  }

  @Get('ticker/:exchangeId')
  @ApiOperation({
    description: 'Get the certain ticker by it`s symbol name on the exchange',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'path', schema: { type: 'string' } },
    ],
  })
  async getTicker(
    @Param('exchangeId') exchangeId: string,
    @Query() query: GetTickerQueryDto
  ): Promise<Tickers_HTTP_RESPONSE> {
    const ticker: TickersType = await this.tickerService.getTicker(
      exchangeId,
      query && query.symbol ? query.symbol : undefined
    );

    if (!ticker?.[query.symbol]) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NO_CONTENT,
          message: `There are no tickers [${exchangeId}]. Fetching... Try again later.`,
          error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NO_CONTENT
      );
    }

    return {
      statusCode: HttpStatus.OK,
      data: ticker,
    };
  }

  @Get('candles/:exchangeId')
  @ApiOperation({
    description: 'Get candles of the symbol and timeframe on the exchange',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string' } },
      { name: 'timeframe', in: 'query', schema: { type: 'string' } },
    ],
  })
  async getCandles(
    @Param('exchangeId') exchangeId: string,
    @Query() query: GetCandlesQueryDto
  ): Promise<Candles_HTTP_RESPONSE> {
    const { symbol, timeframe } = query;

    if (!exchangeId || !symbol || !timeframe) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Bad parameters list in the request',
          error: REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED,
        } as HTTP_RESPONSE<void>,
        HttpStatus.BAD_REQUEST
      );
    }

    const candles: HumanCandleObject[] = await this.tickerService.getCandles(exchangeId, symbol, timeframe);

    return {
      length: candles && candles.length,
      data: candles,
      statusCode: HttpStatus.OK,
    };
  }

  @Get('candle/:exchangeId')
  @ApiOperation({
    description: 'Get candle of the symbol and timeframe and timestamp on the exchange',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string' } },
      { name: 'timeframe', in: 'query', schema: { type: 'string' } },
      { name: 'timestamp', in: 'query', schema: { type: 'number' } },
    ],
  })
  async getCandle(
    @Param('exchangeId') exchangeId: string,
    @Query() query: GetCandleQueryDto
  ): Promise<Candle_HTTP_RESPONSE> {
    if (!exchangeId || !query || !query.symbol || !query.timeframe) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Bad parameters list in the request',
          error: REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED,
        } as HTTP_RESPONSE<void>,
        HttpStatus.BAD_REQUEST
      );
    }

    const candle: CandleObject = await this.tickerService.getCandle(
      exchangeId,
      query && query.symbol ? query.symbol : undefined,
      query && query.timeframe ? query.timeframe : undefined,
      query && query.timestamp ? +query.timestamp : undefined
    );

    return {
      data: candle,
      statusCode: HttpStatus.OK,
    };
  }
}
