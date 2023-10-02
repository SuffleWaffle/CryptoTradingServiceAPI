import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { connection } from 'websocket';
import { RedisExchangeService, RedisTickerService } from '@cupo/backend/storage';
import { TickerService } from '../common/ticker.service';
import { EXCHANGE_TICKERS_EXPIRATION } from '@cupo/backend/constant';

@Injectable()
export class BitsoService extends TickerService implements OnApplicationBootstrap {
  constructor(readonly redisTicker: RedisTickerService, readonly redisExchange: RedisExchangeService) {
    super(redisTicker, redisExchange);

    this.exchangeId = 'bitso';
    this.socketAddress = 'wss://ws.bitso.com';
  }

  protected async onAfterConnect(connection: connection): Promise<void> {
    Object.keys(this.symbolIds).forEach((book) => {
      connection.send(JSON.stringify({ action: 'subscribe', book, type: 'orders' }));
    });
  }

  protected async onCustomMessage(message: any): Promise<boolean> {
    let isTicker: boolean = false;
    if (message.type === 'orders' && message.book?.length && message.payload?.asks && message.payload?.bids) {
      isTicker = true;

      if (!Object.getOwnPropertyDescriptor(this.symbolIds, message.book)) {
        return isTicker;
      }

      const symbol = this.symbolIds[message.book];

      // const [baseId, quoteId] = data.book.split('_');
      // const symbol = `${baseId.toUpperCase()}/${quoteId.toUpperCase()}`;

      const asks = message.payload.asks;
      const bids = message.payload.bids;

      const tickers: {
        ask: {
          o: string;
          r: number;
          a: number;
          v: number;
          t: number;
          d: number;
        };
        bid: {
          o: string;
          r: number;
          a: number;
          v: number;
          t: number;
          d: number;
        };
      } = {
        ask: asks.reduce((prev, curr) => (curr.r < prev.r ? curr : prev), { r: Infinity }),
        bid: bids.reduce((prev, curr) => (curr.r > prev.r ? curr : prev), { r: 0 }),
      };

      const timestamp = Math.max(+tickers.ask.d || 0, +tickers.bid.d || 0) || Date.now();
      if (timestamp > Date.now() - EXCHANGE_TICKERS_EXPIRATION) {
        this.tickers[symbol] = {
          symbol,
          timestamp: timestamp,
          datetime: new Date(timestamp).toISOString(),
          high: 0,
          low: 0,
          bid: +tickers.bid.r,
          bidVolume: +tickers.bid.a,
          ask: +tickers.ask.r,
          askVolume: +tickers.ask.a,
          open: 0,
          close: +tickers.bid.r,
          last: +tickers.bid.r,
          info: tickers,
        };
      }
    }

    return isTicker;
  }
}
