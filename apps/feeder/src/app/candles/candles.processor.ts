import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { OHLCV } from 'ccxt';
import { ExchangeLibService } from '@cupo/exchange';
import { RedisCandleService, RedisExchangeService } from '@cupo/backend/storage';
import { CommonProcessor } from '@cupo/backend/common';
import {
  CandleArrayOrder,
  getCandleShift,
  GetCandlesParams,
  getCandleTime,
  getCandleTimeByShift,
  TIMEFRAME,
  timeframeMSeconds,
} from '@cupo/timeseries';
import { CandlesService } from './candles.service';
import { QUEUE_NAME, QUEUE_TYPE } from '@cupo/backend/interface';
import {
  CANDLE_LIMIT_VALUES,
  CANDLES_PACKET_SIZE,
  INDICATOR_LIMIT_VALUES,
  messageRepresentation,
} from '@cupo/backend/constant';

@Processor(QUEUE_TYPE.CANDLE)
export class CandlesProcessor extends CommonProcessor {
  constructor(
    private readonly candleService: CandlesService,
    private readonly exchange: ExchangeLibService,
    private readonly candleRedis: RedisCandleService,
    private readonly exchangeRedis: RedisExchangeService
  ) {
    super(QUEUE_TYPE.CANDLE);
  }

  @Process({ name: QUEUE_NAME.UPDATE_CANDLES, concurrency: 16 })
  async updateCandles(job: Job<GetCandlesParams>): Promise<void> {
    const { exchangeId, symbol, since, limit, force } = job.data;

    if (
      (process.env.QUEUE_FETCH_CANDLES_ACTIVE === '0' ||
        process.env.QUEUE_FETCH_CANDLES_ACTIVE?.toLowerCase() === 'false') &&
      !force
    ) {
      await job.discard();
      return;
    }

    // console.log(`UPDATE CANDLES`, job.data);

    let timeframe = job.data?.timeframe;
    if (timeframe === TIMEFRAME.M30) {
      timeframe = TIMEFRAME.M15;
    }
    if (timeframe === TIMEFRAME.H2) {
      timeframe = TIMEFRAME.H1;
    }
    if (timeframe === TIMEFRAME.H4) {
      timeframe = TIMEFRAME.H1;
    }

    // const update = await this.candleService.getCandlesLastRequest(exchangeId, symbol, timeframe);
    // if (Date.now() - update < CANDLE_UPDATE_TIMEOUT) {
    //   // if (Date.now() - update < Math.max(CANDLE_UPDATE_TIMEOUT, timeframeMSeconds(timeframe) / 8)) {
    //   // Logger.debug(`Job requests too often ${QUEUE_NAME.UPDATE_CANDLES}: ${exchangeId} ${symbol} ${timeframe} ${since} ${limit}`);
    //   await job.discard();
    //   return;
    // }

    const nowCandleTime = getCandleTime(timeframe, new Date());

    // if (job.timestamp < nowCandleTime) {
    //   Logger.debug(
    //     `Job expired ${QUEUE_NAME.UPDATE_CANDLES.toUpperCase()}: ${exchangeId} ${symbol} ${timeframe} ${since} ${limit}`
    //   );
    //   await job.discard();
    //   return;
    // }

    const storedCandle = await this.candleRedis.getCandle(exchangeId, symbol, timeframe, nowCandleTime);
    if (storedCandle) {
      // Logger.debug(`Job requests too often ${QUEUE_NAME.UPDATE_CANDLES}: ${exchangeId} ${symbol} ${timeframe}`);
      await job.discard();
      return;
    }

    // delete stalled jobs from the queue
    // await this.candleService.clearUpdateCandlesQueue(job);

    const minimumTime = getCandleTimeByShift(timeframe, limit || CANDLE_LIMIT_VALUES);

    // get already stored candles
    const storedCandles = await this.candleRedis.getCandles({ exchangeId, symbol, timeframe, sort: -1, minimumTime });

    // check the last stored finished candle
    let storedSince = minimumTime;
    // let finished = 0;

    const secondsTF = timeframeMSeconds(timeframe);
    while (storedCandles && storedCandles.length && storedSince < nowCandleTime) {
      if (!storedCandles.some((candle) => candle.time === storedSince && candle.finished)) {
        break;
      }

      // console.log(storedSince, new Date(storedSince).toISOString());
      // finished++;
      storedSince -= secondsTF;
    }
    if (timeframe === TIMEFRAME.M15) {
      storedSince -= secondsTF * (4 + 1);
    }
    if (timeframe === TIMEFRAME.H1) {
      storedSince -= secondsTF * (4 * 2 + 1);
    }

    // storedSince -= timeframeMSeconds(timeframe);

    // console.log(
    //   `Stored ${storedCandles.length} candles of ${symbol} ${timeframe}, finished: ${finished}`
    // );

    // fixme: deprecated method
    // await this.candleService.setCandlesLastRequest(exchangeId, symbol, timeframe);

    // Logger.debug(`CANDLES ${timeframe} ${symbol} fetching...`);

    const candles = [];
    let fetched = [];

    try {
      storedSince = Math.min(storedSince, since || storedSince);
      let nowTime = storedSince;

      while (nowTime <= nowCandleTime) {
        try {
          fetched = await this.exchange.fetchCandles({
            exchangeId,
            symbol,
            timeframe,
            since: nowTime,
            limit: CANDLES_PACKET_SIZE,
          });
        } catch (err) {
          if (!err.message.toLowerCase().includes('rate')) {
            try {
              fetched = await this.exchange.fetchCandles({
                exchangeId,
                symbol,
                timeframe,
                since: nowTime,
                limit: CANDLES_PACKET_SIZE,
              });
            } catch (err) {
              await this.exchangeRedis.setBadSymbol(exchangeId, symbol, timeframe);
              await job.discard();
              return;
            }
          } else {
            await this.exchangeRedis.setBadSymbol(exchangeId, symbol, timeframe);
            await job.discard();
            return;
          }
        }

        // console.log(
        //   'packet',
        //   exchangeId,
        //   symbol,
        //   timeframe,
        //   new Date(nowTime),
        //   getCandleShift(timeframe, nowTime),
        //   fetched.length
        // );

        // if (!fetched?.length) {
        //   break;
        // }

        for (const fCandle of fetched) {
          if (!candles.find((candle) => candle[0] === fCandle[0])) {
            candles.push(fCandle);
          }
        }

        nowTime += timeframeMSeconds(timeframe) * CANDLES_PACKET_SIZE;
      }

      // candles = await this.exchange.fetchCandles({
      //   exchangeId,
      //   symbol,
      //   timeframe,
      //   since: storedSince,
      // });

      Logger.log(
        `${exchangeId}, ${symbol}, ${timeframe}, time: ${new Date(storedSince).toISOString()}, shift: ${getCandleShift(
          timeframe,
          storedSince
        )}, fetched: ${candles.length}`
      );

      //   candles = await this.exchange.fetchCandles({
      //     exchangeId,
      //     symbol,
      //     timeframe,
      //     since: Math.min(storedSince, since || storedSince),
      //   });
      // candles = await this.exchange.fetchCandles({ exchangeId, symbol, timeframe, limit: 32 });
    } catch (e) {
      Logger.error(`CANDLES fetch failed [${exchangeId}] ${symbol} ${timeframe}: ${messageRepresentation(e.message)}`);

      await job.discard();
      return;
    }

    Logger.debug(
      `CANDLES [${exchangeId}] [${timeframe}] ${symbol} fetched ${candles.length} from ${new Date(
        storedSince
      ).toISOString()}`
    );

    let pushed = [];
    candles.forEach((candle) => {
      if (candle[CandleArrayOrder.Time] === getCandleTime(timeframe, candle[CandleArrayOrder.Time])) {
        pushed.push(
          this.candleRedis.setCandle(
            exchangeId,
            symbol,
            timeframe,
            candle,
            nowCandleTime !== getCandleTime(timeframe, candle[CandleArrayOrder.Time]) ? true : undefined
          )
        );
      } else {
        Logger.error(
          `Candle time mismatch of ${exchangeId} ${symbol} ${timeframe}: ${candle[CandleArrayOrder.Time]} ${new Date(
            candle[CandleArrayOrder.Time]
          )} - ${getCandleTime(timeframe, candle[CandleArrayOrder.Time])} ${new Date(
            getCandleTime(timeframe, candle[CandleArrayOrder.Time])
          )}`
        );
      }
    });

    if (pushed.length) {
      await Promise.all(pushed).catch((err) => {
        Logger.log(`Error push candles to Redis of ${symbol} ${timeframe}: ${err.message}`);
      });

      await this.candleService.addJob_CalculateIndicator(
        exchangeId,
        symbol,
        timeframe,
        pushed.length || INDICATOR_LIMIT_VALUES
      );

      // Logger.debug(`IDX calculate ${exchangeId} ${timeframe} ${symbol}: ${pushed?.length}/${candles?.length} candles`);

      if (timeframe === TIMEFRAME.H1) {
        const candlesH2: OHLCV[] = this.candleService.glueCandles(candles, TIMEFRAME.H2);
        // Logger.debug(`GLUED CANDLES [${exchangeId}] [${TIMEFRAME.H2}] ${symbol} ${candlesH2.length}`);
        pushed = [];
        candlesH2.forEach((candle) => {
          if (candle[CandleArrayOrder.Time] === getCandleTime(TIMEFRAME.H2, candle[CandleArrayOrder.Time])) {
            pushed.push(
              this.candleRedis.setCandle(
                exchangeId,
                symbol,
                TIMEFRAME.H2,
                candle,
                nowCandleTime !== getCandleTime(TIMEFRAME.H2, candle[CandleArrayOrder.Time]) ? true : undefined
              )
            );
          } else {
            Logger.error(
              `Candle time mismatch of ${exchangeId} ${symbol} ${TIMEFRAME.H2}: ${
                candle[CandleArrayOrder.Time]
              } ${new Date(candle[CandleArrayOrder.Time])} - ${getCandleTime(
                TIMEFRAME.H2,
                candle[CandleArrayOrder.Time]
              )} ${new Date(getCandleTime(TIMEFRAME.H2, candle[CandleArrayOrder.Time]))}`
            );
          }
        });
        if (pushed.length) {
          await Promise.all(pushed);
          Logger.debug(
            `CANDLES [${exchangeId}] [${TIMEFRAME.H2}] ${symbol} fetched ${candlesH2.length} from ${new Date(
              storedSince
            ).toISOString()}`
          );

          await this.candleService.addJob_CalculateIndicator(
            exchangeId,
            symbol,
            TIMEFRAME.H2,
            pushed.length || INDICATOR_LIMIT_VALUES
          );
        }

        const candlesH4: OHLCV[] = this.candleService.glueCandles(candles, TIMEFRAME.H4);
        // Logger.debug(`GLUED CANDLES [${exchangeId}] [${TIMEFRAME.H4}] ${symbol} ${candlesH4.length}`);
        pushed = [];
        candlesH4.forEach((candle) => {
          if (candle[CandleArrayOrder.Time] === getCandleTime(TIMEFRAME.H4, candle[CandleArrayOrder.Time])) {
            pushed.push(
              this.candleRedis.setCandle(
                exchangeId,
                symbol,
                TIMEFRAME.H4,
                candle,
                nowCandleTime !== getCandleTime(TIMEFRAME.H4, candle[CandleArrayOrder.Time]) ? true : undefined
              )
            );
          } else {
            Logger.error(
              `Candle time mismatch of ${exchangeId} ${symbol} ${TIMEFRAME.H4}: ${
                candle[CandleArrayOrder.Time]
              } ${new Date(candle[CandleArrayOrder.Time])} - ${getCandleTime(
                TIMEFRAME.H4,
                candle[CandleArrayOrder.Time]
              )} ${new Date(getCandleTime(TIMEFRAME.H4, candle[CandleArrayOrder.Time]))}`
            );
          }
        });
        if (pushed.length) {
          await Promise.all(pushed);
          Logger.debug(
            `CANDLES [${exchangeId}] [${TIMEFRAME.H4}] ${symbol} fetched ${candlesH4.length} from ${new Date(
              storedSince
            ).toISOString()}`
          );

          await this.candleService.addJob_CalculateIndicator(
            exchangeId,
            symbol,
            TIMEFRAME.H4,
            pushed.length || INDICATOR_LIMIT_VALUES
          );
        }
      }

      if (timeframe === TIMEFRAME.M15) {
        const candlesM30: OHLCV[] = this.candleService.glueCandles(candles, TIMEFRAME.M30);
        // Logger.debug(`GLUED CANDLES [${exchangeId}] [${TIMEFRAME.M30}] ${symbol} ${candlesM30.length}`);
        pushed = [];
        candlesM30.forEach((candle) => {
          if (candle[CandleArrayOrder.Time] === getCandleTime(TIMEFRAME.M30, candle[CandleArrayOrder.Time])) {
            pushed.push(
              this.candleRedis.setCandle(
                exchangeId,
                symbol,
                TIMEFRAME.M30,
                candle,
                nowCandleTime !== getCandleTime(TIMEFRAME.M30, candle[CandleArrayOrder.Time]) ? true : undefined
              )
            );
          } else {
            Logger.error(
              `Candle time mismatch of ${exchangeId} ${symbol} ${TIMEFRAME.M30}: ${
                candle[CandleArrayOrder.Time]
              } ${new Date(candle[CandleArrayOrder.Time])} - ${getCandleTime(
                TIMEFRAME.M30,
                candle[CandleArrayOrder.Time]
              )} ${new Date(getCandleTime(TIMEFRAME.M30, candle[CandleArrayOrder.Time]))}`
            );
          }
        });
        if (pushed.length) {
          Logger.debug(
            `CANDLES [${exchangeId}] [${TIMEFRAME.M30}] ${symbol} fetched ${candlesM30.length} from ${new Date(
              storedSince
            ).toISOString()}`
          );
          await Promise.all(pushed);

          await this.candleService.addJob_CalculateIndicator(
            exchangeId,
            symbol,
            TIMEFRAME.M30,
            pushed.length || INDICATOR_LIMIT_VALUES
          );
        }
      }

      // await job.moveToCompleted();
    }
  }
}
