import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Document } from 'bson';
import {
  AggregateOptions,
  BulkWriteResult,
  Collection,
  Db,
  DeleteOptions,
  DeleteResult,
  Filter,
  FindOptions,
  InsertOneResult,
  MongoClient,
  ServerApiVersion,
  UpdateFilter,
  UpdateOptions,
  UpdateResult,
} from 'mongodb';
import { sleep } from '@cupo/backend/constant';

@Injectable()
export class MongodbService implements OnModuleDestroy {
  private client: MongoClient;
  private db: Db;
  private connected = false;
  private connecting = false;

  getConnectionString(): string {
    if (process.env.MONGODB_HOST?.toUpperCase() === 'LOCALHOST') {
      return `mongodb://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@${process.env.MONGODB_HOST}/${process.env.MONGODB_AUTH_DB}?retryWrites=true&w=majority`;
    }

    return `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@${process.env.MONGODB_HOST}/${process.env.MONGODB_AUTH_DB}?retryWrites=true&w=majority`;
  }

  async getCollection(collectionName: string): Promise<Collection> {
    if (this.connecting) {
      await sleep(3000 + Math.random() * 1000);
    }

    if (!this.connected) {
      await this.connect();
    }

    return this.db.collection(collectionName);
  }

  async onModuleDestroy(): Promise<void> {
    return this.disconnect();
  }

  private async connect(): Promise<MongoClient> {
    this.connecting = true;

    if (!this.client) {
      this.client = new MongoClient(this.getConnectionString(), {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        serverApi: ServerApiVersion.v1,
      });

      this.client.on('open', () => {
        this.connected = true;
        this.connecting = false;

        Logger.log(`MongoDB connected: ${this.client?.options?.dbName} - ${process.env.APP_NAME}`);
      });
      this.client.on('topologyClosed', () => {
        this.connected = false;
        this.connecting = false;

        Logger.log(`MongoDB disconnected: ${this.client?.options?.dbName} - ${process.env.APP_NAME}`);
      });
    }

    if (!this.connected) {
      await this.client.connect();

      this.db = await this.client.db(process.env.MONGODB_DB, {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        // serverApi: ServerApiVersion.v1,
        retryWrites: true,
      });
    }

    this.connecting = false;
    return this.client;
  }

  // *** COMMON ***
  protected clearQuery(query: object): object {
    const result = { ...query };

    Object.keys(result).forEach((key) => {
      if (result[key] === undefined || result[key] === null || result[key] === '') {
        delete result[key];
      }
    });

    return result;
  }

  protected async aggregate<T>(collectionName: string, pipeline: Document[], options?: AggregateOptions): Promise<T[]> {
    return (await this.getCollection(collectionName)).aggregate<T>(pipeline, options).toArray();
  }

  protected async find<T>(collectionName: string, query: object, options?: FindOptions): Promise<T[]> {
    return (await this.getCollection(collectionName)).find<T>(this.clearQuery(query), options).toArray();
  }

  protected async count(collectionName: string, query: object, options?: FindOptions): Promise<number> {
    return (await this.getCollection(collectionName)).countDocuments(this.clearQuery(query), options);
  }

  protected async findOne<T>(collectionName: string, query: object, options?: FindOptions): Promise<T | null> {
    return (await this.getCollection(collectionName)).findOne<T>(this.clearQuery(query), options);
  }

  protected async updateMany<T>(
    collectionName: string,
    filter: Filter<T>,
    data: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<UpdateResult | Document> {
    return (await this.getCollection(collectionName)).updateMany(
      this.clearQuery(filter),
      { $set: data },
      options || {}
    );
  }

  protected async updateOne<T>(
    collectionName: string,
    filter: Filter<T>,
    data: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return (await this.getCollection(collectionName)).updateOne(this.clearQuery(filter), { $set: data }, options || {});
  }

  protected async insertOneIfNotExists<T>(
    collectionName: string,
    filter: Filter<T>,
    data: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return (await this.getCollection(collectionName)).updateOne(
      this.clearQuery({ ...filter, deleted: { $ne: true } }),
      { $setOnInsert: { ...data, created: new Date() } },
      { upsert: true, ...(options || {}) }
    );
  }

  protected async insertManyIfNotExists<T>(
    collectionName: string,
    filter: Filter<T>,
    data: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<UpdateResult | Document> {
    return (await this.getCollection(collectionName)).updateOne(
      this.clearQuery({ ...filter, deleted: { $ne: true } }),
      { $setOnInsert: { ...data, created: new Date() } },
      { upsert: true, ...(options || {}) }
    );
  }

  protected async upsertOne<T>(
    collectionName: string,
    filter: Filter<T>,
    data: UpdateFilter<T>,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this.updateOne(collectionName, this.clearQuery(filter), data, { upsert: true, ...(options || {}) });
  }

  protected async delete(collectionName: string, query: object, options?: DeleteOptions): Promise<DeleteResult> {
    return (await this.getCollection(collectionName)).deleteMany(this.clearQuery(query), options || {});
  }

  protected async insertOne<T>(collectionName: string, data: T): Promise<InsertOneResult<T>> {
    return (await this.getCollection(collectionName)).insertOne(data);
  }

  protected async insertMany(collectionName: string, data: object[]): Promise<object> {
    return (await this.getCollection(collectionName)).insertMany(data);
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  // mongodb nodejs bulkWrite updateOne upsert example
  protected async updateManyWithBulkWrite(
    collectionName: string,
    data: { filter: object; replacement: object }[]
  ): Promise<BulkWriteResult> {
    // const bulk = (await this.getCollection(collectionName)).initializeUnorderedBulkOp();

    return (await this.getCollection(collectionName)).bulkWrite(
      data.map((item) => ({
        replaceOne: {
          filter: this.clearQuery(item.filter),
          replacement: item.replacement,
          upsert: true,
        },
      }))
    );

    // return bulk.execute();
  }
}
