import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EVENT_TYPE } from '@cupo/backend/interface';
import { getIPAddress } from '@cupo/backend/constant';
import { EventService } from '@cupo/event';
import { ExchangeLibService } from '@cupo/exchange';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private readonly exchange: ExchangeLibService, private readonly event: EventService) {}

  async onApplicationBootstrap() {
    await this.event.addSystemEvent({
      type: EVENT_TYPE.APP_STARTED,
      event: `${process.env.APP_NAME} started`,
      data: {
        feederIp: getIPAddress(),
      },
    });
  }

  getData(): { message: string } {
    return { message: `FEEDER OK: ${process.uptime()}` };
  }
}
