import { Roles } from '@cupo/backend/common';
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
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../provider/jwt-auth.guard';
import { PaymentRequestStatus, Public, REST_API_RESPONSE_STATUS, ROLE } from '@cupo/backend/constant';
import { HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';

@ApiTags('payment', 'crm', 'app')
@Controller('payment')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Public()
  @Post('paypalEvent')
  async savePaypalEvent(
    @Body(new ValidationPipe({ transform: true })) body: { email: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message, document] = await this.service.savePaypalEvent(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        data: document,
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        message,
        error,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Get('paypalEvents')
  @ApiOperation({
    description: 'Get last PayPal events from the DB',
  })
  async getPayPalEvents(): Promise<HTTP_RESPONSE<object[]>> {
    const events = await this.service.getPayPalEvents();

    if (events) {
      return {
        statusCode: HttpStatus.OK,
        length: events.length,
        data: events,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.RESPONSE_EMPTY,
        message: 'No PayPal events found',
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Get('/list')
  @ApiOperation({
    description: 'Get last payments list from all users',
  })
  async getAllPaymentsList(
    @Query('status') status?: PaymentRequestStatus,
    @Query('userId') userId?: string
  ): Promise<HTTP_RESPONSE<object[]>> {
    const requests = await this.service.getAllPaymentsList({ status, userId });

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
        message: 'No payments found',
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Get('list/:userId')
  @ApiOperation({
    description: `Get last user's payments`,
  })
  async getUserPaymentsList(
    @Param('userId') userId: string,
    @Query('status') status?: PaymentRequestStatus
  ): Promise<HTTP_RESPONSE<object[]>> {
    const requests = await this.service.getAllPaymentsList({ status, userId });

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
        message: 'No payments found',
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Post('addPayment')
  @ApiOperation({
    description: `Add a new user's payment request`,
  })
  async addPaymentRequest(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; sum: number; comment?: string; payload: any }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message, data] = await this.service.addPaymentRequest(body);

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

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Put('cancelPaymentRequest')
  @ApiOperation({
    description: `Cancel the user's payment request`,
  })
  async cancelPaymentRequest(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; requestId: string; comment?: string }
  ): Promise<HTTP_RESPONSE<object>> {
    const { userId, requestId, comment } = body;

    const [error, message] = await this.service.cancelPaymentRequest({ requestId, userId, comment });

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

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Delete('deletePaymentRequest/:requestId')
  @ApiOperation({
    description: `Delete the user's payment request`,
  })
  async deletePaymentRequest(@Param('requestId') requestId: string): Promise<HTTP_RESPONSE<object>> {
    const [error, message] = await this.service.deletePaymentRequest(requestId);

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

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Put('changePaymentRequestStatus')
  @ApiOperation({
    description: `Change the status of the user's payment request`,
  })
  async changePaymentRequestStatus(
    @Body(new ValidationPipe({ transform: true }))
    body: {
      userId: string;
      requestId: string;
      requestStatus: PaymentRequestStatus;
      comment?: string;
    }
  ): Promise<HTTP_RESPONSE<object>> {
    const { userId, requestId, requestStatus, comment } = body;

    const [error, message] = await this.service.changePaymentRequestStatus({
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
}
