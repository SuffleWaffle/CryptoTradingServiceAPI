import { Exchange } from 'ccxt';

export type UserExchanges = {
  [exchangeId: string]: {
    connections: { publicKey: string; secretKey: string; passphrase?: string; proxy?: string; exchange?: Exchange }[];
    publicKey: string;
    secretKey: string;
    passphrase?: string;
    rateLimit: number;
    lastIndex: number;
    baseCurrency: string;
    symbols: string[];
  };
};
