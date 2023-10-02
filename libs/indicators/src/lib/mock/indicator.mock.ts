import {
  INDICATOR_NAME,
  INDICATOR_PARAMS_CM_U_MTF_V2,
  INDICATOR_PARAMS_COMMON,
  INDICATOR_PARAMS_MA,
  INDICATOR_PARAMS_MACD,
  INDICATOR_TYPE,
  PRICE_TYPE,
} from '../indicator.constant';
import { IndicatorCard } from '../indicator.interface';

export const INDICATOR_MOCKS: IndicatorCard[] = [
  {
    id: 'macd_fastema12_slowema26_ap0_signalsma9',
    description: 'Moving Average Convergence/Divergence (Fast EMA: 12, Slow EMA: 26, Applied price: CLOSE, Signal SMA: 9)',
    type: INDICATOR_TYPE.OSCILLATOR,
    name: INDICATOR_NAME.MACD,
    params: {
      [INDICATOR_PARAMS_MACD.FAST_PERIOD]: 12,
      [INDICATOR_PARAMS_MACD.SLOW_PERIOD]: 26,
      [INDICATOR_PARAMS_MACD.SIGNAL_PERIOD]: 9,
    },
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'lwma_len20_close',
    description: 'Linear Weighted Moving Average',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.LWMA,
    params: {
      [INDICATOR_PARAMS_MA.PERIOD]: 20,
    },
    isArchived: true,
    isDeleted: false,
  },
  {
    id: 'sma_len3_ap0_shift2',
    description: 'Simple Moving Average – CUPO Trading fast line',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.SMA,
    params: {
      [INDICATOR_PARAMS_MA.PERIOD]: 3,
      [INDICATOR_PARAMS_COMMON.SHIFT]: 2,
    },
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'ema_len12_ap0_shift0',
    description: 'Exponential Moving Average - Fast Period 12',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.EMA,
    params: {
      [INDICATOR_PARAMS_MA.PERIOD]: 12,
    },
    isArchived: true,
    isDeleted: false,
  },
  {
    id: 'ema_len26_ap0_shift0',
    description: 'Exponential Moving Average - Slow Period 26',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.EMA,
    params: {
      [INDICATOR_PARAMS_MA.PERIOD]: 26,
    },
    isArchived: true,
    isDeleted: false,
  },
  {
    id: 'sma_len32_ap1_shift2',
    description: 'Simple Moving Average – CUPO Trading slow line',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.SMA,
    params: {
      [INDICATOR_PARAMS_MA.PERIOD]: 32,
      [INDICATOR_PARAMS_COMMON.SHIFT]: 2,
      [INDICATOR_PARAMS_COMMON.APPLIED_PRICE]: PRICE_TYPE.OPEN,
    },
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'CM_Ultimate_MTF_V2_tf0_period20_t3factor7_mamode0_smooth1',
    description: 'CM Ultimate MA MTF V2 – CUPO Trading trend color line',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.CM_U_MTF_V2,
    params: {
      [INDICATOR_PARAMS_CM_U_MTF_V2.TIMEFRAME]: 0, // ENUM_TIMEFRAMES resCustom = PERIOD_CURRENT;//Timeframe:
      [INDICATOR_PARAMS_CM_U_MTF_V2.PERIOD]: 20, // int             len       = 20;            //Moving Average Length - LookBack Period:
      [INDICATOR_PARAMS_CM_U_MTF_V2.T3_FACTOR]: 7, // int             factorT3  = 7;             //Tilson T3 Factor - *.10 - so 7 = .7 etc.:
      [INDICATOR_PARAMS_CM_U_MTF_V2.MA_MODE]: 0, // var_ind_type    atype     = SMA;           //Mode:
      [INDICATOR_PARAMS_CM_U_MTF_V2.SMOOTH]: 1, // int             smoothe   = 1;             //Color Smoothing - Setting 1 = No Smoothing:
      [INDICATOR_PARAMS_COMMON.APPLIED_PRICE]: PRICE_TYPE.CLOSE,
    },
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'ema_len8_ap0_shift0',
    description: 'Exponential Moving Average - Fast Period 8',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.EMA,
    params: {
      [INDICATOR_PARAMS_MA.PERIOD]: 8,
      [INDICATOR_PARAMS_COMMON.APPLIED_PRICE]: PRICE_TYPE.CLOSE,
    },
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'ema_len89_ap0_shift0',
    description: 'Exponential Moving Average - Fast Period 89',
    type: INDICATOR_TYPE.TREND,
    name: INDICATOR_NAME.EMA,
    params: {
      [INDICATOR_PARAMS_MA.PERIOD]: 89,
      [INDICATOR_PARAMS_COMMON.APPLIED_PRICE]: PRICE_TYPE.CLOSE,
    },
    isArchived: false,
    isDeleted: false,
  },
];
