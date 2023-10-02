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
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Version,
  VERSION_NEUTRAL
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Roles } from "@cupo/backend/common";
import {
  ChangeUserExchangeSymbolBodyDto,
  ChangeUserFavoriteSymbolBodyDto,
  ChangeUsersDto,
  ClearUserExchangeSymbolBodyDto,
  ClearUserFavoriteSymbolBodyDto,
  ContinueUserAccountSubscriptionBodyDto,
  ContinueUserAccountSubscriptionV2BodyDto,
  Coupon,
  ExchangeConfig,
  GetAllAccountBalancesDto,
  GetAllUsersDto,
  GetUsersQueryDto,
  HTTP_RESPONSE,
  ProxyInterface,
  ReferralReward,
  UpdateUserExchangeKeysBodyDto,
  User,
  UserAccountBalance,
  UserAccountChangeBalanceBodyDto,
  UserBodyDto,
  UserProxy,
  UserProxyInterface,
  UserReferral,
  UserReferralsResponse,
  UserSnapshotResponse,
  UserSubscriptionAutoRenewBodyDto,
  UserWalletBalances
} from "@cupo/backend/interface";
import {
  EnabledProductInterface,
  getAllProducts,
  Public,
  REST_API_RESPONSE_STATUS,
  ROLE
} from "@cupo/backend/constant";
import { JwtAuthGuard } from "../provider/jwt-auth.guard";
import { UserService } from "./user.service";
import { CouponService } from "./coupon.service";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const icons = require('../crypto-icons.json');

@ApiTags('trader', 'user', 'crm', 'app')
@ApiSecurity('bearer')
@Controller('user')
export class UserController {
  constructor(private readonly service: UserService, private readonly coupon: CouponService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Get('/')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get all users info`,
    parameters: [{ name: 'active', in: 'query', schema: { type: 'boolean', nullable: true } }],
  })
  async getUsers(
    @Query(new ValidationPipe({ transform: true })) query: GetUsersQueryDto
  ): Promise<HTTP_RESPONSE<User[]>> {
    const { active } = query;

    const users = await this.service.getUsers(active);

    if (users) {
      return {
        statusCode: HttpStatus.OK,
        length: users?.length,
        data: users,
      };
    } else {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: REST_API_RESPONSE_STATUS.USER_NOT_FOUND,
          message: `Users not found`,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Get('list')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAllUsers(@Query() query: GetAllUsersDto): Promise<HTTP_RESPONSE<User[]>> {
    const { totalItems, users } = await this.service.getAllUsers(query);

    if (users) {
      return {
        statusCode: HttpStatus.OK,
        length: users.length,
        totalItems,
        page: query.page,
        itemsPerPage: query.itemsPerPage,
        data: users,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
        message: `Internal error`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @Public()
  @Get(':userId')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get the user info`,
    parameters: [{ name: 'userId', in: 'path', schema: { type: 'string' } }],
  })
  async getUser(@Param('userId') userId: string): Promise<HTTP_RESPONSE<User | void>> {
    const user = await this.service.getUser(userId);

    if (user) {
      return {
        statusCode: HttpStatus.OK,
        data: user,
      };
    } else {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: REST_API_RESPONSE_STATUS.USER_NOT_FOUND,
          message: `User [${userId}] not found`,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':userId')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Delete the user info`,
    parameters: [{ name: 'userId', in: 'path', schema: { type: 'string' } }],
  })
  async deleteUser(
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: { otpCode: string }
  ): Promise<HTTP_RESPONSE<User | void>> {
    const [error, message, user] = await this.service.deleteUser(userId, body.otpCode);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: user,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        ...(user ? { data: user } : { data: undefined }),
        message,
        error,
      } as HTTP_RESPONSE<User>,
      HttpStatus.NOT_IMPLEMENTED
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/')
  @ApiOperation({
    description: `Add a new user`,
  })
  async addNewUser(@Body(new ValidationPipe({ transform: true })) body: UserBodyDto): Promise<HTTP_RESPONSE<User>> {
    const user = await this.service.addNewUser(body);

    if (typeof user === 'object') {
      return {
        statusCode: HttpStatus.OK,
        data: user,
      };
    } else {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_ACCEPTABLE,
          message: user,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NOT_ACCEPTABLE
      );
    }
  }

  @Public()
  @UseGuards(JwtAuthGuard)
  @Put('/')
  @ApiOperation({
    description: `Update the user`,
  })
  async updateUser(@Body(new ValidationPipe({ transform: true })) body: UserBodyDto): Promise<HTTP_RESPONSE<User>> {
    const user = await this.service.updateUser(body);

    if (typeof user === 'object') {
      return {
        statusCode: HttpStatus.OK,
        data: user,
      };
    } else {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_ACCEPTABLE,
          error: REST_API_RESPONSE_STATUS.USER_NOT_UPDATED,
          message: user,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NOT_ACCEPTABLE
      );
    }
  }

  //************************
  //*** FAVORITE SYMBOLS ***
  //************************

  @UseGuards(JwtAuthGuard)
  @Put('/addFavoriteSymbols')
  @ApiOperation({
    description: `Add user's favorite symbols`,
  })
  async addFavoriteSymbols(
    @Body(new ValidationPipe({ transform: true })) body: ChangeUserFavoriteSymbolBodyDto
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.addFavoriteSymbols(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Put('/deleteFavoriteSymbols')
  @ApiOperation({
    description: `Delete user's favorite symbols`,
  })
  async deleteFavoriteSymbols(
    @Body(new ValidationPipe({ transform: true })) body: ChangeUserFavoriteSymbolBodyDto
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.deleteFavoriteSymbols(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Put('/clearFavoriteSymbols')
  @ApiOperation({
    description: `Clear user's favorite symbols`,
  })
  async clearFavoriteSymbols(
    @Body(new ValidationPipe({ transform: true })) body: ClearUserFavoriteSymbolBodyDto
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.clearFavoriteSymbols(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Get('/favoriteSymbols/:exchangeId/:userId')
  @ApiOperation({
    description: `Get user's favorite symbols`,
  })
  async getFavoriteSymbols(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.getFavoriteSymbols({ userId, exchangeId });

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  //************************
  //*** EXCHANGE KEYS ***
  //************************

  @UseGuards(JwtAuthGuard)
  @Get('/getExchanges/:userId')
  @ApiOperation({
    description: `Get user's exchanges settings`,
  })
  async getExchanges(@Param('userId') userId: string): Promise<HTTP_RESPONSE<ExchangeConfig[]>> {
    const [error, message, exchanges] = await this.service.getExchanges(userId);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: exchanges,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Get('/exchange/getProxyList/:exchangeId')
  @ApiOperation({
    description: `Get the list of proxy servers for the exchange`,
  })
  async getProxyList(@Param('exchangeId') exchangeId: string): Promise<HTTP_RESPONSE<ProxyInterface[]>> {
    const [error, message, proxies] = await this.service.getExchangeProxyList(exchangeId);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        length: proxies.length,
        data: proxies,
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
  @Get('/exchange/getAllProxyList')
  @ApiOperation({
    description: `Get the list of all proxy servers`,
  })
  async getAllProxyList(): Promise<HTTP_RESPONSE<ProxyInterface[]>> {
    const [error, message, proxies] = await this.service.getAllProxyList();

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        length: proxies.length,
        data: proxies,
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
  @Roles(ROLE.ADMIN)
  @Post('exchange/addProxyServer')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Add proxy server for exchange`,
  })
  async addProxyServer(
    @Body(new ValidationPipe({ transform: true })) body: ProxyInterface
  ): Promise<HTTP_RESPONSE<ProxyInterface[]>> {
    const [status, message, proxies] = await this.service.addProxyServer(body);

    if (status === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        length: proxies.length,
        data: proxies,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: status,
        message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Put('exchange/deleteProxyServer')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Delete a proxy server for exchange`,
  })
  async deleteProxyServer(
    @Body(new ValidationPipe({ transform: true })) body: ProxyInterface
  ): Promise<HTTP_RESPONSE<ProxyInterface[]>> {
    const [status, message, proxies] = await this.service.deleteProxyServer(body);

    if (status === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        length: proxies.length,
        data: proxies,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: status,
        message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Post('exchange/setUserProxy')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Set proxy for Exchange API key`,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async setUserProxy(@Body() body: UserProxy): Promise<HTTP_RESPONSE<UserProxyInterface>> {
    const [status, message, proxy] = await this.service.setUserProxy(body);

    if (status === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
        data: proxy,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: status,
        message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('/updateExchangeKeys')
  @ApiOperation({
    description: `Update user's exchange keys`,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateExchangeKeys(@Body() body: UpdateUserExchangeKeysBodyDto): Promise<HTTP_RESPONSE<ExchangeConfig[]>> {
    const [error, message, exchanges] = await this.service.updateExchangeKeys(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        message,
        data: exchanges,
      };
    } else {
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

  //**********************
  //*** TRADING STATUS ***
  //**********************

  @UseGuards(JwtAuthGuard)
  @Put('/changeTradingStatus')
  @ApiOperation({
    description: `Trading Status: Change user trading status`,
  })
  async changeTradingStatus(
    @Body(new ValidationPipe({ transform: true })) body: { active: boolean; userId: string }
  ): Promise<HTTP_RESPONSE<boolean>> {
    const [error, message, status] = await this.service.changeTradingStatus(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: status,
      };
    } else {
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

  //************************
  //*** EXCHANGE SYMBOLS ***
  //************************

  @UseGuards(JwtAuthGuard)
  @Put('/addExchangeSymbols')
  @ApiOperation({
    description: `Add user's exchange symbols`,
  })
  async addExchangeSymbols(
    @Body(new ValidationPipe({ transform: true })) body: ChangeUserExchangeSymbolBodyDto
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.addExchangeSymbols(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Put('/deleteExchangeSymbols')
  @ApiOperation({
    description: `Delete user's exchange symbols`,
  })
  async deleteExchangeSymbols(
    @Body(new ValidationPipe({ transform: true })) body: ChangeUserExchangeSymbolBodyDto
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.deleteExchangeSymbols(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Put('/clearExchangeSymbols')
  @ApiOperation({
    description: `Clear user's exchange symbols`,
  })
  async clearExchangeSymbols(
    @Body(new ValidationPipe({ transform: true })) body: ClearUserExchangeSymbolBodyDto
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.clearExchangeSymbols(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Get('/exchangeSymbols/:exchangeId/:userId')
  @ApiOperation({
    description: `Get user's exchange symbols`,
  })
  async getExchangeSymbols(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, favoriteSymbols] = await this.service.getExchangeSymbols({ userId, exchangeId });

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: favoriteSymbols,
      };
    } else {
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

  //******************************
  //*** WALLET BALANCE SYMBOLS ***
  //******************************

  @Get('balance/:exchangeId/:userId')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get wallet balances of the user on the exchange`,
    parameters: [
      { name: 'exchangeId', in: 'path', schema: { type: 'string' } },
      { name: 'userId', in: 'path', schema: { type: 'string' } },
    ],
  })
  async getUserWalletBalance(
    @Param('exchangeId') exchangeId: string,
    @Param('userId') userId: string
  ): Promise<HTTP_RESPONSE<UserWalletBalances | void>> {
    const [error, message, balance, updated] = await this.service.getUserWalletBalance(userId, exchangeId); // error: REST_API_RESPONSE_STATUS

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      const cdn = 'https://cupocoin.sfo3.cdn.digitaloceanspaces.com/crypto-logo/';

      let total = 0;
      const balances: UserWalletBalances = {};

      Object.keys(balance)
        .sort((a, b) => balance[b].cost - balance[a].cost)
        .forEach((currency) => {
          balances[currency] = balance[currency];

          balances[currency].coinUrl = icons.includes(currency.toLowerCase())
            ? `${cdn}${currency.toLowerCase()}.svg`
            : `${cdn}coin.svg`;

          total += balance[currency]?.cost || 0;
        });

      return {
        statusCode: HttpStatus.OK,
        sum: +total.toFixed(2),
        length: Object.keys(balances).length,
        updated: new Date(updated).toISOString(),
        data: balances,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error,
        message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  //************************
  //*** ACCOUNT BALANCES ***
  //************************

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Get('account/balance/:userId')
  @ApiOperation({
    description: `Get account balance of the user`,
    parameters: [{ name: 'userId', in: 'path', schema: { type: 'string' } }],
  })
  @ApiOkResponse({
    description: 'Account balance of the user',
    type: UserAccountBalance,
  })
  async getUserAccountBalance(@Param('userId') userId: string): Promise<HTTP_RESPONSE<UserAccountBalance>> {
    const balance = await this.service.getUserAccountBalance(userId);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.USER_NOT_FOUND,
        message: `User with id ${userId} not found`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Get('account/balances/list')
  // @UsePipes(new ValidationPipe({ transform: true }))
  async getAllAccountBalances(@Query() query: GetAllAccountBalancesDto): Promise<HTTP_RESPONSE<UserAccountBalance[]>> {
    const { totalItems, balances } = await this.service.getAllUserAccountBalances(query);

    if (balances) {
      return {
        statusCode: HttpStatus.OK,
        length: balances.length,
        totalItems,
        page: query.page,
        itemsPerPage: query.itemsPerPage,
        data: balances,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
        message: `Internal error`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Post('account/setBalance')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Set a sum or days to the account balance of the user`,
  })
  async setUserAccountBalance(
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: UserAccountChangeBalanceBodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const balance = await this.service.setUserAccountBalance(body);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.USER_NOT_FOUND,
        message: `User with id ${userId} not found`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Put('account/changeBalance')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Change a sum or days to the account balance of the user`,
  })
  async changeUserAccountBalance(
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: UserAccountChangeBalanceBodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const balance = await this.service.changeUserAccountBalance(body);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.USER_NOT_FOUND,
        message: `User with id ${userId} not found`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Put(['account/changeAutoRenewSubscriptionStatus', 'account/changeAutoRenewSubscription'])
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Change auto renew subscription status of the user`,
  })
  async changeAutoRenewSubscriptionStatus(
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: UserSubscriptionAutoRenewBodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const balance = await this.service.changeAutoRenewSubscriptionStatus(body);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.USER_NOT_FOUND,
        message: `User with id ${userId} not found`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Post('account/transferReferral')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Transfer a sum from Referral balance to Main balance`,
  })
  async transferReferralBalance(
    @Body(new ValidationPipe({ transform: true })) body: UserAccountChangeBalanceBodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const [error, message, balance] = await this.service.transferReferralBalance({
      userId: body.userId,
      sum: body.toMainBalance,
      writeOffReminder: body.writeOffReminder,
    });

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: error,
        message: message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Post('account/addBalance')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Add a sum or days to the account balance of the user`,
  })
  async addUserAccountBalance(
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: UserAccountChangeBalanceBodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const [error, message, balance] = await this.service.addUserAccountBalance(body);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: error,
        message: message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Post('account/minusBalance')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Subtract a sum or days to the account balance of the user`,
  })
  async minusUserAccountBalance(
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ transform: true })) body: UserAccountChangeBalanceBodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const [error, message, balance] = await this.service.minusUserAccountBalance(body);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: error,
        message: message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Version(['2'])
  @Post('account/continueSubscription')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Continue the user subscription`,
  })
  async continueUserAccountSubscriptionV2(
    @Body(new ValidationPipe({ transform: true })) body: ContinueUserAccountSubscriptionV2BodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const [error, message, balance] = await this.service.continueUserAccountSubscription(body);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        length: balance.subscriptionDaysLeft,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: error,
        message: message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/resetTrials')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Continue the user subscription`,
  })
  async resetTrials(
    @Body(new ValidationPipe({ transform: true })) body: { userId: string }
  ): Promise<HTTP_RESPONSE<void>> {
    const [error, message] = await this.service.resetTrials(body.userId);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: error,
        message: message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Version([VERSION_NEUTRAL, '1'])
  @Post('account/continueSubscription')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Continue the user subscription`,
  })
  async continueUserAccountSubscription(
    @Body(new ValidationPipe({ transform: true })) body: ContinueUserAccountSubscriptionBodyDto
  ): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const [error, message, balance] = await this.service.continueUserAccountSubscription(body);

    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: balance.mainBalance + balance.bonusBalance + balance.referralBalance,
        length: balance.subscriptionDaysLeft,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: error,
        message: message,
      } as HTTP_RESPONSE<void>,
      HttpStatus.BAD_REQUEST
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Delete('account/balance/:userId')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Reset the account balance of the user`,
    parameters: [{ name: 'userId', in: 'path', schema: { type: 'string' } }],
  })
  async resetUserAccountBalance(@Param('userId') userId: string): Promise<HTTP_RESPONSE<UserAccountBalance | void>> {
    const balance = await this.service.resetUserAccountBalance(userId);
    if (balance) {
      return {
        statusCode: HttpStatus.OK,
        sum: 0,
        data: balance,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND,
        message: `User account balances [${userId}] not found`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.CUSTOMER)
  @Get('account/snapshot/:userId')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get user snapshot`,
    parameters: [{ name: 'userId', in: 'path', schema: { type: 'string' } }],
  })
  @ApiOkResponse({
    description: 'User snapshot',
    type: UserAccountBalance,
  })
  async getUserAccountSnapshot(@Param('userId') userId: string): Promise<HTTP_RESPONSE<UserSnapshotResponse>> {
    const snapshot = await this.service.getUserAccountSnapshot(userId);
    if (snapshot) {
      return {
        statusCode: HttpStatus.OK,
        data: snapshot,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.USER_NOT_FOUND,
        message: `User account snapshot [${userId}] not found`,
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }

  @Public()
  @Get('account/products')
  @Header('content-type', 'application/json')
  @ApiOperation({
    description: `Get the subscriptions list`,
  })
  @ApiOkResponse({
    description: 'EnabledProductInterface',
    type: EnabledProductInterface,
  })
  async getAllProducts(@Query('disabled') disabled?: string): Promise<HTTP_RESPONSE<EnabledProductInterface>> {
    return {
      statusCode: HttpStatus.OK,
      data: getAllProducts(disabled === 'true'),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('account/products/:userId')
  @ApiOperation({
    description: `Get the user subscriptions list`,
  })
  @ApiOkResponse({
    description: 'User EnabledProductInterface',
    type: EnabledProductInterface,
  })
  async getUserProducts(@Param('userId') userId: string): Promise<HTTP_RESPONSE<EnabledProductInterface>> {
    return {
      statusCode: HttpStatus.OK,
      data: await this.service.getUserProducts(userId),
    };
  }

  //*****************
  //*** REFERRALS ***
  //*****************

  @UseGuards(JwtAuthGuard)
  @Get('/referrals/:userId')
  @ApiOperation({
    description: `Get referrals list of the user`,
  })
  async getReferrals(@Param('userId') userId: string): Promise<HTTP_RESPONSE<UserReferralsResponse>> {
    const [error, message, userReferrals] = await this.service.getReferrals(userId);

    if (userReferrals) {
      return {
        statusCode: HttpStatus.OK,
        data: userReferrals,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Get('/referralsReward/:userId')
  @ApiOperation({
    description: `Get referrals reward list of the partner`,
  })
  async getReferralsReward(@Param('userId') userId: string): Promise<HTTP_RESPONSE<ReferralReward[]>> {
    const referralRewards = await this.service.getReferralsReward(userId);

    if (referralRewards) {
      return {
        statusCode: HttpStatus.OK,
        sum: referralRewards.reduce((partialSum, r) => partialSum + (r.sum ?? 0), 0),
        length: referralRewards.length,
        data: referralRewards.map((r) => {
          delete r._id;
          delete r.partnerId;
          return r;
        }),
      };
    } else {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/referral')
  @ApiOperation({
    description: `Add a referral to the user`,
  })
  async addReferral(@Body(new ValidationPipe({ transform: true })) body: UserReferral): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.addReferral(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: message,
      };
    } else {
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

  //***************
  //*** COUPONS ***
  //***************

  @UseGuards(JwtAuthGuard)
  // @Roles(ROLE.ADMIN)
  @Get('/coupon/list')
  @ApiOperation({
    description: `Get all coupons`,
  })
  async getCoupons(): Promise<HTTP_RESPONSE<Coupon[]>> {
    const [error, message, coupons] = await this.coupon.getCoupons();

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        length: coupons.length,
        data: coupons,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  // @Roles(ROLE.ADMIN)
  @Post('/coupon/new')
  @ApiOperation({
    description: `Add a new coupon`,
  })
  async addNewCoupon(@Body(new ValidationPipe({ transform: true })) body: Coupon): Promise<HTTP_RESPONSE<string>> {
    const [error, message, coupon] = await this.coupon.addNewCoupon(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: coupon,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  // @Roles(ROLE.ADMIN)
  @Post('/coupon/addUserCoupon')
  @ApiOperation({
    description: `Activate a user coupon`,
  })
  async addUserCoupon(
    @Body(new ValidationPipe({ transform: true })) body: { id: string; userId: string }
  ): Promise<HTTP_RESPONSE<string[]>> {
    const [error, message, coupons] = await this.coupon.addUserCoupon(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: coupons,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Post('/coupon/activate')
  @ApiOperation({
    description: `Activate a coupon`,
  })
  async activateCoupon(
    @Body(new ValidationPipe({ transform: true })) body: { id: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message, coupon] = await this.coupon.activateCoupon();

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: coupon,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.ADMIN)
  @Post('/coupon/deactivate')
  @ApiOperation({
    description: `Deactivate a coupon`,
  })
  async deactivateCoupon(
    @Body(new ValidationPipe({ transform: true })) body: { id: string }
  ): Promise<HTTP_RESPONSE<string>> {
    const [error, message, coupon] = await this.coupon.deactivateCoupon();

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
        data: coupon,
      };
    } else {
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

  @UseGuards(JwtAuthGuard)
  @Roles(ROLE.CUSTOMER, ROLE.ADMIN)
  @Post('/order/selfManage')
  @ApiOperation({
    description: `Allow the user to manage his orders`,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async allowUserManageOrders(@Body() body: ChangeUsersDto): Promise<HTTP_RESPONSE<string>> {
    const [error, message] = await this.service.allowUserManageOrders(body);

    if (error === REST_API_RESPONSE_STATUS.SUCCESS) {
      return {
        statusCode: HttpStatus.OK,
      };
    } else {
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
}
