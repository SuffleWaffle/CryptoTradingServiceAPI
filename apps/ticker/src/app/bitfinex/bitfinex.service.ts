import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { client, connection } from 'websocket';
import { RedisExchangeService, RedisTickerService } from '@cupo/backend/storage';
import { TickerService } from '../common/ticker.service';
import { Dictionary } from 'ccxt';
import { sleep } from '@cupo/backend/constant';

@Injectable()
export class BitfinexService extends TickerService implements OnApplicationBootstrap {
  private books: string[] = [];
  private channels: Dictionary<number> = {};
  private connections: connection[] = [];

  constructor(readonly redisTicker: RedisTickerService, readonly redisExchange: RedisExchangeService) {
    super(redisTicker, redisExchange);

    this.exchangeId = 'bitfinex';
    this.socketAddress = 'wss://api-pub.bitfinex.com/ws/2';
  }

  protected async onCustomMessage(message: any, con?: connection): Promise<boolean> {
    let isTicker: boolean = false;

    // {
    //   "event": "subscribed",
    //   "channel": "ticker",
    //   "chanId": 142395,
    //   "symbol": "tETHUSD",
    //   "pair": "ETHUSD"
    // }
    if (Array.isArray(message) && message.length === 2 && message[1] === 'hb') {
      return isTicker;
    }

    if (message?.event === 'error') {
      Logger.warn(`[${this.exchangeId}] WS Error ${message?.msg}. Code: ${JSON.stringify(message)}`);
      return isTicker;
    }

    if (message?.event === 'info') {
      // Logger.warn(`[${this.exchangeId}] WS Info: ${JSON.stringify(message)}`);
      return isTicker;
    }

    if (message.event === 'subscribed' && message.channel === 'ticker') {
      // Logger.debug(`[${this.exchangeId}] Subscribed to ${message.symbol} with chanId ${message.chanId}`);
      this.channels[message.chanId] = message.pair;
      return isTicker;
    }

    // https://docs.bitfinex.com/reference/ws-public-ticker
    // [151420,[16954,54.39531984,16955,43.15294393,-2,-0.0001,16954,627.51253377,17083,16865]]
    if (
      Array.isArray(message) &&
      message.length === 2 &&
      Array.isArray(message[1]) &&
      message[1]?.length === 10 &&
      this.channels[message[0]]
    ) {
      isTicker = true;

      const ticker = message[1];

      const symbolId = this.channels[message[0]];

      if (!Object.getOwnPropertyDescriptor(this.symbolIds, symbolId)) {
        return isTicker;
      }

      const symbol = this.symbolIds[symbolId];

      // [
      //   CHANNEL_ID,
      //   [
      //     BID,
      //     BID_SIZE,
      //     ASK,
      //     ASK_SIZE,
      //     DAILY_CHANGE,
      //     DAILY_CHANGE_RELATIVE,
      //     LAST_PRICE,
      //     VOLUME,
      //     HIGH,
      //     LOW
      //   ]
      // ]
      const timestamp = Date.now();
      this.tickers[symbol] = {
        symbol,
        timestamp,
        datetime: new Date(timestamp).toISOString(),
        high: 0,
        low: 0,
        bid: +ticker[0] ?? 0,
        bidVolume: +ticker[1] ?? 0,
        ask: +ticker[2] ?? 0,
        askVolume: +ticker[3] ?? 0,
        open: 0,
        close: 0,
        last: 0,
        info: ticker,
      };
    } else {
      Logger.warn(`[${this.exchangeId}] Unknown message: ${JSON.stringify(message)}`);
    }

    return isTicker;
  }

  async onSubConnect(connection: connection, books: string[]): Promise<void> {
    this.connections.push(connection);
    Logger.debug(`[${this.exchangeId}] SubClient Connected: ${books.length}`);

    connection.on('message', (message) => this.onMessage(message, connection));
    connection.on('error', (error) => {
      Logger.warn(`[${this.exchangeId}] SubConnection error: ${error.toString()}`);
    });
    connection.on('close', () => {
      Logger.warn(`[${this.exchangeId}] SubConnection Closed`);
    });
    connection.on('ping', (cancel: () => void, binaryPayload: Buffer) => {
      connection.pong(binaryPayload);
    });

    for (const book of books) {
      connection.send(
        JSON.stringify({
          event: 'subscribe',
          channel: 'ticker',
          pair: `t${book}`,
        })
      );
      await sleep(50);
    }
  }

  initSubConnection(books: string[]): void {
    const ws = new client();
    ws.on('connectFailed', (error) => this.connectFailed(error));
    ws.on('connect', (connection) => this.onSubConnect(connection, books));

    ws.connect(this.socketAddress);
  }

  protected async onCustomConnectionClosed(): Promise<void> {
    this.connections.forEach((connection) => {
      if (connection?.connected) {
        connection.close();
      }
    });
    this.connections = [];

    Logger.warn(`[${this.exchangeId}] Connection Closed`);
  }

  async subscribeNextMarket(index: number = 0): Promise<void> {
    const markets = Object.keys(this.markets);
    if (!this.connection?.connected) {
      return;
    }

    if (index < markets.length) {
      const symbol = markets[index];
      // Logger.debug(`[${this.exchangeId}] Subscribing to ${symbol} ${this.markets[symbol].id}`);

      this.books.push(this.markets[symbol].id);

      if (this.books.length === 30) {
        this.initSubConnection(this.books);
        this.books = [];
      }

      this.subscribeNextMarket(index + 1).then();
    } else {
      if (this.books.length) {
        this.initSubConnection(this.books);
        this.books = [];
      }
    }
  }

  protected async onAfterConnect(connection: connection): Promise<void> {
    await this.subscribeNextMarket();

    // Object.keys(this.markets).forEach((symbol) => {
    //   // const [base, quote] = CcxtService.getCurrenciesFromSymbol(symbol);
    //   // const baseCurrency = CcxtService.getBaseCurrencyFromSymbol(this.exchangeId, symbol);
    //   // if (EXCLUDED_CURRENCIES.indexOf(base) < 0 && EXCLUDED_CURRENCIES.indexOf(quote) < 0 && (baseCurrency === base || baseCurrency === quote)) {
    //   //   books.push(this.markets[symbol].id);
    //   // }
    //
    //   this.books.push(this.markets[symbol].id);
    //
    //   if (this.books.length === 25) {
    //     this.initSubConnection(this.books);
    //     this.books = [];
    //   }
    // });
    //
    // if (this.books.length) {
    //   this.initSubConnection(this.books);
    // }
  }
}
