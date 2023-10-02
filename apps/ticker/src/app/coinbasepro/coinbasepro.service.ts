import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { connection } from 'websocket';
import { RedisExchangeService, RedisTickerService } from '@cupo/backend/storage';
import { TickerService } from '../common/ticker.service';

@Injectable()
export class CoinbaseproService extends TickerService implements OnApplicationBootstrap {
  constructor(readonly redisTicker: RedisTickerService, readonly redisExchange: RedisExchangeService) {
    super(redisTicker, redisExchange);

    this.exchangeId = 'coinbasepro';
    this.socketAddress = 'wss://ws-feed.exchange.coinbase.com';
  }

  protected async onAfterConnect(connection: connection): Promise<void> {
    const symbols = Object.keys(this.symbolIds);

    // {
    //   "type": "subscribe",
    //   "product_ids": [
    //   "ETH/USD",
    //   "ETH/EUR"
    // ],
    //   "channels": [
    //   "level2",
    //   "heartbeat",
    //   {
    //     "name": "ticker",
    //     "product_ids": [
    //       "ETH-BTC",
    //       "ETH-USD"
    //     ]
    //   }
    // ]
    // }

    connection.send(
      JSON.stringify({
        type: 'subscribe',
        product_ids: symbols,
        channels: [
          'level2',
          'heartbeat',
          {
            name: 'ticker',
            product_ids: symbols,
          },
        ],
      })
    );
  }

  protected async onCustomMessage(message: any): Promise<boolean> {
    let isTicker: boolean = false;
    if (message?.type === 'ticker') {
      isTicker = true;

      const ticker = message;

      const symbolId = message.product_id;

      if (!Object.getOwnPropertyDescriptor(this.symbolIds, symbolId)) {
        return;
      }

      const symbol = this.symbolIds[symbolId];

      // {
      //   "type": "ticker",
      //   "sequence": 36037175096,
      //   "product_id": "ETH-USD",
      //   "price": "1597.97",
      //   "open_24h": "1708.85",
      //   "volume_24h": "449075.47825859",
      //   "low_24h": "1552.88",
      //   "high_24h": "1761.04",
      //   "volume_30d": "10795114.17686103",
      //   "best_bid": "1597.81",
      //   "best_ask": "1597.99",
      //   "side": "buy",
      //   "time": "2022-09-14T02:56:21.156712Z",
      //   "trade_id": 354661847,
      //   "last_size": "3.2"
      // }
      const timestamp = Date.now();
      this.tickers[symbol] = {
        symbol,
        timestamp: new Date(timestamp).getTime(),
        datetime: ticker.time,
        high: 0,
        low: 0,
        bid: +ticker.best_bid || 0,
        bidVolume: +ticker.last_size || 0,
        ask: +ticker.best_ask || 0,
        askVolume: +ticker.last_size || 0,
        open: 0,
        close: 0,
        last: 0,
        info: ticker,
      };
    }

    return isTicker;
  }
}
