export const WS_TTL = 15 * 60 * 1000; // mSec = 15 minutes
// export const WS_TTL = 15 * 1000; // mSec = 2 hours

export const SAVE_TICKERS_TIMEOUT: number = +process.env.SAVE_TICKERS_TIMEOUT || 3000; // mSec

export const TICKER_EXCHANGES_COUNT = +process.env.TICKER_EXCHANGES_COUNT || 2;
