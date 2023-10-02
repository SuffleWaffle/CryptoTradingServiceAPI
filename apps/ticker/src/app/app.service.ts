import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RedisTickerService } from '@cupo/backend/storage';
import { ENABLED_EXCHANGES, getIPAddress, TICKER_EXCHANGES_COUNT } from '@cupo/backend/constant';
import { Cron } from '@nestjs/schedule';
import { EventService } from '@cupo/event';
import { EVENT_TYPE } from '@cupo/backend/interface';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private isMainFeeder = false;
  private readonly feederId;
  private enabledExchanges: string[] = [];

  constructor(private readonly redisTicker: RedisTickerService, private readonly event: EventService) {
    this.feederId = getIPAddress();

    if (process.env.TICKER_ENABLED_EXCHANGES?.length) {
      this.enabledExchanges = process.env.TICKER_ENABLED_EXCHANGES.split(',');
    } else {
      this.enabledExchanges = Object.keys(ENABLED_EXCHANGES);
    }
  }

  async onApplicationBootstrap() {
    const mainFeederHash = await this.redisTicker.getMainTickerFeeder();

    if (mainFeederHash?.length) {
      const mainFeeder = JSON.parse(mainFeederHash);
      // reset old main feeder
      if (mainFeeder.timestamp < Date.now() - 1000 * 60) {
        await this.redisTicker.resetMainTickerFeeder();
      }
    }

    await this.event.addSystemEvent({
      type: EVENT_TYPE.APP_STARTED,
      event: `${process.env.APP_NAME} started`,
      data: {
        feederId: this.feederId,
        isMainFeeder: this.isMainFeeder,
      },
    });
  }

  getData(): { message: string } {
    return { message: `TICKER OK: ${process.uptime()}` };
  }

  haltApplication() {
    Logger.warn(`*** Halt ticker app ${getIPAddress()}`);
    process.exitCode = 0;
    process.exit(0);
  }

  async addExchange(exchangeId: string): Promise<void> {
    if (!this.isMainFeeder) {
      return;
    }

    this.enabledExchanges = this.enabledExchanges || Object.keys(ENABLED_EXCHANGES);

    if (this.enabledExchanges.includes(exchangeId)) {
      return;
    }

    this.enabledExchanges.push(exchangeId);
    await this.redisTicker.resetMainTickerFeeder();
  }

  async removeExchange(exchangeId: string): Promise<void> {
    if (!this.isMainFeeder) {
      return;
    }

    this.enabledExchanges = this.enabledExchanges || Object.keys(ENABLED_EXCHANGES);

    if (this.enabledExchanges.includes(exchangeId)) {
      this.enabledExchanges = this.enabledExchanges.filter((id) => id !== exchangeId);
      await this.redisTicker.resetMainTickerFeeder();
    }
  }

  getNextFeeder(feeders: { [id: string]: number }): string | null {
    for (const feederId of Object.keys(feeders)) {
      if (feeders[feederId] < TICKER_EXCHANGES_COUNT) {
        return feederId;
      }
    }

    return null;
  }

  async getEnabledExchanges(): Promise<string[]> {
    const exc = [],
      promises = [];
    for (const exchangeId of this.enabledExchanges || []) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(
            async (exchangeId) => {
              exc.push(exchangeId);
              resolve(undefined);
            },
            Math.random() * 100,
            exchangeId
          );
        })
      );
    }

    await Promise.all(promises);

    return exc;
  }

  @Cron('*/5 * * * * *')
  async runRoulette() {
    // only main feeder can update tickers and mange feeders
    if (!this.isMainFeeder) {
      return;
    }

    let feeders = await this.redisTicker.getTickerFeeders();
    for (const exchangeId of Object.keys(ENABLED_EXCHANGES)) {
      if (feeders && feeders[exchangeId]) {
        if (feeders[exchangeId].timestamp && feeders[exchangeId].timestamp < Date.now() - 1000 * 60) {
          Logger.warn(`--- Feeder ${feeders[exchangeId].id} [${exchangeId}] is dead`);
          await this.redisTicker.feederLostExchange(exchangeId, this.feederId);

          // update feeders list
          feeders = await this.redisTicker.getTickerFeeders();
        }

        await this.redisTicker.clearTickers(exchangeId);
      }
    }

    const availableFeeders = await this.redisTicker.getAvailableTickerFeeders();
    const feedersCount = {};

    for (const feederId of Object.keys(availableFeeders || {})) {
      if (!feedersCount[feederId]) {
        feedersCount[feederId] = 0;
      }
    }

    const exchanges = await this.getEnabledExchanges();
    for (const exchangeId of exchanges) {
      let hasFeeder = false;

      for (const feederExchangeId of Object.keys(feeders || {})) {
        if (feederExchangeId === exchangeId) {
          feedersCount[feeders[feederExchangeId].id] += 1;
          hasFeeder = true;
        }
      }

      if (!hasFeeder) {
        const nextFeeder = this.getNextFeeder(feedersCount);

        if (nextFeeder) {
          await this.redisTicker.setTickerFeeder(exchangeId, nextFeeder);
          feedersCount[nextFeeder] += 1;
        } else {
          Logger.warn(`No available feeder for ${exchangeId}`);
        }
      }
    }
  }

  @Cron('*/3 * * * * *')
  async setAvailableTickerFeeder(): Promise<void> {
    this.isMainFeeder = await this.redisTicker.setMainTickerFeeder(this.feederId);
    if (this.isMainFeeder) {
      await this.redisTicker.clearAvailableTickerFeeder();
    }

    await this.redisTicker.setAvailableTickerFeeder(this.feederId);
  }
}
