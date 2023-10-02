import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ExchangeLibService } from '@cupo/exchange';
import { RedisExchangeService } from '@cupo/backend/storage';
import { QueueService } from '@cupo/backend/queue';
import { Currency, Dictionary } from 'ccxt';
import { Cron } from '@nestjs/schedule';
import { ENABLED_EXCHANGES, EXCLUDED_CURRENCIES } from '@cupo/backend/constant';

@Injectable()
export class ExchangeService implements OnApplicationBootstrap {
  constructor(
    private readonly queueService: QueueService,
    private readonly exchange: ExchangeLibService,
    private readonly redis: RedisExchangeService
  ) {}

  async setExchangesList(): Promise<void> {
    await this.redis.setExchangesList(this.exchange.getExchangesList());
  }

  async onApplicationBootstrap() {
    setTimeout(async () => {
      await this.updateMarkets();
    }, 3000);
  }

  @Cron('15 */5 * * * *')
  async updateMarkets(): Promise<void> {
    for (const exchangeId of Object.keys(ENABLED_EXCHANGES)) {
      setTimeout(async () => {
        await this.saveMarkets(exchangeId);
      }, 500 * Math.random() + 500);
    }
  }

  async saveMarkets(exchangeId: string): Promise<void> {
    const jobs = [];

    Logger.verbose(`Updating markets for ${exchangeId}`);
    const markets = await this.exchange.fetchMarkets(exchangeId, false);
    if (!markets) {
      Logger.error(`Failed to update markets for ${exchangeId}`);
      return;
    }
    jobs.push(this.redis.setMarkets(exchangeId, markets));

    const currSupported: Dictionary<Currency> = {};
    const currencies: Dictionary<Currency> = Object.keys(markets).reduce((acc, symbol) => {
      const market = markets[symbol];
      const base = market.base;
      const quote = market.quote;

      if (!acc[base]) {
        acc[base] = {
          id: market.base,
          code: market.base,
          precision: market.precision?.price || 8,
        };
      }

      if (!acc[quote]) {
        acc[quote] = {
          id: market.base,
          code: market.base,
          precision: market.precision?.price || 8,
        };
      }

      return acc;
    }, {});

    const symbols = Object.keys(markets);
    const symbolsSupported = symbols.filter((symbol) => {
      const [base, quote] = ExchangeLibService.getCurrenciesFromSymbol(symbol);
      const baseCurrency = ExchangeLibService.getBaseCurrencyFromSymbol(exchangeId, symbol);
      const isSupported =
        EXCLUDED_CURRENCIES.indexOf(base) < 0 &&
        EXCLUDED_CURRENCIES.indexOf(quote) < 0 &&
        (baseCurrency === base || baseCurrency === quote);

      if (isSupported) {
        currSupported[base] = currencies[base];
        currSupported[quote] = currencies[quote];
      }

      return isSupported;
    });

    jobs.push(this.redis.setSymbols(exchangeId, symbols, false));
    jobs.push(this.redis.setSymbols(exchangeId, symbolsSupported, true));

    jobs.push(this.redis.setCurrencies(exchangeId, currencies, false));
    jobs.push(this.redis.setCurrencies(exchangeId, currSupported, true));

    await Promise.all(jobs);

    Logger.log(`[${exchangeId}] Updated markets ${Object.keys(markets).length}`);
  }
}
