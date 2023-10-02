import { Injectable } from '@nestjs/common';
import { RedisLogService } from '@cupo/backend/storage/src/lib/redis/redis.log.service';
import { LogRecordType } from '@cupo/backend/interface';

@Injectable()
export class LogService {
  constructor(private readonly log: RedisLogService) {}

  async getLog(): Promise<LogRecordType[]> {
    const log: LogRecordType[] = await this.log.getLog();

    return log.map((rec) => ({ ...rec, timestampHuman: new Date(+rec.timestamp) }));
  }

  async getLogRecord(timestamp: number): Promise<LogRecordType | null> {
    return this.log.getLogRecord(timestamp);
  }
}
