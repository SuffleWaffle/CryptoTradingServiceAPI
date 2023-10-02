import * as fs from 'fs';
import * as path from 'path';
import * as Bull from 'bull';

const tls =
  process.env.REDIS_TLS_CERT_FILE_NAME && process.env.REDIS_TLS_CERT_FILE_NAME.length > 0
    ? {
        cert: process.env.REDIS_TLS_CERT_FILE_NAME
          ? fs.readFileSync(path.resolve(__dirname, './assets/certs', process.env.REDIS_TLS_CERT_FILE_NAME))
          : undefined,
      }
    : undefined;

export const cacheConfig = {
  host: process.env.REDIS_CACHE_HOST,
  port: +process.env.REDIS_CACHE_PORT,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  db: +process.env.REDIS_CACHE_DB,
  tls,
};

export const tickerConfig = {
  host: process.env.REDIS_TICKER_HOST,
  port: +process.env.REDIS_TICKER_PORT,
  username: process.env.REDIS_TICKER_USERNAME,
  password: process.env.REDIS_TICKER_PASSWORD,
  db: +process.env.REDIS_TICKER_DB,
  tls,
};

export const queueBullConfig: Bull.QueueOptions = {
  redis: {
    host: process.env.REDIS_QUEUE_HOST,
    port: +process.env.REDIS_QUEUE_PORT,
    username: process.env.REDIS_QUEUE_USERNAME,
    password: process.env.REDIS_QUEUE_PASSWORD,
    db: +process.env.REDIS_QUEUE_DB,
    tls,
  },
  prefix: process.env.REDIS_PREFIX,
  settings: {
    maxStalledCount: 1,
  },
  defaultJobOptions: {
    preventParsingData: false,
    removeOnComplete: true,
    removeOnFail: true,
    lifo: true,
    timeout: 30000,
    attempts: 0,
  },
};
