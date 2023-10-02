import { Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Job } from 'bull';
import { IndicatorService } from './indicator.service';
import { GetIndicatorValuesQueryDto } from './indicator.dto';
import { CalculateIndicatorsParams, IndicatorsValues } from '@cupo/indicators';
import {
  HTTP_RESPONSE,
  IndicatorsList_HTTP_RESPONSE,
  IndicatorsValues_HTTP_RESPONSE,
} from '@cupo/backend/interface/src/lib/rest-api.interface';

@ApiTags('trader', 'indicator')
@Controller('indicator')
export class IndicatorController {
  constructor(private readonly indicatorService: IndicatorService) {}

  @Get('list')
  @ApiOperation({
    description: 'Get list of supported indicators',
  })
  async getIndicatorsList(): Promise<IndicatorsList_HTTP_RESPONSE> {
    return {
      data: await this.indicatorService.getIndicatorsList(),
      statusCode: HttpStatus.OK,
    };
  }

  @Get('all/:exchangeId')
  @ApiOperation({
    description: 'Get the values of the indicators for the given symbol and exchange and timeframe',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string' } },
      { name: 'timeframe', in: 'query', schema: { type: 'string' } },
      { name: 'indexId', in: 'query', schema: { type: 'string' } },
      { name: 'limit', in: 'query', schema: { type: 'number' } },
    ],
  })
  async getAllIndicatorsValues(
    @Param('exchangeId') exchangeId: string,
    @Query() query: GetIndicatorValuesQueryDto
  ): Promise<IndicatorsValues_HTTP_RESPONSE> {
    const { symbol, timeframe, limit, indexId } = query;

    if (!exchangeId || !symbol || !timeframe) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad parameters list in the request',
      };
    }

    const values: IndicatorsValues[] = await this.indicatorService.getIndicatorsValues(
      exchangeId,
      symbol,
      timeframe,
      indexId,
      limit
    );

    if (!values || values.length === 0) {
      return {
        statusCode: HttpStatus.NO_CONTENT,
        message: 'No values found. Please try again later. Calculating...',
      };
    }

    return {
      length: values.length,
      data: values,
      statusCode: HttpStatus.OK,
    };
  }

  @Post('updateAll/:exchangeId')
  @ApiOperation({
    description: 'Start calculation of the values of the indicators for the given symbol and exchange and timeframe',
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'symbol', in: 'query', schema: { type: 'string' } },
      { name: 'timeframe', in: 'query', schema: { type: 'string' } },
      { name: 'indexId', in: 'query', schema: { type: 'string' } },
      { name: 'limit', in: 'query', schema: { type: 'number' } },
    ],
  })
  async updateAllIndicatorsValues(
    @Param('exchangeId') exchangeId: string,
    @Query() query: GetIndicatorValuesQueryDto
  ): Promise<HTTP_RESPONSE<Job<CalculateIndicatorsParams>>> {
    const { symbol, timeframe, limit, indexId } = query;

    if (!exchangeId || !symbol || !timeframe) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad parameters list in the request',
      };
    }

    return {
      data: await this.indicatorService.recalculateIndicatorsValues(exchangeId, symbol, timeframe, indexId, limit),
      statusCode: HttpStatus.OK,
    };
  }
}
