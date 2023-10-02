import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { default as Redis } from 'ioredis';
import { RedisKey } from 'ioredis/built/utils/RedisCommander';
import { REDIS_ENTITY_TYPE } from '@cupo/backend/constant';
import { TIMEFRAME } from '@cupo/timeseries';
import { cacheConfig } from '../config/redis.config';
import { USER_NOTIFICATION } from '@cupo/backend/interface';

export class RedisService implements OnApplicationBootstrap {
  private _instance: Redis;
  private _subscriber: Redis;
  private _publisher: Redis;
  private readonly _redisPrefix: string;

  constructor(protected readonly prefix: string, private readonly config?) {
    this._redisPrefix = process.env.REDIS_PREFIX ? process.env.REDIS_PREFIX + ':' : '';

    // if (process.env.REDIS_CLEAR_QUEUE === '1') {
    //   const queue = new Redis(queueBullConfig.redis);
    //   queue.flushdb('SYNC').then(() => {
    //     Logger.log('Redis flushed');
    //   });
    // }
  }

  protected getTimeSeriesKey(exchangeId: string, symbol: string, timeframe: TIMEFRAME): string {
    return `${exchangeId}:${symbol}:${timeframe}:${this.prefix}`;
  }

  protected getSymbolKey(exchangeId: string, symbol: string, key: string): string {
    return `${exchangeId}:${symbol}:${key}`;
  }

  protected getOrderKey(exchangeId: string, userId: string): string {
    return `${exchangeId}:${this.prefix}:${userId}`;
  }

  protected getOrderPatternKey(exchangeId: string): string {
    return `${exchangeId}:${this.prefix}:*`;
  }

  protected getExchangeKey(exchangeId: string, key?: string): string {
    return `${exchangeId}:${key ? key : this.prefix}`;
  }

  protected getSessionKey(userId?: string): string {
    return `${this.prefix}:${userId}`;
  }

  protected getNotificationKey(userId: string, type: USER_NOTIFICATION): string {
    return `${this.prefix}:${type.toString()}:${userId}`;
  }

  protected getUsersKey(): string {
    return `${this.prefix}`;
  }

  protected getLogKey(): string {
    return `${this.prefix}`;
  }

  protected getBalanceKey(exchangeId: string): string {
    return `${exchangeId}:${REDIS_ENTITY_TYPE.BALANCES}`;
  }

  onApplicationBootstrap() {
    this.createInstance();
  }

  private createInstance() {
    this._instance = new Redis({
      ...(this.config ? this.config : cacheConfig),
      socket_keepalive: true,
      socket_initdelay: 10,
      retry_strategy: function (options) {
        console.log('retry strategy. error code: ' + (options.error ? options.error.code : 'N/A'));
        console.log('options.attempt', options.attempt, 'options.total_retry_time', options.total_retry_time);
        return 2000;
      },
    });
  }

  get subscriber() {
    if (!this._subscriber) {
      this._subscriber = this._instance.duplicate();
    }

    return this._subscriber;
  }

  get publisher() {
    if (!this._publisher) {
      this._publisher = this._instance.duplicate();
    }

    return this._publisher;
  }

  protected get instance() {
    if (!this._instance) {
      this.createInstance();

      if (!this.subscriber) {
        this._subscriber = this._instance.duplicate();
      }

      this._instance.on('connect', () => this.onConnected());
      this._instance.on('error', (err) => this.onError(err));
    }

    return this._instance;
  }

  protected makeNewInstance() {
    return this.instance.duplicate();
  }

  private onConnected() {
    this.instance.stream.setKeepAlive(true, 10000);

    Logger.debug(`Redis connected DB: ${this.instance.options.db}`);
  }

  private onError(err) {
    Logger.error(`Redis connection error DB: ${this.instance.options.db}`, err);
  }

  protected async getHashesByPattern(
    key: string,
    limit?: number,
    // TODO - divide methods on two - with timestamp in the end and without
    sort?: 'asc' | 'desc', // default DESC
    minimumTime?: number
  ): Promise<Record<string, string>[]> {
    let data = await this.instance.keys(`${this._redisPrefix}${key}`);

    if (minimumTime) {
      data = data.filter((key) => parseInt(key.substring(key.lastIndexOf(':') + 1), 10) >= minimumTime);
    }

    if (sort) {
      data = data.sort((a, b) => {
        const s1 = +a.substring(a.lastIndexOf(':') + 1);
        const s2 = +b.substring(b.lastIndexOf(':') + 1);
        return !sort || sort === 'desc' ? s2 - s1 : s1 - s2; // sort by time
      });
    }

    data = data.slice(0, limit);

    const hashes = [];

    for (const key of data) {
      hashes.push(this.getHash(key, false));
    }

    return Promise.all(hashes);
  }

  protected async getHash(key: string, redisPrefix = true): Promise<Record<string, string> | null> {
    const data = await this.instance.hgetall(`${redisPrefix ? this._redisPrefix : ''}${key}`);

    // Redis returns empty list against NIL for not existing key
    return data && Object.keys(data).length ? data : null;
  }

  protected async getHashKeys(key: string, redisPrefix = true): Promise<string[] | null> {
    const data = await this.instance.hkeys(`${redisPrefix ? this._redisPrefix : ''}${key}`);

    // Redis returns empty list against NIL for not existing key
    return data && Object.keys(data).length ? data : null;
  }

  protected async getHashCount(key: string, redisPrefix = true): Promise<number> {
    return this.instance.hlen(`${redisPrefix ? this._redisPrefix : ''}${key}`);
  }

  protected async getHashValue(key: string, field: string): Promise<string | null> {
    return this.instance.hget(`${this._redisPrefix}${key}`, field);
  }

  protected async existsHashValue(key: string, field: string): Promise<boolean> {
    return !!(await this.instance.hexists(`${this._redisPrefix}${key}`, field));
  }

  protected async deleteHashValue(key: string, field: string): Promise<number> {
    return this.instance.hdel(`${this._redisPrefix}${key}`, field);
  }

  protected async deleteHashValues(key: string, fields: string[]): Promise<number> {
    return this.instance.hdel(`${this._redisPrefix}${key}`, ...fields);
  }

  protected async getKey(key: string): Promise<string | null> {
    return this.instance.get(`${this._redisPrefix}${key}`);
  }

  protected async exists(key: string): Promise<boolean> {
    return (await this.instance.exists(`${this._redisPrefix}${key}`)) > 0;
  }

  // set key with expiration time in seconds
  protected async setKey(key: string, value: string | Buffer | number, expire?: number): Promise<void> {
    if (!expire) {
      await this.instance.set(`${this._redisPrefix}${key}`, value);
    } else {
      await this.instance.setex(`${this._redisPrefix}${key}`, expire, value);
    }
  }

  protected async popKey(key: string, count: number): Promise<string[] | null> {
    const popCount = Math.min(count, await this.instance.scard(`${this._redisPrefix}${key}`));
    if (popCount === 0) {
      return null;
    }

    // console.log('*** popCount', getIPAddress(), key, await this.instance.scard(`${this._redisPrefix}${key}`));

    return this.instance.spop(`${this._redisPrefix}${key}`, popCount);
  }

  protected async pushKey(key: string, ...value): Promise<void> {
    await this.instance.sadd(`${this._redisPrefix}${key}`, ...value);
  }

  protected async getKeys(patternKey: string): Promise<string[]> {
    return this.instance.keys(`${this._redisPrefix}${patternKey}*`);
  }

  protected async setHash(key: string, hash: { [key: string]: string }): Promise<void> {
    await this.instance.hset(`${this._redisPrefix}${key}`, hash);
  }

  protected async deleteHash(key: RedisKey, ...fields: (string | Buffer)[]): Promise<void> {
    await this.instance.hdel(`${this._redisPrefix}${key}`, ...fields);
  }

  protected async deleteKey(key: RedisKey): Promise<void> {
    await this.instance.del(`${this._redisPrefix}${key}`);
  }

  protected subscribeChannel(channel: string): void {
    this.subscriber.subscribe(channel);
  }

  protected publishChannel(channel: string, data: string): void {
    this.publisher.publish(channel, data);
  }

  protected async unsubscribeChannel(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  //*** PUBLIC METHODS ***//

  public async deleteKeys(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.instance.del(key)));
  }

  async clearQueue(process: string): Promise<void> {
    const data = await this.getKeys(process);

    const keys = [];

    data.forEach((key: RedisKey) => {
      keys.push(this.deleteKey(key));
    });

    await Promise.all(keys);

    Logger.log(`Cleared ${process} queue length ${keys.length}`);
  }
}
