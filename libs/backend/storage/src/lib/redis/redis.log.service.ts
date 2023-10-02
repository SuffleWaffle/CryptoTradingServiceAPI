import { Injectable } from '@nestjs/common';
import { REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { LogRecordType } from '@cupo/backend/interface/src/lib/log.interface';
import { RedisService } from './redis.service';

@Injectable()
export class RedisLogService extends RedisService {
  lastUpdate = 0;
  storeLogPeriod = 1000 * 60 * 60 * 24 * 7;
  storeLogLength = 2048;

  constructor() {
    super(REDIS_ENTITY_TYPE.LOG);

    this.clearLog().then();
  }

  async getLog(): Promise<LogRecordType[]> {
    const log = await this.getHash(this.getLogKey());
    const res: LogRecordType[] = [];

    if (log) {
      Object.keys(log).forEach((timestamp) => {
        res.push(JSON.parse(log[timestamp]));
      });
    }

    return res.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getLogRecord(timestamp: number): Promise<LogRecordType | null> {
    const rec = await this.getHashValue(this.getLogKey(), timestamp.toString());

    return rec ? JSON.parse(rec) : null;
  }

  async clearLog(): Promise<void> {
    let log = await this.getHash(this.getLogKey());

    if (log) {
      const now = new Date().getTime();
      const keys: string[] = Object.keys(log).filter((timestamp) => +timestamp < now - this.storeLogPeriod);

      if (keys?.length) {
        await this.deleteHashValues(this.getLogKey(), keys);
      }
    }

    log = await this.getHash(this.getLogKey());
    if (Object.keys(log || {}).length > this.storeLogLength) {
      const keys = Object.keys(log)
        .sort((a, b) => +b - +a)
        .slice(this.storeLogLength);

      if (keys?.length) {
        await this.deleteHashValues(this.getLogKey(), keys);
      }
    }
  }
}
