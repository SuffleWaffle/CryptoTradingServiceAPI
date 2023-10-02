import { TIMEFRAME } from '@cupo/timeseries';

export enum TRADE_STRATEGIES {
  CUPO = 'CUPO',
  PAX_1 = 'PAX-1', // MACD
  PAX_2 = 'PAX-2', // EMA
}

const COMMON_STRATEGY_PARAMETERS = {
  virtualOrdersAllowed: false,

  tradeBalance: 1000, // maximum balance used for trading

  minimumBalance: 210, // minimum balance USDT or USD

  maximumOpenedSymbols: 8, // maximum opened symbols at one time

  enableTrailing: false,

  trailingTP: 3, // minimum Trailing Take Profit, in %, for all orders

  trailingStep: 1, // Trailing step - шаг тейк профита в % от цены закрытия ордера.

  emptySymbolsListIsAllSymbols: false, // if true, then empty symbols list means all symbols
};

const CUPO_STRATEGY_PARAMETERS = {
  strategyId: TRADE_STRATEGIES.CUPO,

  minimumBalance: 210, // minimum balance USDT or USD

  maximumOpenedSymbols: 4, // maximum opened symbols at one time

  orderGroupSize: 4, // «Group orders» - количество ордеров которые откроются при росте цены включая ордер №1

  orderGroupTPPercent: 3, // «TP % group orders» - тейк профит по которому будет закрываться вся группа ордеров. Ставится от последнего открытого ордера из группы.

  uUpOrdersPricePercent: 5, // “U-Up Orders %” - насколько % должна вырасти цена от предыдущего открытого ордера, чтобы открыть следующий ордер.

  uDownVolumePercent: 20, // “U-Down Volume %” - насколько % каждый дополнительный ордер будет меньше по объему от предыдущего - начинает работать со 2-го ордера включительно.

  minimumLotSum: 10.1, // Minimum Lot Sum - минимальная сумма лота в USDT для открытия ордера.

  commissionSizePercent: 0.2, // Commission Size % - комиссия биржи в % от суммы лота.

  lotPercent: 5, // «Lot %» - объем закупки для первого ордера
  // Например депозит $1000– и значение «Lot %» 10% - то робот откроет первый ордер на сумму $100 – сделать в % от депозита!

  xLotPercent: 20, // «X Lot %» - выбираем на сколько % умножать каждый дополнительный ордер. Умножение работает по принципу сложного процента.

  stepPricePercent: 5, // «Step %» - на сколько % должна упасть цена от первого ордера, чтобы робот начал искать точку входа для следующего дополнительного ордера №2.

  xStepMultiplier: 1.5, // «X Step» - сделать умножение шага при падении цены на коэффициент (можно регулировать от 1.1). Работает после открытия ордера №2. «если выставить 0.0 - значит не умножается».

  tpPercent: 5, // «TProfit %» - работает для всех ордеров которые открываются ниже первого ордера.

  tpShift: true, // “TP-Shift” - true/false - работает только ниже 1-го ордера.
  // true - тейкпрофиты всех ордеров начиная со 2-го ставятся на место открытия предыдущих ордеров.
  // false - работает стандартный параметр «TProfit %».

  timeframe: TIMEFRAME.M30, // strategy timeframe

  uTimeframe1: TIMEFRAME.H2, // “U-Time 1” 2H - таймфрейм на котором будет работать индикатор для открытия первого ордера
  // и тех ордеров которые открываются при падении цены. (от М5 до 1Мес как на TradingView).

  uTimeframe2: TIMEFRAME.H4, // “U-Time 2” 4H - этот таймфрейм используется если открыт 1-ый ордер и цена растет.
  // (от М5 до 1Мес как на TradingView).
};

const CUPO_STRATEGY_PARAMETERS_TEST = {
  tradeBalance: 500, // maximum balance used for trading

  minimumBalance: 210, // minimum balance USDT or USD

  maximumOpenedSymbols: 4, // maximum opened symbols at one time

  orderGroupSize: 4, // «Group orders» - количество ордеров которые откроются при росте цены включая ордер №1

  orderGroupTPPercent: 2, // «TP % group orders» - тейк профит по которому будет закрываться вся группа ордеров. Ставится от последнего открытого ордера из группы.

  uUpOrdersPricePercent: 2, // “U-Up Orders %” - насколько % должна вырасти цена от предыдущего открытого ордера, чтобы открыть следующий ордер.

  uDownVolumePercent: 0, // “U-Down Volume %” - насколько % каждый дополнительный ордер будет меньше по объему от предыдущего - начинает работать со 2-го ордера включительно.

  minimumLotSum: 1, // Minimum Lot Sum - минимальная сумма лота в USDT для открытия ордера.
  // minimumLotSum: 10.1, // Minimum Lot Sum - минимальная сумма лота в USDT для открытия ордера.

  commissionSizePercent: 0.2, // Commission Size % - комиссия биржи в % от суммы лота.

  lotPercent: 5, // «Lot %» - объем закупки для первого ордера
  // Например депозит $1000– и значение «Lot %» 10% - то робот откроет первый ордер на сумму $100 – сделать в % от депозита!

  xLotPercent: 10, // «X Lot %» - выбираем на сколько % умножать каждый дополнительный ордер. Умножение работает по принципу сложного процента.

  stepPricePercent: 2, // «Step %» - на сколько % должна упасть цена от первого ордера, чтобы робот начал искать точку входа для следующего дополнительного ордера №2.

  // «X Step» - сделать умножение шага при падении цены на коэффициент (можно регулировать от 1.1).
  // Работает после открытия ордера №2. «если выставить 0.0 - значит не умножается».
  xStepMultiplier: 1.5,

  tpPercent: 2, // «TProfit %» - работает для всех ордеров которые открываются ниже первого ордера.

  tpShift: true, // “TP-Shift” - true/false - работает только ниже 1-го ордера.
  // true - тейкпрофиты всех ордеров начиная со 2-го ставятся на место открытия предыдущих ордеров.
  // false - работает стандартный параметр «TProfit %».

  timeframe: TIMEFRAME.M15, // strategy timeframe

  uTimeframe1: TIMEFRAME.M30, // “U-Time 1” 2H - таймфрейм, на котором будет работать индикатор для открытия первого ордера
  // и тех ордеров, которые открываются при падении цены. (от М5 до 1Мес как на TradingView).

  uTimeframe2: TIMEFRAME.H1, // “U-Time 2” 4H - этот таймфрейм используется если открыт 1-ый ордер и цена растет.
  // (от М5 до 1Мес как на TradingView).
};

export const CUPO_STRATEGY_PARAMS = { ...COMMON_STRATEGY_PARAMETERS, ...CUPO_STRATEGY_PARAMETERS };

// const CUPO_STRATEGY_PAX_PARAMETERS_TEST = {
//   "id": "BINANCE_API_PAVEL",
//   "name": "Pavel",
//   "active": true,
//   "currencies": [],
//   "excludedCurrencies": [
//     "NFT",
//     "PURSE",
//     "SOLO",
//     "LUNC"
//   ],
//   "exchanges": [
//     {
//       "exchangeId": "binance",
//       "publicKey": "ECZ9FK",
//       "secretKey": "Cm9irg",
//       "passphrase": "Cm9ir",
//       "baseCurrency": "USDT",
//       "symbols": [
//       ]
//     }
//   ],
//   "strategy": {
//     "minimumBalance": 150,
//     "maximumOpenedSymbols": 13,
//     "orderGroupSize": 4,
//     "orderGroupTPPercent": 3,
//     "uUpOrdersPricePercent": 1,
//     "uDownVolumePercent": 5,
//     "minimumLotSum": 10.1,
//     "commissionSizePercent": 0.2,
//     "lotPercent": 5,
//     "xLotPercent": 10,
//     "stepPricePercent": 1,
//     "xStepMultiplier": 2.0,
//     "tpPercent": 1,
//     "tpShift": true,
//     "timeframe": "5m",
//     "uTimeframe1": "30m",
//     "uTimeframe2": "1h"
//   },
//   "update": 1661240765343
// };

export function getMinimumLotCost(strategy, marketMinCost: number): number {
  return Math.max(0.1, marketMinCost || 0, strategy.minimumLotSum) * (1 + strategy.commissionSizePercent / 100);
}
