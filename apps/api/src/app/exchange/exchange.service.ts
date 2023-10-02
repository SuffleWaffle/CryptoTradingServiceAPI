import { Injectable } from "@nestjs/common";
import { Market } from "ccxt";
import { RedisExchangeService } from "@cupo/backend/storage";
import { QueueService } from "@cupo/backend/queue";
import { getEnabledExchanges } from "@cupo/backend/constant";
import { MarketsType } from "@cupo/backend/interface";
import { ExchangeLibService } from "@cupo/exchange";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const icons = require('../crypto-icons.json');

@Injectable()
export class ExchangeService {
  constructor(private readonly queueService: QueueService, private readonly redis: RedisExchangeService) {}

  async getExchangesList(): Promise<string[] | null> {
    // const list = await this.redis.getExchangesList();

    return Object.keys(getEnabledExchanges());
  }

  async getCurrencyIds(exchangeId: string, supportedOnly = true): Promise<string[] | null> {
    const currencies = await this.redis.getCurrencies(exchangeId, supportedOnly);

    if (!currencies) {
      return null;
    }

    return Object.keys(currencies);
  }

  async getSymbols(exchangeId: string, supportedOnly = true): Promise<{ symbol: string; coinUrl: string }[] | null> {
    const symbols: string[] = await this.redis.getSymbols(exchangeId, supportedOnly);

    const cdn = 'https://cupocoin.sfo3.cdn.digitaloceanspaces.com/crypto-logo/';

    return (
      symbols?.map((symbol) => ({
        symbol,
        coinUrl: icons.includes(ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, symbol).toLowerCase())
          ? `${cdn}${ExchangeLibService.getQuoteCurrencyFromSymbol(exchangeId, symbol).toLowerCase()}.svg`
          : `${cdn}coin.svg`,
      })) || null
    );
  }

  async getMarkets(exchangeId: string, baseCurrency?: string): Promise<MarketsType | null> {
    const markets = await this.redis.getMarkets(exchangeId, baseCurrency);

    if (markets) {
      return markets;
    }

    return null;
  }

  async getMarket(exchangeId: string, symbol: string): Promise<Market | null> {
    const market = await this.redis.getMarket(exchangeId, symbol);

    if (market) {
      return market;
    }

    return null;
  }
}
