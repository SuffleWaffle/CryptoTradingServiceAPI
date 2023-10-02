import { IDocument } from './IDocument';

export interface ProxyInterface extends IDocument {
  ip: string;
  exchangeId: string;
  port?: number;
  username?: string;
  password?: string;
  protocol?: string;
  country: string;
  description?: string;
}

export interface UserProxyInterface extends IDocument {
  ip: string | null;
  userId: string;
  exchangeId: string;
}

export interface FreeProxyInterface {
  ip: string | null;
  exchangeId: string;
  country?: string;
}
