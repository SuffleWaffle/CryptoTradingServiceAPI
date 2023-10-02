import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { RedisOrderService, RedisUserService } from '@cupo/backend/storage';
import { getIPAddress } from '@cupo/backend/constant';
import { EVENT_TYPE } from '@cupo/backend/interface';
import { EventService } from '@cupo/event';
import { ExchangeLibService } from '@cupo/exchange';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private isMainManager = false;
  private feederIp = getIPAddress();

  constructor(
    private readonly exchange: ExchangeLibService,
    private readonly event: EventService,
    private readonly redisUser: RedisUserService,
    private readonly redisOrder: RedisOrderService
  ) {}

  async onApplicationBootstrap() {
    await this.event.addSystemEvent({
      type: EVENT_TYPE.APP_STARTED,
      event: `${process.env.APP_NAME} started`,
      data: {
        feederIp: this.feederIp,
      },
    });

    setTimeout(async () => {
      await this.setMainOrderManager();
    }, 1000 * Math.random() + 1000);
  }

  getData(): { message: string } {
    return { message: `TRADER OK: ${process.uptime()}` };
  }

  async setMainOrderManager(): Promise<boolean> {
    this.isMainManager = await this.redisOrder.setMainOrderManager(this.feederIp);

    setTimeout(async () => {
      await this.setMainOrderManager();
    }, 1000 * Math.random() + 1000);

    return this.isMainManager;
  }
}
