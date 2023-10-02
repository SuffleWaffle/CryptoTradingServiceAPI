import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { DEVICE_TYPE, JwtToken } from '@cupo/backend/interface/src/lib/jwt-token.interface';

@Injectable()
export class RedisSessionService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.SESSION);
  }

  async setJWTToken(userId: string, token: JwtToken): Promise<void> {
    await this.setHash(this.getSessionKey(userId), { [token.sessionId]: JSON.stringify(token) });
  }

  async getJWTToken(userId: string, sessionId: string): Promise<JwtToken | null> {
    const userExists = this.existsHashValue(this.getSessionKey(userId), sessionId);
    if (!userExists) {
      return null;
    }

    const hash = await this.getHashValue(this.getSessionKey(userId), sessionId);

    return hash ? JSON.parse(hash) : null;
  }

  async existsJWTToken(userId: string, sessionId: string): Promise<boolean> {
    return this.existsHashValue(this.getSessionKey(userId), sessionId);
  }

  async removeUserSession(userId: string, deviceType?: DEVICE_TYPE): Promise<void> {
    const hash = await this.getHash(this.getSessionKey(userId));

    if (!hash) {
      return;
    }

    const tokens = Object.keys(hash);
    for (const key of tokens) {
      const token = JSON.parse(hash[key]);
      if (!deviceType || token.deviceType === deviceType) {
        await this.deleteHashValue(this.getSessionKey(userId), key);
      }
    }
  }
}
