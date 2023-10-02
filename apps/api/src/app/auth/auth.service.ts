import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { RedisSessionService } from '@cupo/backend/storage/src/lib/redis/redis.session.service';
import { SubscriptionService } from '@cupo/backend/services';
import { RedisUserService } from '@cupo/backend/storage';
import { OTP_PREFIX } from '@cupo/mail';
import {
  ChangeUsersDto,
  DEVICE_TYPE,
  EVENT_TYPE,
  IGetAllUsers,
  JwtToken,
  User,
  UserSnapshotResponse,
} from '@cupo/backend/interface';
import { JWT_SECRET, REST_API_RESPONSE_STATUS, USER_ROLES } from '@cupo/backend/constant';
import { EventService } from '@cupo/event';

@Injectable()
export class AuthService {
  constructor(
    private readonly subService: SubscriptionService,
    private readonly redisUser: RedisUserService,
    private readonly redisSession: RedisSessionService,
    private readonly jwtService: JwtService,
    private readonly events: EventService
  ) {}

  async signToken(data: { user: User; deviceType?: DEVICE_TYPE; role: USER_ROLES }): Promise<string> {
    const { user, deviceType, role } = data;

    const payload: JwtToken = {
      sessionId: randomUUID(),
      userId: user.id,
      role,
      deviceType: deviceType || DEVICE_TYPE.WEB,
      iat: Date.now(),
    };

    await this.redisSession.setJWTToken(user.id, payload);
    Logger.debug(`User <${user.id}> session created`, 'AuthService.signToken');

    return this.jwtService.signAsync(payload, { secret: JWT_SECRET });
  }

  async generateHash(password: string): Promise<string> {
    const saltOrRounds = 10;

    return await bcrypt.hash(password, saltOrRounds);
  }

  generateHashSync(password: string): string {
    const saltOrRounds = 10;

    return bcrypt.hashSync(password, saltOrRounds);
  }

  async checkPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  validateUserPassword(user: User, pass: string): User | null {
    if (bcrypt.compareSync(pass, user?.password)) {
      const { password, ...result } = user;

      return result;
    } else {
      Logger.error(`User <${user.email}> password not match`, 'AuthService.validateUser');
      return null;
    }
  }

  async validateJwtStrategyUser(token: JwtToken): Promise<User | null> {
    if (!token?.sessionId) {
      Logger.error(`User token has no <sessionId>`, 'AuthService.validateJwtStrategyUser');
      return null;
    }

    const session = await this.redisSession.getJWTToken(token.userId, token.sessionId);
    if (!session) {
      Logger.error(`User <${token.sessionId}> session not found`, 'AuthService.validateJwtStrategyUser');
      return null;
    }

    const user = await this.redisUser.getUser({ userId: token.userId });
    if (!user?.id?.length) {
      Logger.error(`User not found`, 'AuthService.validateJwtStrategyUser');
      return null;
    }

    if (user.id !== token.userId || !user.email || !user.emailVerified || !(user?.roles || []).includes(token.role)) {
      Logger.error(`Bad user token`, 'AuthService.validateJwtStrategyUser');

      return null;
    }

    return user;
  }

  async validateLocalStrategyUser(email: string, pass: string): Promise<User | null> {
    if (!email?.length || !pass?.length) {
      Logger.error(`Email <${email}> or password not provided`, 'AuthService.validateUser');
      return null;
    }

    const user = await this.redisUser.getUser({ email });
    if (!user) {
      Logger.error(`User <${email}> not found`, 'AuthService.validateUser');
      return null;
    }

    // let userData, loginResponse, snapResponse, userSnap;

    // try {
    //   let response = await axios.post(
    //     `${USER_API_URL}/user/login/`,
    //     {
    //       email_1: email,
    //       password_1: pass,
    //     },
    //     { headers: { 'Content-Type': 'application/json' } }
    //   );
    //   loginResponse = response?.data;
    //
    //   if (loginResponse?.['login_user_stat'] !== 'TRUE') {
    //     Logger.error(`Bad response from 'login' User API`, 'AuthService.validateUser');
    //     // return null;
    //   }
    //
    //   userData = loginResponse?.['login_user_data'];
    //   if (!userData?.user_uid?.length || !userData?.email?.length) {
    //     Logger.error(`Bad user data ${JSON.stringify(userData || {})}`, 'AuthService.validateUser');
    //     // return null;
    //   }
    //
    //   if (userData?.user_uid?.length && userData?.email?.length) {
    //     response = await axios.get(`${USER_API_URL}/user/account/get_account_snapshot/?user_uuid=${userData.user_uid}`);
    //     snapResponse = response?.data;
    //
    //     if (snapResponse?.['req_stat'] !== true) {
    //       Logger.error(`Bad response from 'get_account_snapshot' User API`, 'AuthService.validateUser');
    //       // return null;
    //     }
    //     userSnap = snapResponse?.['user_data'];
    //   }
    //
    //   if (!user && userData?.user_uid?.length) {
    //     user = (await this.redisUser.getUser({ userId: userData.user_uid })) || {};
    //   }
    //   user = (await this.redisUser.getUser({ userId: userData.user_uid })) || {};
    //   if (!user) {
    //     Logger.error(`User <${userData?.user_uid}> not found in Redis`, 'AuthService.validateUser');
    //     return null;
    //   }
    //
    //   if (user.id?.length && userData?.user_uid?.length && user.id !== userData.user_uid) {
    //     Logger.error(`User <${email}> id not match by ID`, 'AuthService.validateUser');
    //
    //     const oldId = user.id;
    //     user.id = userData.user_uid;
    //     user = await this.redisUser.setUser(user);
    //
    //     await this.redisUser.deleteUser(oldId);
    //   }
    //
    //   user.email = user.email || userData?.email;
    //   user.password = user.password?.length ? user.password : this.generateHashSync(pass);
    //   user.name = user.name || userData?.name || user.name || userSnap?.general_info?.name;
    //
    //   user.accountBalance = user.accountBalance || {
    //     bonus: userSnap?.['balances']?.['bonus_balance'] || 0,
    //     main: userSnap?.['balances']?.['main_balance'] || 0,
    //     referral: userSnap?.['balances']?.['referral_balance'] || 0,
    //   };
    //
    //   user.subscription = user.subscription || {
    //     autoRenew: userSnap?.['subscription']?.['sub_autorenewal'] || 0,
    //     days: userSnap?.['subscription']?.['sub_days'] || 0,
    //   };
    //
    //   user.exchanges =
    //     user.exchanges ||
    //     userSnap?.['exchanges']?.map((exchange) => ({
    //       exchangeId: exchange?.['exchangeId'],
    //       publicKey: exchange?.['publicKey'],
    //       secretKey: exchange?.['secretKey'],
    //       passphrase: exchange?.['passphrase'],
    //       baseCurrency: exchange?.['baseCurrency'],
    //       symbols: exchange?.['symbols'],
    //     })) ||
    //     [];
    //
    //   user.info = loginResponse && userSnap ? { apiUserLogin: loginResponse, apiUserSnapshot: userSnap } : user.info;
    // } catch (err) {
    //   Logger.error(err.message, err.stack, 'AuthService.validateUser');
    //   return null;
    // }

    return this.validateUserPassword(user, pass);

    // User already exists in the CRM
    // if (user?.id) {
    //   const existent = await this.redisUser.setUser(user, false);
    //
    //   return this.validateUserPassword(existent, email, pass);
    // } else if (user && userData?.user_uid) {
    //   user.id = userData?.user_uid;
    //   user.created = userSnap?.general_info?.register_date_unix;
    //
    //   return await this.redisUser.addNewUser(user);
    // } else {
    //   Logger.error(`User <${email}> not found`, 'AuthService.validateUser');
    //   return null;
    // }
  }

  async login(
    body: { email: string; password: string; deviceType: DEVICE_TYPE; role: USER_ROLES },
    user: User
  ): Promise<[REST_API_RESPONSE_STATUS, string, (UserSnapshotResponse | User) & { access_token: string }]> {
    if (!body) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Body parameters not provided`, null];
    }

    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${body?.email || ''}> not found`, null];
    }

    const { email, password, deviceType, role } = body;

    if (role !== USER_ROLES.CUSTOMER && role !== USER_ROLES.ADMIN) {
      return [REST_API_RESPONSE_STATUS.AUTH_WRONG_ROLE, `Wrong role provided`, null];
    }

    if (!email?.length) {
      return [REST_API_RESPONSE_STATUS.USER_EMAIL_NOT_PROVIDED, `User <${user.id}> 'email' not provided`, null];
    }

    if (!password?.length) {
      return [REST_API_RESPONSE_STATUS.PASSWORD_NOT_PROVIDED, `User <${user.id}> 'password' not provided`, null];
    }

    if (!user.emailVerified) {
      return [
        REST_API_RESPONSE_STATUS.USER_EMAIL_NOT_VERIFIED,
        `User not confirmed the email <${body?.email || ''}>`,
        {
          userId: user.id,
          generalInfo: {
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
          },
          access_token: undefined,
        },
      ];
    }

    if (role === USER_ROLES.ADMIN && !user.adminApproved) {
      return [
        REST_API_RESPONSE_STATUS.AUTH_ADMIN_NOT_APPROVED,
        `User <${user?.email || user.id}> not approved by admin`,
        {
          userId: user.id,
          generalInfo: {
            email: user.email,
            name: user.name,
            adminApproved: user.adminApproved,
          },
          access_token: undefined,
        },
      ];
    }

    let changedUser = { ...user };

    if (role === USER_ROLES.ADMIN && !changedUser.roles?.includes(USER_ROLES.ADMIN)) {
      changedUser.roles = changedUser.roles || [];
      changedUser.roles.push(USER_ROLES.ADMIN);
      changedUser = await this.redisUser.setUser(changedUser, false);
    }

    if (!changedUser.roles || (role === USER_ROLES.CUSTOMER && !changedUser.roles.includes(role))) {
      changedUser.roles = changedUser.roles || [];
      changedUser.roles.push(role);
      changedUser = await this.redisUser.setUser(changedUser, false);
    }

    const token = await this.signToken({ user: changedUser, deviceType, role });

    let response;
    if (role === USER_ROLES.ADMIN) {
      delete changedUser.password;
      response = changedUser;
    } else {
      response = (await this.subService.getUserAccountSnapshot(changedUser.id)) || { userId: changedUser.id };
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      {
        ...response,
        access_token: token,
      },
    ];
  }

  async logout(
    body: { email: string; deviceType: DEVICE_TYPE },
    user: User
  ): Promise<[REST_API_RESPONSE_STATUS, string]> {
    // if (!body) {
    //   return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Body parameters not provided`];
    // }
    //
    // if (!user) {
    //   return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User <${body?.email || ''}> not found`];
    // }
    //
    // const { email, deviceType } = body;
    //
    // if (!email?.length) {
    //   return [REST_API_RESPONSE_STATUS.USER_EMAIL_NOT_PROVIDED, `User <${user.id}> 'email' not provided`];
    // }

    if (!user?.id) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User not found`];
    }

    await this.redisSession.removeUserSession(user.id, body.deviceType);

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`];
  }

  async register(body: {
    email: string;
    password: string;
    name?: string;
    refId?: string;
    deviceType: DEVICE_TYPE;
    role: USER_ROLES;
  }): Promise<[REST_API_RESPONSE_STATUS, string, (UserSnapshotResponse | User) & { access_token?: string }]> {
    if (!body || (body.role !== USER_ROLES.CUSTOMER && body.role !== USER_ROLES.ADMIN)) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Body parameters not provided or incorrect`, null];
    }

    const { email, password, name, refId, deviceType, role } = body;

    if (role !== USER_ROLES.CUSTOMER && role !== USER_ROLES.ADMIN) {
      return [REST_API_RESPONSE_STATUS.AUTH_WRONG_ROLE, `Wrong role provided`, null];
    }

    if (!email?.length) {
      return [REST_API_RESPONSE_STATUS.USER_EMAIL_NOT_PROVIDED, `User 'email' not provided`, null];
    }

    if (!password?.length) {
      return [REST_API_RESPONSE_STATUS.PASSWORD_NOT_PROVIDED, `User 'password' not provided`, null];
    }

    // https://trello.com/c/CocM7GZp/9-%D0%BF%D1%80%D0%B0%D0%B2%D0%BA%D0%B8-%D1%80%D0%B5%D1%94%D1%81%D1%82%D1%80%D0%B0%D1%86%D1%96%D1%97
    // if (!name?.length) {
    //   return [REST_API_RESPONSE_STATUS.USER_NAME_NOT_PROVIDED, `User 'name' not provided`, null];
    // }

    let user = await this.redisUser.getUser({ email });
    if (user) {
      const valid = this.validateUserPassword(user, password);
      if (!valid) {
        return [
          REST_API_RESPONSE_STATUS.USER_ALREADY_EXISTS,
          `User ${user.email} already exists. Credentials are not valid`,
          {
            generalInfo: {
              email: user.email,
              emailVerified: user.emailVerified,
            },
          },
        ];
      }

      if (!user.roles || (role === USER_ROLES.CUSTOMER && !user.roles.includes(role))) {
        user.roles = user.roles || [];
        user.roles.push(role);
        await this.redisUser.setUser(user, false);
      }

      if (role === USER_ROLES.ADMIN) {
        if (!(user.roles || []).includes(USER_ROLES.ADMIN)) {
          user.roles = user.roles || [];
          user.roles.push(role);
          user.adminApproved = user.adminApproved ?? false;
          user.emailVerified = user.emailVerified ?? false;
          user.name = user.name || name;
          await this.redisUser.setUser(user, false);
        }
      }

      if (role === USER_ROLES.CUSTOMER) {
        if (!(user.roles || []).includes(USER_ROLES.CUSTOMER)) {
          user.roles = user.roles || [];
          user.roles.push(role);
          user.emailVerified = user.emailVerified ?? false;
          user.referralCode = user.referralCode || refId;
          user.name = user.name || name;
          await this.redisUser.setUser(user, false);
        }
      }
    } else {
      user = await this.redisUser.addNewUser({
        // id: response.data.reg_user_data.user_uid,
        email,
        password: await this.generateHash(password),
        name,
        referralCode: refId,
        roles: [role],
        adminApproved: false,
        emailVerified: false,
      });
    }

    let response;
    if (role === USER_ROLES.ADMIN) {
      delete user.password;
      response = user;
    } else {
      response = (await this.subService.getUserAccountSnapshot(user.id)) || { userId: user.id };
    }

    if (refId) {
      const [refError, refMessage] = await this.subService.addReferral({ userId: user.id, partnerId: refId });
      if (refError !== REST_API_RESPONSE_STATUS.SUCCESS) {
        return [refError, refMessage, null];
      }
    }

    if (user.emailVerified && (role !== USER_ROLES.ADMIN || (role === USER_ROLES.ADMIN && user.adminApproved))) {
      const token = await this.signToken({ user, deviceType, role });
      return [
        REST_API_RESPONSE_STATUS.SUCCESS,
        `success`,
        user
          ? {
              ...response,
              access_token: token,
            }
          : null,
      ];
    } else {
      return [
        REST_API_RESPONSE_STATUS.SUCCESS,
        `success`,
        user
          ? {
              userId: user.id,
              generalInfo: {
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified,
                adminApproved: role === USER_ROLES.ADMIN ? user.adminApproved : undefined,
              },
            }
          : null,
      ];
    }
  }

  async changePassword(params: {
    userId: string;
    newPassword: string;
    oldPassword: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const { userId, newPassword, oldPassword } = params;

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User with id: ${userId} not found`];
    }

    if (!user.password) {
      user.password = await this.generateHash(newPassword);
    } else {
      if (!(await this.checkPassword(oldPassword, user.password))) {
        return [REST_API_RESPONSE_STATUS.PASSWORD_OLD_NOT_VALID, `Old password is not correct`];
      }

      user.password = await this.generateHash(newPassword);
    }

    await this.redisUser.setUser(user);

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`];
  }

  async restorePassword(params: {
    email: string;
    newPassword: string;
    otpCode: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const { email, newPassword, otpCode } = params;

    const user = await this.redisUser.getUser({ email });
    if (!user?.email) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User with email: <${email}> not found`];
    }

    if (!user.password) {
      user.password = await this.generateHash(newPassword);
    } else {
      const code = await this.redisUser.getOtpCode(`${OTP_PREFIX.PASSWORD_VERIFICATION}${email}`);
      if (!code) {
        return [REST_API_RESPONSE_STATUS.OTP_CODE_NOT_FOUND, `OTP code not found`];
      }

      if (code !== otpCode) {
        return [REST_API_RESPONSE_STATUS.OTP_CODE_NOT_VALID, `OTP code is incorrect`];
      }

      user.password = await this.generateHash(newPassword);
    }

    await this.redisUser.setUser(user);

    await this.redisUser.deleteOtpCode(`${OTP_PREFIX.PASSWORD_VERIFICATION}${user.email}`);

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`];
  }

  async adminApproved(
    data: ChangeUsersDto
  ): Promise<[REST_API_RESPONSE_STATUS, string, User & { access_token: string }]> {
    const { userEmail, deviceType } = data;

    if (!userEmail) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Email not provided`, null];
    }

    const user = await this.redisUser.getUser({ email: userEmail });
    if (!user?.email) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User with email: "${userEmail}" not found`, null];
    }

    user.adminApproved = true;
    if (!(user.roles || []).includes(USER_ROLES.ADMIN)) {
      user.roles = [...(user.roles || [])];
      user.roles.push(USER_ROLES.ADMIN);
    }
    await this.redisUser.setUser(user);

    delete user.password;

    const token = await this.signToken({ user, deviceType: deviceType || DEVICE_TYPE.WEB, role: USER_ROLES.ADMIN });

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      {
        ...user,
        access_token: token,
      },
    ];
  }

  async manageOrdersApproved(data: IGetAllUsers): Promise<[REST_API_RESPONSE_STATUS, string, User]> {
    const { userId, userEmail, userPlatformId } = data;

    if (!userId && !userEmail && !userPlatformId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `User ID not provided`, null];
    }

    const user = await this.redisUser.getUser({ email: userEmail, userId, platformId: userPlatformId });
    if (!user?.email) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User "${JSON.stringify(data)}" not found`, null];
    }

    user.allowManageOrders = !user.allowManageOrders;
    await this.redisUser.setUser(user);

    if (user.allowManageOrders) {
      await this.events.addUserEvent({
        userId: user.id,
        type: EVENT_TYPE.USER_MANAGE_ORDERS,
        event: 'Administrator allowed manage orders permission',
      });
    } else {
      await this.events.addUserEvent({
        userId: user.id,
        type: EVENT_TYPE.USER_MANAGE_ORDERS,
        event: 'Administrator denied manage orders permission',
      });
    }

    delete user.password;

    return [REST_API_RESPONSE_STATUS.SUCCESS, `success`, user];
  }

  async emailVerified(params: {
    email: string;
    otpCode: string;
    deviceType: DEVICE_TYPE;
    role: USER_ROLES;
  }): Promise<[REST_API_RESPONSE_STATUS, string, (UserSnapshotResponse | User) & { access_token: string }]> {
    const { email, otpCode, deviceType, role } = params;

    if (!email || !otpCode) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `Email or OTP code not provided`, null];
    }

    const user = await this.redisUser.getUser({ email });
    if (!user?.email) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User with email: <${email}> not found`, null];
    }

    const code = await this.redisUser.getOtpCode(`${OTP_PREFIX.EMAIL_VERIFICATION}${email}`);
    if (!code) {
      return [REST_API_RESPONSE_STATUS.OTP_CODE_NOT_FOUND, `OTP code not found`, null];
    }

    if (code !== otpCode) {
      return [REST_API_RESPONSE_STATUS.OTP_CODE_NOT_VALID, `OTP code is incorrect`, null];
    }

    user.emailVerified = true;
    await this.redisUser.setUser(user);

    await this.redisUser.deleteOtpCode(`${OTP_PREFIX.EMAIL_VERIFICATION}${email}`);

    delete user.password;

    const token = await this.signToken({ user, deviceType: deviceType || DEVICE_TYPE.WEB, role });
    let response;
    if (role === USER_ROLES.ADMIN) {
      delete user.password;
      response = user;
    } else {
      response = (await this.subService.getUserAccountSnapshot(user.id)) || { userId: user.id };
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `success`,
      {
        ...response,
        access_token: token,
      },
    ];
  }

  async removeEmailVerification(userId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    if (!userId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, `User id not provided`];
    }

    const user = await this.redisUser.getUser({ userId });
    if (!user?.id) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, `User with id: ${userId} not found`];
    }

    if (!user?.email) {
      return [REST_API_RESPONSE_STATUS.USER_EMAIL_NOT_FOUND, `User <${userId}> email not found`];
    }

    user.emailVerified = false;
    await this.redisUser.setUser(user);

    return [REST_API_RESPONSE_STATUS.SUCCESS, `Email verification has been reset`];
  }
}
