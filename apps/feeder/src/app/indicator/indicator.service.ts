import { Injectable, Logger } from '@nestjs/common';
import { Market } from 'ccxt';
import { RedisCandleService, RedisExchangeService, RedisIndicatorsService } from '@cupo/backend/storage';
import { calculateIndicators, CalculateIndicatorsParams } from '@cupo/indicators';
import { GarbageCollectCandlesParams, getCandleTimeByShift } from '@cupo/timeseries';
import { QueueService } from '@cupo/backend/queue';
import { BAD_SYMBOL_FRINGE, INDICATOR_LIMIT_VALUES } from '@cupo/backend/constant';

@Injectable()
export class IndicatorService {
  constructor(
    private readonly queueService: QueueService,
    private readonly redisIndicator: RedisIndicatorsService,
    private readonly redisCandle: RedisCandleService,
    private readonly redisExchange: RedisExchangeService
  ) {}

  async calculateIndicator(params: CalculateIndicatorsParams): Promise<boolean> {
    const { exchangeId, symbol, timeframe, indexId, limit } = params;

    if ((await this.redisExchange.isBadSymbol(exchangeId, symbol, timeframe)) >= BAD_SYMBOL_FRINGE) {
      return false;
    }

    const minimumTime = getCandleTimeByShift(
      timeframe,
      Math.max(limit || INDICATOR_LIMIT_VALUES, INDICATOR_LIMIT_VALUES * 2)
    );

    const market: Market = await this.redisExchange.getMarket(exchangeId, symbol);
    if (!market?.precision || typeof market.precision.price !== 'number') {
      Logger.warn(`Market price precision is not found ${exchangeId}, ${symbol}`);
      return false;
    }

    const candles = await this.redisCandle.getCandles({
      exchangeId,
      symbol,
      timeframe,
      limit: Math.max(limit || INDICATOR_LIMIT_VALUES, INDICATOR_LIMIT_VALUES * 2),
      sort: -1,
      minimumTime,
    });

    if (!candles || candles.length < 4) {
      Logger.warn(
        `[${exchangeId}] ${symbol} ${timeframe} Not enough candles ${candles.length} for calculating indicators`
      );

      // mark symbol as difficult to calculate
      await this.redisExchange.setBadSymbol(exchangeId, symbol, timeframe);

      return false;
    }

    const cards = await this.redisIndicator.getIndicatorsList();

    const length =
      (limit || INDICATOR_LIMIT_VALUES) >= Math.floor(candles.length / 2)
        ? Math.floor(candles.length / 2)
        : limit || INDICATOR_LIMIT_VALUES;

    // let counter = 0;
    for (let shift = 0; shift < length; shift++) {
      const idx = calculateIndicators(
        candles,
        indexId
          ? Object.keys(cards)
              .map((key) => cards[key])
              .filter((idx) => idx.id === indexId)
          : Object.keys(cards).map((key) => cards[key]),
        market.precision.price,
        shift
      );

      // console.log(`IDX ${timeframe} ${symbol} ${exchangeId} ${shift}/${length}`, candles?.[shift]['time'], candles?.[shift]);
      // console.log(`IDX ${typeof candles?.[shift]} ${typeof candles}`, candles?.[shift]['time'], candles?.[shift]);

      await this.redisIndicator.setIndicatorsValue(exchangeId, symbol, timeframe, candles[shift].time, idx);
      // counter++;
    }

    // Logger.debug(`IDX [${exchangeId}] ${timeframe} ${symbol} calculated: ${counter}/${candles.length}`);

    return true;
  }

  async collectCandlesJob(params: GarbageCollectCandlesParams): Promise<void> {
    await this.queueService.addJob_CollectCandles(params);
  }
}
