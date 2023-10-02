import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { client, connection, Message } from 'websocket';
import { Dictionary, Market, Ticker } from 'ccxt';
import { RedisExchangeService, RedisTickerService } from '@cupo/backend/storage';
import { getIPAddress, SAVE_TICKERS_TIMEOUT } from '@cupo/backend/constant';
import { Cron } from '@nestjs/schedule';
import * as pako from 'pako';

export class TickerService extends client implements OnApplicationBootstrap {
  protected exchangeId: string;
  protected feederId: string;

  protected connection: connection;
  protected connected: boolean;
  protected reconnecting: boolean;

  protected socketAddress: string;
  private lastUpdate = 0;
  protected allowToConnect: boolean;

  protected markets: Dictionary<Market> = {};
  protected symbolIds: Dictionary<string> = {};
  protected tickers: Dictionary<Ticker> = {};

  constructor(
    protected readonly redisTicker: RedisTickerService,
    protected readonly redisExchange: RedisExchangeService
  ) {
    super();

    this.feederId = getIPAddress();

    this.connected = false;
    this.reconnecting = false;

    this.initWebsocket();
  }

  async onApplicationBootstrap() {
    // this.redisTicker.subscribeGetExchangeToFeedTickers();
    // this.redisTicker.subscriber.addListener('message', (channel, message) =>
    //   this.onMessageHasExchangeToFeedTickers(channel, message)
    // );

    this.allowToConnect = true;
    await this.onCustomApplicationBootstrap();
  }

  protected async onCustomApplicationBootstrap(): Promise<void> {
    return;
  }

  protected async onCustomConnectionError(error): Promise<void> {
    Logger.error(`[${this.exchangeId}] Connection Error: ${error.toString()}`);
  }

  private async onConnectionError(error): Promise<void> {
    this.connected = false;
    this.reconnecting = false;

    await this.onCustomConnectionError(error);
  }

  protected async onCustomConnectionClosed(): Promise<void> {
    Logger.warn(`[${this.exchangeId}] Connection Closed`);
  }

  private async onConnectionClosed(): Promise<void> {
    this.connected = false;
    this.reconnecting = false;

    await this.onCustomConnectionClosed();

    await this.redisTicker.feederLostExchange(this.exchangeId, this.feederId);
  }

  protected async connectFailed(error): Promise<void> {
    this.connected = false;
    this.reconnecting = false;

    Logger.error(`Connect Error: ${error.message}`);

    await this.redisTicker.feederLostExchange(this.exchangeId, this.feederId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async onCustomMessage(message: any, con?: connection): Promise<boolean> {
    // Logger.error(`Abstract method onMessage(): ${message}`);
    return false;
  }

  protected async onMessage(message: Message, con?: connection): Promise<void> {
    let msg;
    let text;
    if (message.type === 'utf8') {
      // console.log("Received UTF8: '" + message.utf8Data + "'");
      text = message.utf8Data;
      msg = JSON.parse(text);
    } else {
      // var fileBuffer = new Buffer( message.binaryData, 'binary' );
      const binary = message.binaryData;

      text = pako.inflate(binary, {
        to: 'string',
      });
      msg = JSON.parse(text);
    }

    const wasTicker = await this.onCustomMessage(msg, con);
    if (wasTicker) {
      // update timestamp to prevent lost
      await this.redisTicker.setTickerFeeder(this.exchangeId, this.feederId);

      await this.updateTickers();
    } else {
      if (this.connected && (await this.redisTicker.isMeFeeder(this.exchangeId)) === false) {
        console.error('--- I AM NOT THIS FEEDER', '[', this.exchangeId, ']', this.feederId);

        if (this.connection?.connected) {
          this.connection.close();
          this.connected = false;

          return;
        }
      }
    }
  }

  private onPing(_cancel: () => void, binaryPayload: Buffer) {
    this.connection?.pong(binaryPayload);

    Logger.debug(`[${this.exchangeId}] Pong`);
  }

  protected async onBeforeConnect(_connection: connection): Promise<void> {
    // Logger.error(`Abstract method onBeforeConnect()`);
  }

  protected async onAfterConnect(connection: connection): Promise<void> {
    // Logger.error(`Abstract method onBeforeConnect()`);
  }

  protected async onConnect(connection: connection): Promise<void> {
    this.connection = connection;
    await this.onBeforeConnect(connection);

    connection.on('error', (error) => this.onConnectionError(error));
    connection.on('close', () => this.onConnectionClosed());
    connection.on('message', (message) => this.onMessage(message));
    connection.on('ping', (cancel: () => void, binaryPayload: Buffer) => this.onPing(cancel, binaryPayload));

    this.connected = true;
    this.reconnecting = false;

    // const TTL = Math.floor(WS_TTL + Math.random() * WS_TTL);
    // Logger.debug(`[${this.exchangeId}] WebSocket Client Connected. Reconnect in ${TTL}ms`);
    //
    // setTimeout(function () {
    //   connection.close();
    // }, TTL);

    await this.onAfterConnect(connection);
  }

  initWebsocket() {
    this.on('connectFailed', (error) => this.connectFailed(error));
    this.on('connect', (connection) => this.onConnect(connection));
  }

  async updateMarkets(): Promise<boolean> {
    this.markets = await this.redisExchange.getMarkets(this.exchangeId);

    if (!this.markets) {
      return false;
    }

    this.symbolIds = Object.values(this.markets).reduce((symbolIds, market) => {
      symbolIds[market.id] = market.symbol;
      return symbolIds;
    }, {});

    return !!Object.keys(this.markets).length;
  }

  private async updateTickers(): Promise<void> {
    if (this.lastUpdate && this.lastUpdate > Date.now() - SAVE_TICKERS_TIMEOUT) {
      return;
    }
    this.lastUpdate = Date.now();

    const message = {};

    // for (const symbol of Object.keys(this.tickers)) {
    //   if ((this.tickers[symbol].timestamp || 0) > this.lastUpdate - SAVE_TICKERS_TIMEOUT * 2) {
    //     // const [base, quote] = CcxtService.getCurrenciesFromSymbol(symbol);
    //     // const baseCurrency = CcxtService.getBaseCurrencyFromSymbol(this.exchangeId, symbol);
    //     // const isSupported =
    //     //   EXCLUDED_CURRENCIES.indexOf(base) < 0 && EXCLUDED_CURRENCIES.indexOf(quote) < 0 && (baseCurrency === base || baseCurrency === quote);
    //     //
    //     // if (isSupported) {
    //     //   message[symbol] = this.tickers[symbol];
    //     // }
    //
    //     message[symbol] = this.tickers[symbol];
    //   }
    // }

    for (const symbol of Object.keys(this.tickers)) {
      message[symbol] = this.tickers[symbol];
    }

    if (Object.keys(message).length) {
      Logger.log(`[${this.exchangeId}] ${this.feederId} Updated tickers: ${Object.keys(message).length}`);

      await this.redisTicker.setTickers(this.exchangeId, message);

      this.tickers = {};

      // this.redisTicker.publishAccumulateTickers(
      //   this.exchangeId,
      //   JSON.stringify({
      //     exchangeId: this.exchangeId,
      //     tickersToSave: { ...this.tickers },
      //   })
      // );
    }
  }

  // async onMessageHasExchangeToFeedTickers(channel, exchangeId): Promise<void> {
  //   if (channel === REDIS_ENTITY_TYPE.TICKERS_FEED) {
  //     if (!this.connected && !this.reconnecting && this.exchangeId === exchangeId) {
  //       Logger.warn(`*** on Message Has Available Feeder: [${exchangeId}] ${this.feederId}`);
  //       setTimeout(async () => {
  //         await this.checkConnection();
  //       }, 500 + Math.random() * 1000);
  //     }
  //   }
  // }

  async checkConnection() {
    if (!this.connected && !this.reconnecting) {
      const feeder = await this.redisTicker.getTickerFeeder(this.exchangeId);
      if (feeder?.id === this.feederId) {
        this.reconnecting = true;
        Logger.warn(`[${this.exchangeId}] Reconnecting...`);

        if (await this.updateMarkets()) {
          // if (await this.updateMarkets()) {
          this.connect(this.socketAddress);
        } else {
          Logger.warn(`[${this.exchangeId}] No markets`);
          this.reconnecting = false;
        }
      }
    }
  }

  @Cron('*/3 * * * * *')
  async handleCron() {
    if (this.allowToConnect) {
      await this.checkConnection();
    }
  }
}
