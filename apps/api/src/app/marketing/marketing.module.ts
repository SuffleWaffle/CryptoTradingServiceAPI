import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { MarketingController } from './marketing.controller';

@Module({
  providers: [MarketingService],
  controllers: [MarketingController],
})
export class MarketingModule {}
