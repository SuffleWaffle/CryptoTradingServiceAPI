import { Global, Module } from '@nestjs/common';

import { RedisNotificationService } from './redis.notification.service';
import { RedisIndicatorsService } from './redis.indicators.service';
import { RedisExchangeService } from './redis.exchange.service';
import { RedisSessionService } from './redis.session.service';
import { RedisCandleService } from './redis.candle.service';
import { RedisTickerService } from './redis.ticker.service';
import { RedisOrderService } from './redis.order.service';
import { RedisUserService } from './redis.user.service';
import { RedisLogService } from './redis.log.service';

@Global()
@Module({
  providers: [
    RedisIndicatorsService,
    RedisCandleService,
    RedisTickerService,
    RedisExchangeService,
    RedisOrderService,
    RedisUserService,
    RedisLogService,
    RedisSessionService,
    RedisNotificationService,
  ],
  exports: [
    RedisIndicatorsService,
    RedisCandleService,
    RedisTickerService,
    RedisExchangeService,
    RedisOrderService,
    RedisUserService,
    RedisLogService,
    RedisSessionService,
    RedisNotificationService,
  ],
})
export class RedisModule {}
