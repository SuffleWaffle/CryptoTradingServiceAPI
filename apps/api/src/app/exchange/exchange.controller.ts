import { Controller, Get, HttpException, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ExchangeService } from './exchange.service';
import { GetMarketQueryDto, GetMarketsQueryDto } from './exchange.dto';
import { REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { MarketsType } from '@cupo/backend/interface';
import { HTTP_RESPONSE, Markets_HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';

@ApiTags('trader', 'exchange')
@ApiSecurity('bearer')
@Controller('exchange')
export class ExchangeController {
  constructor(private readonly service: ExchangeService) {}

  @Get('list')
  @ApiOperation({
    description: 'Get the list of supported exchanges',
  })
  async getExchangesList(): Promise<HTTP_RESPONSE<string[]>> {
    const list = await this.service.getExchangesList();
    return {
      length: list && list.length,
      data: list,
      statusCode: HttpStatus.OK,
    };
  }

  @Get('currencies/:exchangeId')
  @ApiOperation({
    description: 'Get the list of supported currencies on the exchange',
    parameters: [
      { name: 'exchangeId', in: 'query', schema: { type: 'string' } },
      { name: 'supportedOnly', in: 'query', schema: { type: 'boolean' } },
    ],
  })
  async getCurrencies(
    @Param('exchangeId') exchangeId: string,
    @Query() query: { supportedOnly?: string }
  ): Promise<HTTP_RESPONSE<string[]>> {
    const { supportedOnly } = query;

    const currencies = await this.service.getCurrencyIds(exchangeId, supportedOnly !== 'false');

    if (!currencies?.length) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NO_CONTENT,
          message: `There are no currencies for [${exchangeId}]`,
          error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NO_CONTENT
      );
    }

    return {
      length: currencies.length,
      data: currencies,
      statusCode: HttpStatus.OK,
    };
  }

  @Get('symbols/:exchangeId')
  @ApiOperation({
    description: 'Get the list of supported symbols on the exchange',
    parameters: [
      { name: 'exchangeId', in: 'query', schema: { type: 'string' } },
      { name: 'supportedOnly', in: 'query', schema: { type: 'boolean' } },
    ],
  })
  async getSymbols(
    @Param('exchangeId') exchangeId: string,
    @Query() query: { supportedOnly?: string }
  ): Promise<HTTP_RESPONSE<string[]>> {
    const { supportedOnly } = query;

    const symbols = await this.service.getSymbols(exchangeId, supportedOnly !== 'false');

    if (!symbols?.length) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NO_CONTENT,
          message: `There are no symbols for ${exchangeId}. Fetching... Try again later.`,
          error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NO_CONTENT
      );
    }

    const urls = {};
    symbols.forEach((symbol) => {
      urls[symbol.symbol] = symbol.coinUrl;
    });

    return {
      length: symbols?.length,
      data: symbols.map((symbol) => symbol.symbol),
      urls,
      statusCode: HttpStatus.OK,
    };
  }

  @Get('markets/:exchangeId')
  @ApiOperation({
    description: 'Get the list of supported markets on the exchange',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'baseCurrency', in: 'query', schema: { type: 'string' } },
    ],
  })
  async getMarkets(
    @Param('exchangeId') exchangeId: string,
    @Query() query: GetMarketsQueryDto
  ): Promise<Markets_HTTP_RESPONSE> {
    const markets: MarketsType = await this.service.getMarkets(exchangeId, query?.baseCurrency);

    if (!markets || !Object.keys(markets).length) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NO_CONTENT,
          message: `There are no markets for ${exchangeId}`,
          error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NO_CONTENT
      );
    }

    return {
      statusCode: HttpStatus.OK,
      length: Object.keys(markets).length,
      data: markets,
    };
  }

  @Get('market/:exchangeId')
  @ApiOperation({
    description: 'Get the certain market by it`s symbol name on the exchange',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string' } },
    ],
  })
  async getMarket(
    @Param('exchangeId') exchangeId: string,
    @Query() query: GetMarketQueryDto
  ): Promise<Markets_HTTP_RESPONSE> {
    if (!exchangeId || !query || !query.symbol) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Missing "exchangeId" or "symbol" query parameter',
          error: REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED,
        } as HTTP_RESPONSE<void>,
        HttpStatus.BAD_REQUEST
      );
    }

    const market = await this.service.getMarket(exchangeId, query.symbol);

    if (!market) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NO_CONTENT,
          message: `There are no market ${query.symbol} for ${exchangeId}. Fetching... Try again later.`,
          error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NO_CONTENT
      );
    }

    return {
      data: {
        [market.symbol]: market,
      },
      statusCode: HttpStatus.OK,
    };
  }
}
