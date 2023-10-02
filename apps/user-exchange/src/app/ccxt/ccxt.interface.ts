import { Exchange } from 'ccxt';

export type LastExchange = {
  userId: string | null;
  publicKey: string | null;
  exchange: Exchange | null;
  rateLimit: number;
};

export type LastExchanges = {
  [exchangeId: string]: LastExchange;
};

export type UserExchanges = {
  [exchangeId: string]: {
    connections: { publicKey: string; secretKey: string; passphrase?: string; proxyIp?: string; exchange?: Exchange }[];
    publicKey: string;
    secretKey: string;
    passphrase?: string;
    rateLimit: number;
    lastIndex: number;
    baseCurrency: string;
  };
};

export interface Exchanges {
  [exchangeId: string]: {
    connections: { publicKey: string; secretKey: string; passphrase?: string; proxyIp?: string; exchange?: Exchange }[];
    publicKey: string;
    secretKey: string;
    passphrase?: string;
    rateLimit: number;
    lastIndex: number;
    baseCurrency: string;
  };
}

export interface Connection {
  exchangeId: string;
  userId: string;
  proxyIp?: string;
  exchange?: Exchange;
  publicKey: string;
  secretKey: string;
  passphrase?: string;
  rateLimit: number;
  lastIndex: number;
}
