import { Controller, Get, Headers, HostParam, HttpException, HttpStatus, Ip, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { HTTP_RESPONSE } from '@cupo/backend/interface';
import { MarketingService } from './marketing.service';

@ApiTags('crm', 'marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly service: MarketingService) {}

  @Public()
  @Get('referral/:referralCode')
  @ApiOperation({
    description: 'Save the referral code to MongoDB',
    parameters: [
      { name: 'referralCode', in: 'path', schema: { type: 'string' } },
      { name: 'redirect', in: 'query', schema: { type: 'string' } },
    ],
  })
  async saveReferralCode(
    @Param('referralCode') referralCode: string,
    @Query('redirect') redirect: string,
    @HostParam() hosts,
    @Query() query,
    @Res() res,
    @Headers() headers,
    @Ip() ip
  ): Promise<void> {
    await this.service.saveReferralCode({
      referralCode,
      hosts,
      query,
      headers,
      ip,
      timestamp: new Date().toISOString(),
    });

    if (redirect?.length) {
      return res.status(302).redirect(`${redirect.indexOf('http') >= 0 ? '' : 'http://'}${redirect}`);
    } else {
      return res.status(302).redirect(`https://app.cupocoin.com?referralCode=${referralCode}`);
    }
  }

  @Get('referrals')
  @ApiOperation({
    description: 'Get last referral codes from the DB',
  })
  async getReferralCodes(): Promise<HTTP_RESPONSE<object[]>> {
    const codes = await this.service.getReferralCodes();

    if (codes) {
      return {
        statusCode: HttpStatus.OK,
        length: codes.length,
        data: codes,
      };
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND,
        message: 'No referral codes found',
      } as HTTP_RESPONSE<void>,
      HttpStatus.NOT_FOUND
    );
  }
}
