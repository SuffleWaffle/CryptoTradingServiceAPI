import { Injectable } from '@nestjs/common';
import { AccountMongodbService } from '@cupo/backend/storage';
import {
  PAYOUT_PROFILE_STATUS,
  PAYOUT_PROFILE_TYPE,
  PayoutRequestStatus,
  REST_API_RESPONSE_STATUS,
} from '@cupo/backend/constant';
import { PayoutProfile } from '@cupo/backend/interface';

@Injectable()
export class PayoutService {
  constructor(private readonly mongo: AccountMongodbService) {}

  async getPayoutRequests(props?: { status?: PayoutRequestStatus; userId?: string }): Promise<any[]> {
    return await this.mongo.getPayoutRequests(props);
  }

  async addPayoutRequest(data: {
    userId: string;
    sum: number;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, object]> {
    const answer = await this.mongo.addPayoutRequest({
      ...data,
    });

    if (typeof answer === 'string') {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, answer, null];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Payout request added', answer];
  }

  async cancelPayoutRequest(props: {
    requestId: string;
    userId: string;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const answer = await this.mongo.cancelPayoutRequest(props);
    if (typeof answer === 'string') {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, answer];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Payout request canceled'];
  }

  async deletePayoutRequest(requestId: string): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const answer = await this.mongo.deletePayoutRequest(requestId);
    if (typeof answer === 'string') {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, answer];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Payout request deleted'];
  }

  async changePayoutRequestStatus(props: {
    requestId: string;
    userId: string;
    requestStatus: PayoutRequestStatus;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string]> {
    const answer = await this.mongo.changePayoutRequestStatus(props);
    if (typeof answer === 'string') {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, answer];
    }

    return [REST_API_RESPONSE_STATUS.SUCCESS, 'Payout request status changed'];
  }

  //***********************
  //*** PAYOUT PROFILE ***
  //***********************
  async getUserPayoutProfile(userId: string): Promise<[REST_API_RESPONSE_STATUS, string, PayoutProfile[]]> {
    const profiles = await this.mongo.getAllPayoutProfiles(userId);
    if (typeof profiles === 'string') {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, profiles, null];
    }

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      'Payout profiles',
      profiles.map((profile) => {
        const newProfile = {
          ...profile,
          profileId: profile._id.toString(),
        };
        delete newProfile._id;

        return newProfile;
      }),
    ];
  }

  async changePayoutProfile(props: {
    userId: string;
    profileId: string;
    description?: string;
    firstName?: string;
    lastName?: string;
    paypalEmail?: string;
    phone?: string;
    status: PAYOUT_PROFILE_STATUS;
    comment?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, PayoutProfile]> {
    const { userId, profileId, status } = props;

    // if (status === PAYOUT_PROFILE_STATUS.ACTIVE) {
    //   return [REST_API_RESPONSE_STATUS.PARAMETER_WRONG_PROVIDED, 'Can not change status to ACTIVE', null];
    // }

    let profile = await this.mongo.getPayoutProfile({
      profileId,
      userId,
    });
    if (!profile) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, 'Profile not found', null];
    }

    const answer = await this.mongo.changePayoutProfile(props);
    if (typeof answer === 'string') {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, answer, null];
    }

    profile = await this.mongo.getPayoutProfile({
      profileId,
      userId,
    });
    if (!profile) {
      return [REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND, `Can't find payout profile <${profileId}>`, null];
    }

    profile.profileId = profile._id.toString();
    delete profile._id;

    return [
      REST_API_RESPONSE_STATUS.SUCCESS,
      `Request [${profileId}] status changed to ${status || PAYOUT_PROFILE_STATUS.PENDING}`,
      profile,
    ];
  }

  async addPayoutProfile(props: {
    userId: string;
    type: PAYOUT_PROFILE_TYPE;
    description?: string;
    comment?: string;
    firstName?: string;
    lastName?: string;
    paypalEmail?: string;
    phone?: string;
  }): Promise<[REST_API_RESPONSE_STATUS, string, PayoutProfile]> {
    const { userId, type, description, comment, firstName, lastName, paypalEmail, phone } = props;

    try {
      const timestamp = new Date();
      const response = await this.mongo.addPayoutProfile({
        userId,
        type,
        description,
        comment,
        firstName,
        lastName,
        paypalEmail,
        phone,
        status: PAYOUT_PROFILE_STATUS.PENDING,
        create: timestamp,
        update: timestamp,
      });
      if (!response.acknowledged || !response.insertedId) {
        return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, "Can't add payout profile", null];
      }

      const profile = await this.mongo.getPayoutProfile({
        profileId: response.insertedId.toString(),
        userId,
      });

      if (!profile) {
        return [
          REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND,
          `Can't find payout profile <${response.insertedId?.toString()}>`,
          null,
        ];
      }

      profile.profileId = profile._id.toString();
      delete profile._id;

      return [
        REST_API_RESPONSE_STATUS.SUCCESS,
        `Created the payout profile [${profile?.profileId}] status changed to ${PAYOUT_PROFILE_STATUS.PENDING}`,
        profile,
      ];
    } catch (err) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, err.message, null];
    }
  }
}
