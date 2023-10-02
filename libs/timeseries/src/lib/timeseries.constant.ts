import { TIMEFRAME } from './timeseries.interface';

export function timeframeSeconds(timeframe: TIMEFRAME): number {
  switch (timeframe) {
    case '1m':
      return 60;
    case '5m':
      return 300;
    case '15m':
      return 900;
    case '30m':
      return 1800;
    case '1h':
      return 3600;
    case '2h':
      return 7200;
    case '4h':
      return 14400;
    case '1d':
      return 86400;
    case '1w':
      return 604800;
    case '1M':
      return 2592000;
    case '1y':
      return 31536000;
    default:
      throw new Error(`Unknown timeframe: ${timeframe}`);
  }
}

export function timeframeMSeconds(timeframe: TIMEFRAME): number {
  return timeframeSeconds(timeframe) * 1000;
}

export function timeframeMinutes(timeframe: TIMEFRAME): number {
  return Math.floor(timeframeSeconds(timeframe) / 60);
}
