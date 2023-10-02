import { Body, Controller, Get, HttpException, HttpStatus, Post, Version, VERSION_NEUTRAL } from '@nestjs/common';

import { AppService } from './app.service';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ValidateRecaptcha } from './app.controller.dto';
import { Public, REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get(['/', 'health-api'])
  getData(): HTTP_RESPONSE<void> {
    return this.appService.getData();
  }

  @Public()
  @Get('health-feeder')
  async getHealthInfoFromFeeder(): Promise<HTTP_RESPONSE<string>> {
    return this.appService.getHealthInfoFromFeeder();
  }

  @Public()
  @Version(['2'])
  @ApiOperation({
    description: `Trader server health check (v2)`,
  })
  @Get('health-trader')
  async getHealthInfoFromTraderV2(): Promise<HTTP_RESPONSE<string>> {
    return this.appService.getHealthInfoFromTrader('version 2');
  }

  @Public()
  @Version(VERSION_NEUTRAL)
  @ApiOperation({
    description: `Trader server health check (v1)`,
  })
  @Get('health-trader')
  async getHealthInfoFromTrader(): Promise<HTTP_RESPONSE<string>> {
    return this.appService.getHealthInfoFromTrader('version 1');
  }

  @Public()
  @Get('health-ticker')
  async getHealthInfoFromTicker(): Promise<HTTP_RESPONSE<string>> {
    return this.appService.getHealthInfoFromTicker();
  }

  @Public()
  @Get('health-exchange')
  async getHealthInfoFromExchange(): Promise<HTTP_RESPONSE<string>> {
    return this.appService.getHealthInfoFromExchange();
  }

  @Public()
  @Post('ticker/haltAndCatchFire')
  @ApiOperation({
    description: `Ticker: Halt Ticker`,
  })
  @ApiOkResponse({ description: 'Reboot success', type: String })
  @ApiUnauthorizedResponse({ description: 'Invalid login data' })
  async haltTickerApp(): Promise<HTTP_RESPONSE<string>> {
    return this.appService.haltTickerApp();
  }

  @Public()
  @Post('/validate/recaptcha')
  @ApiOperation({
    description: `Validate Google Recaptcha`,
  })
  @ApiBody({
    type: ValidateRecaptcha,
    examples: {
      token: {
        summary: 'payload',
        description: 'google captcha token',
        value: {
          token: '03AEkXODAtOzxN52L8bdrSGL63q3FuD3ympUnp6fUby_TUi6Cht4poqWNdgDLpAiRtjCZf_2_vk6ymnHA8MVUDDBxW',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Validate success',
    type: HTTP_RESPONSE,
    content: {
      'application/json': {
        schema: {
          example: {
            statusCode: HttpStatus.OK,
            data: true,
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid validation',
    status: HttpStatus.BAD_REQUEST,
    content: {
      'application/json': {
        schema: {
          example: {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'RECAPTCHA_VALIDATION_ERROR',
            message: 'Recaptcha validation failed',
          },
        },
      },
    },
  })
  async validateRecaptcha(@Body('token') token: string): Promise<HTTP_RESPONSE<boolean>> {
    const result = await this.appService.validateRecaptcha(token);

    if (result) {
      return {
        statusCode: HttpStatus.OK,
        data: result,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: REST_API_RESPONSE_STATUS.RECAPTCHA_VALIDATION_ERROR,
        message: `Recaptcha validation failed`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }
}
