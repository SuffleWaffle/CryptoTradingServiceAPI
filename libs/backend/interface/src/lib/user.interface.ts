import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Expose, Transform, Type } from 'class-transformer';
import { ObjectId } from 'mongodb';
import { Balances } from 'ccxt';
import { PAYOUT_PROFILE_STATUS, PAYOUT_PROFILE_TYPE, USER_EXCHANGE_STATUS, USER_ROLES } from '@cupo/backend/constant';
import { StrategyParameters } from './strategy.interface';
import { IGetListDto } from './list.dto';
import { DEVICE_TYPE } from './jwt-token.interface';

export type CurrencyBalance = { free: number; cost: number; price: number; prevPrice?: number; coinUrl?: string };

export type UserWalletBalances = Record<string, CurrencyBalance>;

// Type of Settings for the user's exchanges
export class ExchangeConfig implements ExchangeConfigType {
  // exchangeId - the exchange name from https://api.cupocoin.com/exchange/list
  // example: 'binance'
  exchangeId: string;

  // is the exchange enabled for trade
  status?: USER_EXCHANGE_STATUS;
  lastError?: string;

  // example: 'ECZ9FKR7COGVkiiltzsYxj....'
  publicKey?: string;

  // example: 'Cm9irgxWud96IX....'
  secretKey?: string;

  // example: 'y5tbj1FD342gk....'
  passphrase?: string;

  proxyIp?: string;
  dedicatedIp?: string;

  // example: 'USDT' or 'USD'
  baseCurrency: string;

  // symbols which the user wants to trade
  // symbols were obtained from the list: https://api.cupocoin.com/exchange/symbols/binance?supportedOnly=true
  // Not required field.
  // Example: ['BTC/USDT', 'ETH/USDT', 'LTC/USDT', 'ETC/USDT']
  symbols?: string[];

  // Favorite symbols which the user wants to see in the favorite list
  // symbols were obtained from the list: https://api.cupocoin.com/exchange/symbols/binance?supportedOnly=true
  // Not required field.
  // Example: ['BTC/USDT', 'ETH/USDT', 'LTC/USDT', 'ETC/USDT']
  favoriteSymbols?: string[];
}

export type ExchangeConfigType = {
  exchangeId: string;
  status?: USER_EXCHANGE_STATUS;
  publicKey?: string;
  secretKey?: string;
  passphrase?: string;
  baseCurrency: string;
  symbols?: string[];
  favoriteSymbols?: string[];
};

// Type of Settings for the user's entity
export type User = {
  // Any unique string, it is a user_uid from User API
  id?: string;

  // Any short for identifying the user
  name?: string;
  platformId?: number;

  avatarId?: string;

  email?: string;
  emailVerified?: boolean;
  adminApproved?: boolean;
  allowManageOrders?: boolean; // user can change the orders after admin approved
  password?: string;
  roles?: USER_ROLES[];

  referralCode?: string;

  // Array of ExchangeConfig objects
  exchanges?: Array<ExchangeConfig>;

  // currencies which the user wants to trade on the different exchanges
  // If the array is empty, the user will be able to trade all currencies from the list, except the ones from the array excludedCurrencies.
  // If the array is not empty, the user has to add base currencies to the array too
  // Not required field.
  // Not implemented yet
  currencies?: string[]; // ['BTC', 'ETH', 'LTC', 'ETC']

  // symbols which consist these currencies the user will not be able to trade
  // If the array is empty, the user will be able to trade all currencies from the "currencies" or "symbols" list.
  // Not required field.
  excludedCurrencies?: string[]; // example: ['NFT', 'XRP', 'ATOM']

  // The Bot can/or not trade behalf of the user
  active?: boolean;

  // Custom trade strategy parameters of the user. Not implemented yet
  strategy?: StrategyParameters;

  // number of bad requests to the exchange
  badRequestCount?: { [exchangeId: string]: { count: number; lastRequest: number } };

  // virtual balance of the user
  virtualBalance?: { [exchangeId: string]: number };

  // user has bought the subscription number of times
  subscriptionBought?: number;
  activatedSubscriptions?: string[];
  activatedCoupons?: string[];

  // timestamp of user registration
  created?: number;
  // timestamp of the last update of the user and it's balances
  update?: number;
  // flag of the user deleted
  deleted?: boolean;
};

export interface IGetAllUsers extends IGetListDto {
  userId?: string;
  userIds?: string[];
  userName?: string;
  userEmail?: string;
  userPlatformId?: number;
  emailVerified?: boolean;
  adminApproved?: boolean;
  active?: boolean;
}

export class GetAllUsersDto implements IGetAllUsers {
  @Expose()
  @ApiProperty()
  userId?: string;

  @Expose()
  @ApiProperty()
  userName?: string;

  @Expose()
  @ApiProperty()
  userEmail?: string;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(100013)
  userPlatformId?: number;

  @Expose()
  @ApiProperty()
  page?: number;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  itemsPerPage?: number;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  emailVerified?: boolean;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  adminApproved?: boolean;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  active?: boolean;
}

export class ChangeUsersDto implements IGetAllUsers {
  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsString()
  @Type(() => String)
  userId?: string;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsString()
  @Type(() => String)
  userName?: string;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsString()
  @Type(() => String)
  userEmail?: string;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(100013)
  userPlatformId?: number;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsString()
  @Type(() => String)
  deviceType?: DEVICE_TYPE;
}

export interface IGetAccountBalances extends IGetListDto {
  userId?: string;
  userIds?: string[];
  userName?: string;
  userEmail?: string;
  userPlatformId?: number;
  mainBalance?: number;
  bonusBalance?: number;
  referralBalance?: number;
  subscriptionAutoRenewStatus?: boolean;
  subscriptionAutoRenewDays?: number;
  subscriptionActiveTill?: bigint | any;
  subscriptionActiveTillHuman?: Date; // information only, don't stored in DB
  subscriptionDaysLeft?: number; // automatically calculated
}

export class GetAllAccountBalancesDto implements IGetAccountBalances {
  @Expose()
  @ApiProperty()
  userId?: string;

  @Expose()
  @ApiProperty()
  userName?: string;

  @Expose()
  @ApiProperty()
  userEmail?: string;

  @Expose()
  @ApiProperty()
  userPlatformId?: number;

  @Expose()
  @ApiProperty()
  page?: number;

  @Expose()
  @ApiProperty()
  itemsPerPage?: number;
}

export class UserAccountBalance {
  @Expose()
  @ApiProperty()
  userId: string;

  _id?: string;

  @Expose()
  @ApiProperty()
  mainBalance?: number;

  @Expose()
  @ApiProperty()
  bonusBalance?: number;

  @Expose()
  @ApiProperty()
  referralBalance?: number;

  @Expose()
  @ApiProperty()
  subscriptionAutoRenewStatus?: boolean;

  @Expose()
  @ApiProperty()
  subscriptionAutoRenewDays?: number;

  @Expose()
  @ApiProperty()
  subscriptionActiveTill?: bigint | any;

  @Expose()
  subscriptionActiveTillHuman?: Date; // information only, don't stored in DB

  @Expose()
  @ApiProperty()
  subscriptionDaysLeft?: number; // automatically calculated

  created?: Date;
  updated?: Date;
}

export class UserAccountTransferBalance {
  @Expose()
  @ApiProperty()
  userId: string;

  _id?: ObjectId;

  @Expose()
  @ApiProperty()
  fromMainBalance?: number;

  @Expose()
  @ApiProperty()
  fromBonusBalance?: number;

  @Expose()
  @ApiProperty()
  fromReferralBalance?: number;

  @Expose()
  @ApiProperty()
  toBalance?: 'main' | 'bonus' | 'referral';

  balanceBefore: UserAccountBalance;
  balanceAfter: UserAccountBalance;

  comment?: string;
  created?: Date;
  updated?: Date;
  deleted?: boolean;
}

export interface UserSnapshot {
  userId?: string;
  accountBalance?: Omit<UserAccountBalance, 'userId'>;
  generalInfo?: {
    email: string;
    name?: string;
    emailVerified?: boolean;
    adminApproved?: boolean;
    avatarId?: string;
    registerDate?: number;
  };

  subscription?: {
    autoRenew: boolean;
    subscriptionActiveTill: number;
    subscriptionActiveTillHuman: Date;
    subscriptionDaysLeft: number;
  };

  tradeInfo?: {
    active: boolean;
    currencies: string[];
    excludedCurrencies: string[];
  };

  exchanges?: ExchangeConfig[];
}

export class UserSnapshotResponse implements UserSnapshot {
  @Expose()
  @ApiProperty()
  userId?: string;

  @Expose()
  @ApiProperty()
  accountBalance?: Omit<UserAccountBalance, 'userId'>;

  @Expose()
  @ApiProperty()
  generalInfo?: {
    email: string;
    name?: string;
    emailVerified?: boolean;
    adminApproved?: boolean;
    allowManageOrders?: boolean;
    avatarId?: string;
    registerDate?: number;
  };

  @ApiProperty()
  subscription?: {
    autoRenew: boolean;
    subscriptionActiveTill: number;
    subscriptionActiveTillHuman: Date;
    subscriptionDaysLeft: number;
  };

  @ApiProperty()
  tradeInfo?: {
    active: boolean;
    currencies: string[];
    excludedCurrencies: string[];
  };

  @ApiProperty()
  exchanges?: ExchangeConfig[];
}

export interface UserReferrals {
  userId: string;
  level1Referrals: string[];
  level2Referrals: string[];
  level1Partner?: string;
  level2Partner?: string;
  level1ReferralsReward: number;
  level2ReferralsReward: number;
}

export class UserReferralsResponse implements UserReferrals {
  @Expose()
  @ApiProperty()
  userId: string;

  @Expose()
  @ApiProperty()
  level1Referrals: string[];

  @Expose()
  @ApiProperty()
  level2Referrals: string[];

  @Expose()
  @IsOptional()
  @ApiProperty()
  level1Partner?: string;

  @Expose()
  @IsOptional()
  @ApiProperty()
  level2Partner?: string;

  @Expose()
  @ApiProperty()
  level1ReferralsReward: number;

  @Expose()
  @ApiProperty()
  level2ReferralsReward: number;
}

export interface UserReferral {
  userId: string;
  partnerId?: string;
  updated?: Date;
  created?: Date;
  deleted?: boolean;
}

export class PayoutProfile {
  _id?: string | ObjectId; // Payout profile ID
  profileId?: string; // Payout profile ID
  userId: string;
  type: PAYOUT_PROFILE_TYPE;
  description?: string;
  firstName?: string;
  lastName?: string;
  paypalEmail?: string;
  phone?: string;
  status: PAYOUT_PROFILE_STATUS;
  comment?: string;
  create?: Date;
  update?: Date;
}

export type UserBalancesType = {
  [userId: string]: {
    balances: Balances; // The structure from https://docs.ccxt.com/en/latest/manual.html#balance-structure
    update?: number; // timestamp of the last update of the user balances
  };
};

export class GetUsersQueryDto {
  @Expose()
  @IsOptional()
  @IsBoolean()
  // @Type(() => Boolean)
  @Type(() => String)
  @Transform(({ value }) => (value ? value.toLowerCase() === 'true' : undefined))
  @ApiProperty({
    type: Boolean,
  })
  active?: boolean;
}

export class UserBodyDto implements User {
  @IsOptional()
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  id: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  name?: string;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Min(100013)
  @Type(() => Number)
  @ApiProperty({
    type: String,
  })
  platformId?: number;

  @Expose()
  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  avatarId?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  email?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  referralCode?: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    type: Boolean,
  })
  active?: boolean;

  // @Expose()
  // @IsOptional()
  // @IsString()
  // @Type(() => String)
  // @Transform(({ value }) => value && value.toUpperCase())
  // @ApiProperty({
  //   type: String,
  // })
  // baseCurrency?: string;

  // @Expose()
  // @IsOptional()
  // @IsArray()
  // @IsString({ each: true })
  // @Type(() => Array)
  // @Transform(({ value }) => value && value.map((v) => v.toUpperCase()))
  // @ApiProperty({
  //   type: Array,
  //   example: '["BTC/USDT", "ETH/USDT", "LTC/USDT"]',
  // })
  // symbols?: string[];

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => Array)
  @Transform(({ value }) => value && value.map((v) => v.toUpperCase()))
  @ApiProperty({
    type: Array,
    example: '["BTC", "XRP", "ATOM", "ETH", "LTC"]',
  })
  currencies?: string[];

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => Array)
  @Transform(({ value }) => value && value.map((v) => v.toUpperCase()))
  @ApiProperty({
    type: Array,
    example: '["NFT", "XRP", "ATOM"]',
  })
  excludedCurrencies?: string[];

  @Expose()
  @IsOptional()
  @IsArray()
  @ApiProperty({
    type: Array,
    example:
      "[{exchangeId: 'binance', publicKey: 'ECZ9FKR7COGVkiiltzsYxj....', secretKey: 'Cm9irgxWud96IX....', passphrase: '2121212dsad', baseCurrency: 'USDT', favoriteSymbols: 'BTC/USDT,ETH/USDT,LTC/USDT', symbols: 'BTC/USDT,LTC/USDT', excludedSymbols: 'BTC/USDT,ETH/USDT,LTC/USDT'}]",
  })
  exchanges?: Array<ExchangeConfig>;

  @Expose()
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  @ApiProperty({
    type: Object,
    example: '{}',
  })
  strategy?: StrategyParameters;
}

export class ChangeUserFavoriteSymbolBodyDto {
  @IsOptional()
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @Expose()
  @IsString()
  @MinLength(3)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  exchangeId: string;

  @Expose()
  @IsArray()
  @IsString({ each: true })
  @Type(() => Array)
  @Transform(({ value }) => value && value.map((v) => v.toUpperCase()))
  @ApiProperty({
    type: Array,
    example: '["BTC/USDT", "ETH/USDT", "LTC/USDT"]',
  })
  favoriteSymbols: string[];
}

export class ChangeUserExchangeSymbolBodyDto {
  @IsOptional()
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @Expose()
  @IsString()
  @MinLength(3)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  exchangeId: string;

  @Expose()
  @IsArray()
  @IsString({ each: true })
  @Type(() => Array)
  @Transform(({ value }) => value && value.map((v) => v.toUpperCase()))
  @ApiProperty({
    type: Array,
    example: '["BTC/USDT", "ETH/USDT", "LTC/USDT"]',
  })
  symbols: string[];
}

export class UpdateUserExchangeKeysBodyDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  exchangeId: string;

  @IsOptional()
  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  publicKey: string;

  @IsOptional()
  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  secretKey: string;

  @IsOptional()
  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  passphrase: string;

  @IsOptional()
  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  proxyIp: string;

  @IsOptional()
  @Expose()
  @IsString()
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  @Transform(({ value }) =>
    value?.toLowerCase() === USER_EXCHANGE_STATUS.INACTIVE ? USER_EXCHANGE_STATUS.INACTIVE : undefined
  )
  status: USER_EXCHANGE_STATUS;
}

export class ClearUserFavoriteSymbolBodyDto {
  @IsOptional()
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @Expose()
  @IsString()
  @MinLength(3)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  exchangeId: string;
}

export class ClearUserExchangeSymbolBodyDto {
  @IsOptional()
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @Expose()
  @IsString()
  @MinLength(3)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  exchangeId: string;
}

export interface UserAccountChangeBalance {
  userId: string;
  subscriptionAutoRenewStatus?: boolean;
  subscriptionAutoRenewDays?: number;
  toMainBalance?: number;
  toBonusBalance?: number;
  toReferralBalance?: number;
  toSubscriptionDays?: number;
  writeOffReminder?: boolean;
}

export class UserAccountChangeBalanceBodyDto implements UserAccountChangeBalance {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @IsOptional()
  @IsBoolean()
  @Expose()
  @ApiProperty()
  subscriptionAutoRenewStatus?: boolean;

  @IsOptional()
  @IsNumber()
  @Expose()
  @ApiProperty()
  subscriptionAutoRenewDays?: number;

  @IsOptional()
  @IsNumber()
  @Expose()
  @ApiProperty()
  toMainBalance?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty()
  toBonusBalance?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty()
  toReferralBalance?: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty()
  toSubscriptionDays?: number;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  writeOffReminder?: boolean;
}

export class UserSubscriptionAutoRenewBodyDto implements UserAccountChangeBalance {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @IsOptional()
  @IsBoolean()
  @Expose()
  @ApiProperty()
  subscriptionAutoRenewStatus?: boolean;

  @IsOptional()
  @IsNumber()
  @Expose()
  @ApiProperty()
  subscriptionAutoRenewDays?: number;
}

export interface ContinueUserAccountSubscription {
  userId: string;
  paymentId?: string;
  useBonus?: boolean;
  useReferral?: boolean;
  days?: number;
  product?: string;
}

export class ContinueUserAccountSubscriptionBodyDto implements ContinueUserAccountSubscription {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @Expose()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(24)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  paymentId: string;

  @IsOptional()
  @Expose()
  @ApiProperty()
  @IsBoolean()
  useBonus?: boolean;

  @IsOptional()
  @Expose()
  @ApiProperty()
  @IsBoolean()
  useReferral?: boolean;

  @Expose()
  @ApiProperty()
  @Min(1)
  days?: number;
}

export class ContinueUserAccountSubscriptionV2BodyDto implements ContinueUserAccountSubscription {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  userId: string;

  @Expose()
  @ApiProperty()
  @IsNotEmpty()
  @MinLength(1)
  @Type(() => String)
  product: string;

  @Expose()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(24)
  @Type(() => String)
  @ApiProperty({
    type: String,
  })
  paymentId: string;

  @IsOptional()
  @Expose()
  @ApiProperty()
  @IsBoolean()
  useBonus?: boolean;

  @IsOptional()
  @Expose()
  @ApiProperty()
  @IsBoolean()
  useReferral?: boolean;
}

export interface Coupon {
  _id?: string;
  id: string;
  description: string;

  active?: boolean;

  created?: Date;
}
