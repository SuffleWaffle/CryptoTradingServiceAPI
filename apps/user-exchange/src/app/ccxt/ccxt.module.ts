import { Module } from '@nestjs/common';
import { MailModule } from '@cupo/mail';
import { CcxtService } from './ccxt.service';

@Module({
  controllers: [],
  imports: [MailModule],
  providers: [CcxtService],
  exports: [CcxtService],
})
export class CcxtModule {}
