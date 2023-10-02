import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from '@cupo/backend/common';
import { LocalAuthGuard } from '../provider/local-auth.guard';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../provider/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { Public, REST_API_RESPONSE_STATUS, ROLE, USER_ROLES } from '@cupo/backend/constant';
import { ChangeUsersDto, DEVICE_TYPE, User, UserSnapshotResponse } from '@cupo/backend/interface';
import { HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('testAdmin')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  async testAdmin(@Request() req): Promise<HTTP_RESPONSE<User>> {
    return {
      statusCode: HttpStatus.OK,
      data: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.CUSTOMER)
  @Get('testClient')
  async testClient(@Request() req): Promise<HTTP_RESPONSE<User>> {
    return {
      statusCode: HttpStatus.OK,
      data: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Get('testBoth')
  async testBoth(@Request() req): Promise<HTTP_RESPONSE<User>> {
    return {
      statusCode: HttpStatus.OK,
      data: req.user,
    };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Request() req,
    @Body(new ValidationPipe({ transform: true }))
    body: { email: string; password: string; deviceType: DEVICE_TYPE; role: USER_ROLES }
  ): Promise<HTTP_RESPONSE<(UserSnapshotResponse | User) & { access_token: string }>> {
    const [error, message, response] = await this.service.login(
      {
        ...body,
        role: body?.role || USER_ROLES.CUSTOMER,
      },
      req.user
    );

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
      } as HTTP_RESPONSE<UserSnapshotResponse & { access_token: string }>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @UsePipes(new ValidationPipe({ transform: true }))
  async logout(@Request() req, @Body() body: { email: string; deviceType: DEVICE_TYPE }): Promise<HTTP_RESPONSE<void>> {
    const [error, message] = await this.service.logout(body, req.user);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
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
  @Post('register')
  async register(
    @Body(new ValidationPipe({ transform: true }))
    body: {
      email: string;
      password: string;
      name?: string;
      refId?: string;
      deviceType: DEVICE_TYPE;
      role: USER_ROLES;
    }
  ): Promise<HTTP_RESPONSE<(UserSnapshotResponse | User) & { access_token?: string }>> {
    const [error, message, response] = await this.service.register({
      ...body,
      role: body?.role || USER_ROLES.CUSTOMER,
    });

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
      } as HTTP_RESPONSE<UserSnapshotResponse & { access_token?: string }>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Public()
  @Delete('removeEmailVerification/:userId')
  async removeEmailVerification(@Param('userId') userId: string): Promise<HTTP_RESPONSE<void>> {
    const [error, message] = await this.service.removeEmailVerification(userId);

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

  // Set the email verified property into the user card
  // It is necessary after the user registration
  @Public()
  @Post('emailVerified')
  async emailVerified(
    @Body(new ValidationPipe({ transform: true }))
    body: {
      email: string;
      otpCode: string;
      deviceType: DEVICE_TYPE;
      role: USER_ROLES;
    }
  ): Promise<HTTP_RESPONSE<(UserSnapshotResponse | User) & { access_token: string }>> {
    const [error, message, response] = await this.service.emailVerified({
      ...body,
      role: body?.role || USER_ROLES.CUSTOMER,
    });

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
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Post('adminApproved')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true }))
  async adminApproved(@Body() body: ChangeUsersDto): Promise<HTTP_RESPONSE<User & { access_token: string }>> {
    const [error, message, response] = await this.service.adminApproved(body);

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
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @Post('manageOrdersApproved')
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @UsePipes(new ValidationPipe({ transform: true }))
  async manageOrdersApproved(@Body() body: ChangeUsersDto): Promise<HTTP_RESPONSE<User>> {
    const [error, message, response] = await this.service.manageOrdersApproved(body);

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
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  // Restore password.
  // It needs to send:
  // * email
  // * new password
  // * OTP code from email
  @Public()
  @Post('restorePassword')
  async restorePassword(
    @Body(new ValidationPipe({ transform: true })) body: { email: string; newPassword: string; otpCode: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.restorePassword(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
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

  // Change user password.
  // It needs to send:
  //   userId
  // new password
  // old password
  @Public()
  @Post('changePassword')
  async changePassword(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string; newPassword: string; oldPassword: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.changePassword(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
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
