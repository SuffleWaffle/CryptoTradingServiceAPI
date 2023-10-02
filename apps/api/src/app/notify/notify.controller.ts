import { Body, Controller, HttpException, HttpStatus, Post, ValidationPipe } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { ApiTags } from '@nestjs/swagger';
import { Public, REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';

@ApiTags('notification')
@Controller('notify')
export class NotifyController {
  constructor(private readonly service: NotifyService) {}

  // Send an OTP code for verification user email
  // It is necessary after the user registration
  @Public()
  @Post('emailVerification')
  async emailVerification(
    @Body(new ValidationPipe({ transform: true })) body: { email: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.sendEmailVerification(body.email);

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
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  // Send an OTP code for verification user email.
  // It is necessary during the restoring user password process.
  @Public()
  @Post('passwordVerification')
  async passwordVerification(
    @Body(new ValidationPipe({ transform: true })) body: { email: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.sendPasswordVerification(body.email);

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
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  // Send an OTP code for verification user email.
  // It is necessary after the user registration.
  @Public()
  @Post('deleteAccountVerification')
  async deleteAccountVerification(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.sendDeleteAccountVerification(body.userId);

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
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  @Public()
  @Post('subscriptionBillingCompleted')
  async subscriptionBillingCompleted(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; billingDays: number }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.subscriptionBillingCompleted(body.userId, body.billingDays.toString());

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Public()
  @Post('replenishmentMainBalance')
  async replenishmentMainBalance(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; billingSumm: number }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.replenishmentMainBalance(body.userId, body.billingSumm.toString());

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Public()
  @Post('withdrawalMainBalance')
  async withdrawalMainBalance(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; billingSumm: number }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.withdrawalMainBalance(body.userId, body.billingSumm.toString());

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Public()
  @Post('subscriptionEnded')
  async subscriptionEnded(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.subscriptionEnded(body.userId);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Public()
  @Post('subscriptionEnding')
  async subscriptionEnding(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.subscriptionEnding(body.userId);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }
}
