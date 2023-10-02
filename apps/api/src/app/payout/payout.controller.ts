import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@cupo/backend/common';
import { PayoutService } from './payout.service';
import { JwtAuthGuard } from '../provider/jwt-auth.guard';
import {
  PAYOUT_PROFILE_STATUS,
  PAYOUT_PROFILE_TYPE,
  PayoutRequestStatus,
  Public,
  REST_API_RESPONSE_STATUS,
  ROLE,
} from '@cupo/backend/constant';
import { HTTP_RESPONSE, PayoutProfile } from '@cupo/backend/interface';

@ApiTags('payout', 'crm', 'app')
@Controller('payout')
export class PayoutController {
  constructor(private readonly service: PayoutService) {}

  @Get('/request')
  @Roles(ROLE.ADMIN)
  @ApiOperation({
    description: 'Get all last payout requests from the DB',
  })
  async getPayoutRequests(
    @Query('status') status?: PayoutRequestStatus,
    @Query('userId') userId?: string
  ): Promise<HTTP_RESPONSE<object[]>> {
    const requests = await this.service.getPayoutRequests({ status, userId });

    if (requests) {
      return {
        statusCode: HttpStatus.OK,
        length: requests.length,
        data: requests,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        message: 'No payout requests found',
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @Get('request/:userId')
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @ApiOperation({
    description: `Get user's last payout requests from the DB`,
  })
  async getUserPayoutRequests(
    @Param('userId') userId: string,
    @Query('status') status?: PayoutRequestStatus
  ): Promise<HTTP_RESPONSE<object[]>> {
    const requests = await this.service.getPayoutRequests({ status, userId });

    if (requests) {
      return {
        statusCode: HttpStatus.OK,
        length: requests.length,
        data: requests,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        message: 'No payout requests found',
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @Post('addPayoutRequest')
  @Public()
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @ApiOperation({
    description: `Add a new user's payout request`,
  })
  async addPayoutRequest(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; sum: number; comment?: string }
  ): Promise<HTTP_RESPONSE<object>> {
    const [error, message, data] = await this.service.addPayoutRequest(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        message,
        error,
      },
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  @Put('cancelPayoutRequest')
  @Public()
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @ApiOperation({
    description: `Cancel the user's payout request`,
  })
  async cancelPayoutRequest(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; requestId: string; comment?: string }
  ): Promise<HTTP_RESPONSE<object>> {
    const { userId, requestId, comment } = body;

    const [error, message] = await this.service.cancelPayoutRequest({ requestId, userId, comment });

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        message,
        error,
      },
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  @Delete('deletePayoutRequest/:requestId')
  @Roles(ROLE.ADMIN)
  @ApiOperation({
    description: `Delete the user's payout request`,
  })
  async deletePayoutRequest(@Param('requestId') requestId: string): Promise<HTTP_RESPONSE<object>> {
    const [error, message] = await this.service.deletePayoutRequest(requestId);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        message,
        error,
      },
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  @Put('changePayoutRequestStatus')
  @Public()
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  // @Roles(ROLE.ADMIN)
  @ApiOperation({
    description: `Change the status of the user's payout request.`,
  })
  async changePayoutRequestStatus(
    @Body(new ValidationPipe({ transform: true }))
    body: {
      userId: string;
      requestId: string;
      requestStatus: PayoutRequestStatus;
      comment?: string;
    }
  ): Promise<HTTP_RESPONSE<object>> {
    const { userId, requestId, requestStatus, comment } = body;

    const [error, message] = await this.service.changePayoutRequestStatus({
      requestId,
      userId,
      requestStatus,
      comment,
    });

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        message,
        error,
      },
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  //***********************
  //*** PAYOUT PROFILE ***
  //***********************

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.NEUTRAL)
  @Get('payoutProfile/:userId')
  @ApiOperation({
    description: `Get payout profile`,
    parameters: [{ name: 'userId', in: 'path', schema: { type: 'string' } }],
  })
  @ApiOkResponse({ description: 'User profiles have got', type: Array<PayoutProfile> })
  async getUserPayoutProfile(@Param('userId') userId: string): Promise<HTTP_RESPONSE<PayoutProfile[]>> {
    const [error, message, response] = await this.service.getUserPayoutProfile(userId);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: response,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        ...(response ? { data: response } : { data: undefined }),
        message,
        error,
      } as HTTP_RESPONSE<{ userId?: string; status?: PAYOUT_PROFILE_STATUS }>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Post('payoutProfile')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @ApiOperation({
    description: `Add a payout profile`,
  })
  @ApiOkResponse({ description: 'Profile changed', type: PayoutProfile })
  async addPayoutProfile(
    @Body(new ValidationPipe({ transform: true }))
    body: {
      userId: string;
      type: PAYOUT_PROFILE_TYPE;
      description?: string;
      comment?: string;
      firstName?: string;
      lastName?: string;
      paypalEmail?: string;
      phone?: string;
    }
  ): Promise<HTTP_RESPONSE<PayoutProfile>> {
    const [error, message, response] = await this.service.addPayoutProfile(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: response,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error,
      },
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Put('payoutProfile')
  @ApiOperation({
    description: `Change payout profile`,
  })
  @ApiOkResponse({ description: 'Profile changed', type: PayoutProfile })
  async changePayoutProfile(
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true }))
    body: {
      userId: string;
      profileId: string;
      description?: string;
      firstName?: string;
      lastName?: string;
      paypalEmail?: string;
      phone?: string;
      status: PAYOUT_PROFILE_STATUS;
      comment?: string;
    }
  ): Promise<HTTP_RESPONSE<PayoutProfile>> {
    if (req['user']?.id !== body.userId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'You can only change your own profile',
          error: REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const [error, message, response] = await this.service.changePayoutProfile(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: response,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error,
      },
      HttpStatus.BAD_REQUEST
    );
  }
}
