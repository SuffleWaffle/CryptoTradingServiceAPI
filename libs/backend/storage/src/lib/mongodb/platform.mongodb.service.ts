import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CandleObject, GarbageCollectCandlesParams } from '@cupo/timeseries';
import { BulkWriteResult, InsertOneResult } from 'mongodb';
import { MAX_USERS_PER_PROXY, REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { IndicatorsValues } from '@cupo/indicators';
import { Coupon, FreeProxyInterface, ProxyInterface, UserProxyInterface } from '@cupo/backend/interface';
import { CollectionNames } from './collections';
import { MongodbService } from './mongodb.service';

@Injectable()
export class PlatformMongodbService extends MongodbService implements OnModuleDestroy {
  //***************
  //*** COUPONS ***
  //***************

  async getCoupons(): Promise<Coupon[]> {
    return this.find<Coupon>(CollectionNames.Coupons, { deleted: { $ne: true } });
  }

  async addNewCoupon(data: Coupon): Promise<string | null> {
    const result: InsertOneResult = await this.insertOne<{ id: string } & { created: Date }>(CollectionNames.Coupons, {
      ...data,
      created: new Date(),
    });

    return result?.insertedId.toString() || null;
  }

  //*******************************
  //*** PARTNERS REFERRAL CODES ***
  //*******************************

  async getCoupon(id: string): Promise<string | null> {
    const coupon = await this.findOne<Coupon>(CollectionNames.Coupons, {
      id,
    });

    return coupon?._id?.toString() || null;
  }

  async getReferralCodes(): Promise<any[]> {
    return await this.find(CollectionNames.ReferralCodes, {}, { sort: { timestamp: -1 }, limit: 100 });
  }

  async saveReferralCode(data: any): Promise<void> {
    await this.insertOne(CollectionNames.ReferralCodes, data);
  }

  //*******************************
  //*** COLLECTOR ***
  //*******************************

  async collectIndicators(
    params: GarbageCollectCandlesParams & { indexes: IndicatorsValues[] }
  ): Promise<BulkWriteResult> {
    const { exchangeId, symbol, timeframe, indexes } = params;

    return this.updateManyWithBulkWrite(
      CollectionNames.Indicators,
      indexes.map((idx) => {
        return {
          filter: { exchangeId, symbol, timeframe, time: idx.time },
          replacement: { exchangeId, symbol, timeframe, time: idx.time, ...idx },
        };
      })
    );
  }

  async collectCandles(params: GarbageCollectCandlesParams & { candles: CandleObject[] }): Promise<BulkWriteResult> {
    const { exchangeId, symbol, timeframe, candles } = params;

    return this.updateManyWithBulkWrite(
      CollectionNames.Candles,
      candles.map((candle) => {
        return {
          filter: { exchangeId, symbol, timeframe, time: candle.time },
          replacement: { exchangeId, symbol, timeframe, time: candle.time, ...candle },
        };
      })
    );
  }

  //*******************************
  //*** PAYPAL ***
  //*******************************

  async savePaypalEvent(data: any): Promise<[REST_API_RESPONSE_STATUS, string, any]> {
    try {
      const document = await this.insertOne<any>(CollectionNames.PaypalEvents, data);

      return [REST_API_RESPONSE_STATUS.SUCCESS, 'Paypal event saved', document];
    } catch (e) {
      return [REST_API_RESPONSE_STATUS.INTERNAL_ERROR, e.message, null];
    }
  }

  async getPayPalEvents(): Promise<any[]> {
    return await this.find(CollectionNames.PaypalEvents, {}, { sort: { timestamp: -1 }, limit: 100 });
  }

  //*********************
  //*** PROXY SERVERS ***
  //*********************

  async getProxyServer(data: { exchangeId: string; ip: string | null }): Promise<ProxyInterface | null> {
    return await this.findOne<ProxyInterface>(CollectionNames.ProxyServers, data);
  }

  async getProxyList(filter: { ip?: string; country?: string; exchangeId?: string }): Promise<ProxyInterface[]> {
    return await this.find<ProxyInterface>(
      CollectionNames.ProxyServers,
      { ...filter, deleted: { $ne: true } },
      { sort: { country: 1, exchangeId: 1, _id: -1 }, limit: 1000 }
    );
  }

  async addProxyServer(data: ProxyInterface): Promise<void> {
    await this.insertManyIfNotExists<ProxyInterface>(
      CollectionNames.ProxyServers,
      {
        ip: data.ip,
        exchangeId: data.exchangeId,
      },
      data
    );
  }

  async deleteProxyServer(filter: { ip: string; exchangeId?: string }): Promise<string | undefined> {
    let proxies;

    if (!filter.exchangeId) {
      proxies = await this.getUserProxies({ ip: filter.ip });
    } else {
      proxies = await this.getUserProxies(filter);
    }
    if (proxies.length) {
      return 'Proxy is used by users';
    }

    await this.updateMany<ProxyInterface>(CollectionNames.ProxyServers, filter, { deleted: true });
  }

  async getFreeProxies(): Promise<FreeProxyInterface[]> {
    const overloadedProxies = (await this.aggregate(CollectionNames.UserProxyServers, [
      {
        $group: {
          _id: { ip: '$ip', exchangeId: '$exchangeId' },
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gte: MAX_USERS_PER_PROXY } },
      },
    ])) as {
      _id: {
        ip: string;
        exchangeId: string;
      };
      count: number;
    }[];

    const allProxies = await this.getProxyList({});

    if (!overloadedProxies.length) {
      return allProxies.map((proxy) => {
        return {
          ip: proxy.ip,
          exchangeId: proxy.exchangeId,
          country: proxy.country,
        };
      });
    }

    return allProxies
      .filter((proxy) => {
        const overloadedProxy = overloadedProxies.find(
          (p) => p._id.ip === proxy.ip && p._id.exchangeId === proxy.exchangeId
        );

        return !overloadedProxy || overloadedProxy.count < MAX_USERS_PER_PROXY;
      })
      .map((proxy) => {
        return {
          ip: proxy.ip,
          exchangeId: proxy.exchangeId,
          country: proxy.country,
        };
      });
  }

  getRandomFreeProxyArray(data: FreeProxyInterface[]): FreeProxyInterface | null {
    if (!data.length) {
      return null;
    }

    return data[Math.floor(Math.random() * data.length)] as {
      ip: string;
      exchangeId: string;
      count: number;
    };
  }

  async getRandomFreeProxy(filter: { exchangeId: string }): Promise<FreeProxyInterface | null> {
    const proxiesCount = await this.aggregate(CollectionNames.UserProxyServers, [
      {
        $match: filter,
      },
      {
        $group: {
          _id: { ip: '$ip', exchangeId: '$exchangeId' },
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $lt: MAX_USERS_PER_PROXY } },
      },
    ]);

    if (!proxiesCount.length) {
      return null;
    }

    const randomProxy = proxiesCount[Math.floor(Math.random() * proxiesCount.length)] as {
      _id: {
        ip: string;
        exchangeId: string;
      };
      count: number;
    };

    return {
      ip: randomProxy._id.ip,
      exchangeId: filter.exchangeId,
    };
  }

  async getUserProxy(filter: { userId: string; exchangeId: string }): Promise<UserProxyInterface | null> {
    return this.findOne<UserProxyInterface>(CollectionNames.UserProxyServers, filter);
  }

  async getUserProxies(filter: { userId?: string; exchangeId?: string; ip?: string }): Promise<UserProxyInterface[]> {
    return this.find<UserProxyInterface>(CollectionNames.UserProxyServers, filter);
  }

  async setUserProxy(data: { userId: string; exchangeId: string; ip?: string }): Promise<string | undefined> {
    const { userId, exchangeId, ip } = data;

    if (!ip) {
      await this.deleteUserProxy({ userId, exchangeId });
      return;
    }

    const proxy = await this.getProxyServer({ exchangeId, ip });
    if (!proxy) {
      return `Proxy server for [${exchangeId}] with ip "${ip}" not found`;
    }

    const answer = await this.upsertOne<UserProxyInterface>(
      CollectionNames.UserProxyServers,
      {
        userId: data.userId,
        exchangeId: data.exchangeId,
      },
      data
    );

    return !answer?.acknowledged ? 'Error while saving user proxy' : undefined;
  }

  async deleteUserProxy(filter: { userId: string; exchangeId: string }): Promise<void> {
    await this.delete(CollectionNames.UserProxyServers, filter);
  }
}
