import { Injectable } from '@nestjs/common';
import { PlatformMongodbService } from '@cupo/backend/storage';

@Injectable()
export class MarketingService {
  constructor(private readonly mongo: PlatformMongodbService) {}

  async getReferralCodes(): Promise<any[]> {
    return await this.mongo.getReferralCodes();
  }

  async saveReferralCode(data: any): Promise<void> {
    await this.mongo.saveReferralCode(data);
  }
}
