import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { RedisExchangeService, RedisTickerService } from '@cupo/backend/storage';
import { TickerService } from '../common/ticker.service';

@Injectable()
export class BinanceService extends TickerService implements OnApplicationBootstrap {
  constructor(readonly redisTicker: RedisTickerService, readonly redisExchange: RedisExchangeService) {
    super(redisTicker, redisExchange);

    this.exchangeId = 'binance';
    this.socketAddress = 'wss://stream.binance.com:9443/ws/!ticker@arr';
  }

  protected async onCustomMessage(message: any): Promise<boolean> {
    let isTicker: boolean = false;
    if (Array.isArray(message) && message.length && message[0].e === '24hrTicker') {
      isTicker = true;
      for (const ticker of message) {
        if (!ticker.a || !ticker.b) {
          continue;
        }

        if (!Object.getOwnPropertyDescriptor(this.symbolIds, ticker.s)) {
          continue;
        }

        const symbol = this.symbolIds[ticker.s];
        const timestamp = +ticker.E || Date.now();

        if (this.tickers?.[symbol]?.timestamp || 0 <= +ticker.E || 0) {
          this.tickers[symbol] = {
            symbol,
            timestamp: timestamp,
            datetime: new Date(timestamp).toISOString(),
            high: +ticker.h || 0,
            low: +ticker.l || 0,
            bid: +ticker.b || 0,
            bidVolume: +ticker.B || 0,
            ask: +ticker.a || 0,
            askVolume: +ticker.A || 0,
            open: +ticker.o || 0,
            close: +ticker.c || 0,
            last: +ticker.c || 0,
            info: ticker,
          };
        }
      }
    }

    return isTicker;
  }
}
