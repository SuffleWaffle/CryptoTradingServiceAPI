import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { USER_NOTIFICATION } from '@cupo/backend/interface';

@Injectable()
export class RedisNotificationService extends RedisService {
  constructor() {
    super(REDIS_ENTITY_TYPE.NOTIFICATION);
  }

  async setLastUserNotification(userId: string, type: USER_NOTIFICATION, expire?: number): Promise<void> {
    await this.setKey(this.getNotificationKey(userId, type), Date.now().toString(), expire);
  }

  async getLastUserNotification(userId: string, type: USER_NOTIFICATION): Promise<number | null> {
    const notifyHash = await this.getKey(this.getNotificationKey(userId, type));

    return notifyHash?.length ? +notifyHash : null;
  }
}
