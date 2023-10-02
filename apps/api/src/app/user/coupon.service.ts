import { Injectable } from '@nestjs/common';
import { REST_API_RESPONSE_STATUS, userRepresentation } from '@cupo/backend/constant';
import { PlatformMongodbService, RedisUserService } from '@cupo/backend/storage';
import { SubscriptionService } from '@cupo/backend/services';
import { Coupon } from '@cupo/backend/interface';

@Injectable()
export class CouponService {
  constructor(
    private readonly subService: SubscriptionService,
    private readonly redisUser: RedisUserService,
    private readonly mongo: PlatformMongodbService
  ) {}

  //***************
  //*** COUPONS ***
  //***************

  async getCoupons(): Promise<[REST_API_RESPONSE_STATUS, string, Coupon[] | null]> {
    const coupons = await this.mongo.getCoupons();

    if (coupons) {
      return [REST_API_RESPONSE_STATUS.SUCCESS, 'Coupons found', coupons];
    }

    return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, 'Coupons not found', null];
  }

  async addNewCoupon(data: Coupon): Promise<[REST_API_RESPONSE_STATUS, string, string | null]> {
    if (!data?.id) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, 'Coupon id is required', null];
    }

    const coupon = await this.mongo.getCoupon(data.id);
    if (coupon) {
      return [REST_API_RESPONSE_STATUS.ENTITY_ALREADY_EXISTS, `Coupon ${data.id} already exists`, null];
    }

    const couponId = await this.mongo.addNewCoupon(data);

    if (couponId) {
      return [REST_API_RESPONSE_STATUS.SUCCESS, `Coupon ${data?.id || ''} added`, couponId];
    }

    return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, 'Coupon not added', null];
  }

  async addUserCoupon(data: {
    id: string;
    userId: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, string[] | null]> {
    const { id, userId } = data;

    if (!id) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, 'Coupon id is required', null];
    }

    if (!userId) {
      return [REST_API_RESPONSE_STATUS.PARAMETER_NOT_PROVIDED, 'User id is required', null];
    }

    let user = await this.redisUser.getUser({ userId });
    if (!user) {
      return [REST_API_RESPONSE_STATUS.USER_NOT_FOUND, 'User not found', null];
    }

    const coupon = await this.mongo.getCoupon(id);
    if (!coupon) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, `Coupon ${id} not found`, null];
    }

    user.activatedCoupons = user.activatedCoupons || [];
    if (!user.activatedCoupons.includes(id)) {
      user.activatedCoupons.push(id);
    }

    user = await this.redisUser.setUser(user);
    if (!user) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, 'User not updated', null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `Coupon activated for user ${userRepresentation(user)}`,
      user.activatedCoupons,
    ];
  }

  async activateCoupon(): Promise<string> {
    return 'Not implemented';
  }

  async deactivateCoupon(): Promise<string> {
    return 'Not implemented';
  }
}
