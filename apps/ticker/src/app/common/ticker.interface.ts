export type BitsoMarket = {
  book: string;
  minimum_price: string;
  maximum_price: string;
  minimum_amount: string;
  maximum_amount: string;
  minimum_value: string;
  maximum_value: string;
  tick_size: string;
  fees: {
    flat_rate: {
      maker: string;
      taker: string;
    };
    structure: {
      volume: string;
      maker: string;
      taker: string;
    }[];
  };
};

export type BinanceMarket = {
  timezone: 'UTC';
  serverTime: number;
  rateLimits: {
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }[];
  symbols: {
    symbol: string;
    status: string;
    baseAsset: string;
    baseAssetPrecision: 8;
    quoteAsset: string;
    quotePrecision: number;
    quoteAssetPrecision: number;
    baseCommissionPrecision: number;
    quoteCommissionPrecision: number;
    orderTypes: string[];
    icebergAllowed: boolean;
    ocoAllowed: boolean;
    quoteOrderQtyMarketAllowed: boolean;
    allowTrailingStop: boolean;
    cancelReplaceAllowed: boolean;
    isSpotTradingAllowed: boolean;
    isMarginTradingAllowed: boolean;
    filters: {
      filterType: string;
      minPrice: string;
      maxPrice: string;
      tickSize: string;
    }[];
  }[];
};

// {
//   "e": "1hTicker",    // Event type
//   "E": 123456789,     // Event time
//   "s": "BNBBTC",      // Symbol
//   "p": "0.0015",      // Price change
//   "P": "250.00",      // Price change percent
//   "o": "0.0010",      // Open price
//   "h": "0.0025",      // High price
//   "l": "0.0010",      // Low price
//   "c": "0.0025",      // Last price
//   "w": "0.0018",      // Weighted average price
//   "v": "10000",       // Total traded base asset volume
//   "q": "18",          // Total traded quote asset volume
//   "O": 0,             // Statistics open time
//   "C": 86400000,      // Statistics close time
//   "F": 0,             // First trade ID
//   "L": 18150,         // Last trade Id
//   "n": 18151          // Total number of trades
// }
export type BinanceTicker = {
  e: '24hrTicker';
  E: number;
  s: string;
  p: string;
  P: string;
  w: string;
  x: string;
  c: string;
  Q: string;
  b: string;
  B: string;
  a: string;
  A: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
  O: number;
  C: number;
  F: number;
  L: number;
  n: number;
};
