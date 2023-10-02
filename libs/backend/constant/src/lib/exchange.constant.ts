export const BAD_USER_COUNTER = 5; // count of bad requests to exchange
export const BAD_USER_EXPIRATION = 1000 * 60 * 15; // milliseconds

export const EXCHANGE_TICKERS_EXPIRATION = 1000 * 60 * 60 * 4; // milliseconds - 4 hours

export const EXCHANGE_METADATA_EXPIRATION = 30000; // milliseconds
export const EXCHANGE_OVER_LIMIT_EXPIRATION = 180000; // milliseconds

export const getEnabledExchanges = (): {
  [exchangeId: string]: { baseCurrencies: string[]; authErrors: string[]; takerFee: number; makerFee: number };
} => {
  const exchanges = { ...ENABLED_EXCHANGES };

  delete exchanges['bitso'];

  return exchanges;
};

export const getEnabledExchangeIds = (): string[] => {
  return Object.keys(getEnabledExchanges());
};

export enum USER_EXCHANGE_STATUS {
  ACTIVE = 'active', // keys are OK
  INACTIVE = 'inactive', // disabled
  PENDING = 'pending', // waiting for approve for the Exchange
  NOT_CONFIGURED = 'not_configured', // the keys are not configured or empty
  BROKEN = 'broken', // the Exchange don't accept the keys
}

export const ENABLED_EXCHANGES: {
  [exchangeId: string]: {
    baseCurrencies: string[];
    authErrors: string[];
    keysErrors: string[];
    takerFee: number;
    makerFee: number;
  };
} = {
  binance: {
    baseCurrencies: ['USDT'],
    authErrors: [
      '{"code":-2008,"msg":"Invalid Api-Key ID."}',
      '{"code":-1022,"msg":"Signature for this request is not valid."}',
      'requires "secret" credential',
      'requires "apiKey" credential',
    ],
    keysErrors: [
      'Invalid API-key, IP, or permissions for action',
      '{"code":-2010,"msg":"This action is disabled on this account."}',
      'action is disabled on this account',
    ],

    // https://www.binance.com/en/fee/schedule
    takerFee: 0.001,
    makerFee: 0.001,
  },
  coinbasepro: {
    baseCurrencies: ['USD'],
    authErrors: [
      '401 Unauthorized {"message":"Invalid API Key"}',
      '401 Unauthorized {"message":"invalid signature"}',
      '401 Unauthorized {"message":"Invalid Passphrase"}',
      'requires "apiKey" credential',
      'requires "secret" credential',
      'requires "password" credential',
    ],
    keysErrors: [],

    takerFee: 0.001,
    makerFee: 0.001,
  },
  binanceus: {
    baseCurrencies: ['USD'],
    authErrors: [
      '{"code":-2008,"msg":"Invalid Api-Key ID."}',
      '{"code":-1022,"msg":"Signature for this request is not valid."}',
      'requires "secret" credential',
      'requires "apiKey" credential',
    ],
    keysErrors: [
      'Invalid API-key, IP, or permissions for action',
      '{"code":-2010,"msg":"This action is disabled on this account."}',
      'action is disabled on this account',
    ],

    // https://www.binance.us/en/fee/schedule
    takerFee: 0.001,
    makerFee: 0.001,
  },
  bitfinex: {
    baseCurrencies: ['USD'],
    authErrors: [
      '401 Unauthorized {"message":"Could not find a key matching the given X-BFX-APIKEY."}',
      '401 Unauthorized {"message":"Invalid X-BFX-SIGNATURE."}',
      'requires "apiKey" credential',
      'requires "secret" credential',
    ],
    keysErrors: [],

    // https://www.bitfinex.com/fees/
    takerFee: 0.002,
    makerFee: 0.002,
  },
  bitso: {
    baseCurrencies: ['USD'],
    authErrors: [
      '{"success":false,"error":{"code":"0201","message":"Check your credentials"}}',
      'requires "secret" credential',
      'requires "apiKey" credential',
      '{"success":false,"error":{"code":"0207","message":"Cannot perform request - nonce must be higher than"}}',
    ],
    keysErrors: [],

    // https://bitso.com/fees
    takerFee: 0.006,
    makerFee: 0.0025,
  },
};

export const FIAT = ['AUD', 'BIDR', 'BRL', 'EUR', 'GBP', 'RUB', 'TRY', 'UAH', 'ZAR', 'VAI', 'IDRT', 'NGN'];

export const STABLES = [
  // 'USDT',
  'USDC',
  'BUSD',
  'DAI',
  'USDP',
  'TUSD',
  'USDD',
  'USDN',
  'FEI',
  'USTC',
  'GUSD',
  'TRIBE',
  'FRAX',
  'HUSD',
  'LUSD',
  'EURS',
  'vUSDC',
  'USDX',
  'SUSD',
  'vBUSD',
  'VAI',
  'CUSD',
  'XSGD',
  'OUSD',
  'MUSD',
  'CEUR',
  'vUSDT',
  'SBD',
  'RSV',
  'USDK',
  'KRT',
  'BIDR',
  'IDRT',
  'DGD',
  'vDAI',
  'BITCNY',
  'XCHF',
  'EOSDT',
  'DGX',
  'ESD',
  'USDS',
  'BAC',
  'ITL',
  'USDP',
  'CUSDT',
  'USDZ',
  'AGEUR',
  'MIM',
  'USDH',
  'DUSD',
  'TRYB',
  'TOR',
  'SEUR',
  'MTR',
  'USDEX',
  'xDAI',
  'DUSD',
  'EURT',
  'USN',
  'USDs',
  'JPYC',
  'MIMATIC',
  'ONC',
  'mCUSD',
  'MUSD',
  'DOLA',
  'WANUSDT',
  'USDR',
  '1GOLD',
  'USDS',
  'mCEUR',
  'XSTUSD',
  'FUSD',
  'XUSD',
  'XIDR',
  'ARTH',
  'MXNT',
  'USDI',
  'YUSD',
  'PAR',
  'FUSD',
  'EUROS',
  'JPYC',
  'DPT',
  'USDB',
  'MONEY',
  'ALUSD',
  'CADC',
  'XUSD',
  'IUSDS',
  'IRON',
  'BRCP',
  'COFFIN',
  'KBC',
  'DSD',
  'FLOAT',
  'fUSDT',
  'USX',
  'STATIK',
  'ONEICHI',
  'CUSD',
];

export const RISK_CURRENCIES = ['ACA', 'MIR', 'ANC', 'LUNA', 'TCT', 'NBS', 'WAVES', 'FTT', 'SRM'].map((currency) =>
  currency.toUpperCase()
);
export const EXCLUDED_CURRENCIES = [
  'SRM',
  'ETHUP',
  'ETHDOWN',
  'MKR',
  'BTTC',
  'TLOS',
  'SUKU',
  'BNBUP',
  'BNBDOWN',
  'TRXUP',
  'TRXDOWN',
  'BTCUP',
  'BTCDOWN',
  'DOTUP',
  'DOTDOWN',
  'ADAUP',
  'ADADOWN',
  'XRPUP',
  'XRPDOWN',
  'LINKUP',
  'LINKDOWN',
  'NFT',
  'PURSE',
  'SOLO',
  'LUNC',
  'BCHABC',
  'BCHSV',
  'BCHABC',
  'BCHABC',
  'BCHABC',
  ...RISK_CURRENCIES,
  ...STABLES,
  ...FIAT,
].map((currency) => currency.toUpperCase());

export const EXCLUDED_ARBITRAGE_CURRENCIES = ['SRM', ...STABLES, ...FIAT, ...RISK_CURRENCIES].map((currency) =>
  currency.toUpperCase()
);
