export enum REDIS_ENTITY_TYPE {
  SESSION = 'session',
  NOTIFICATION = 'notify',
  EXCHANGES = 'exchanges',
  EXCHANGE_RATE_LIMITS = 'rates',
  EXCHANGE_MARKETS = 'markets',
  EXCHANGE_MARKETS_UPDATE = 'marketsUpdate',
  EXCHANGE_SYMBOLS = 'symbols',
  EXCHANGE_BAD_SYMBOLS = 'badSymbols',
  EXCHANGE_SYMBOLS_ALL = 'symbolsAll',
  EXCHANGE_CURRENCY = 'currency',
  EXCHANGE_CURRENCY_ALL = 'currencyAll',
  TICKERS = 'ticker',
  TICKERS_FEED = 'feedTickers',
  TICKERS_MAIN_FEEDER = 'mainTickerFeeder',
  TICKERS_AVAILABLE_FEEDER = 'availableTickerFeeder',
  TICKERS_ACCUMULATE = 'accumulateTickers',
  USERS = 'users',
  LOG = 'log',
  BALANCES = 'balances',
  INDICATORS = 'index',

  ORDER_MANAGER = 'mainOrderManager',
  ORDERS = 'order',
  ORDER_SYMBOL_SL = 'stopLoss',

  CANDLES = 'candle',
}
