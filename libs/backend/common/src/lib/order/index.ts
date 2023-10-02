import { OPERATION_TYPE, TradeOrder } from '@cupo/backend/interface';
import { ENABLED_EXCHANGES } from '@cupo/backend/constant';

export function getOpenedOrderProfit(order: TradeOrder, price: number): number {
  if (order.type === OPERATION_TYPE.BUY) {
    return (
      (order.volume > order.openVolume
        ? (price || 0) * order.openVolume * (1 - ENABLED_EXCHANGES[order.exchangeId].takerFee)
        : (price || 0) * order.volume) -
      (price ? order.openPrice : 0) * order.openVolume * (1 + ENABLED_EXCHANGES[order.exchangeId].takerFee)
    );
  } else if (order.type === OPERATION_TYPE.SELL) {
    return (
      (order.openPrice || 0) * order.openVolume * (1 - ENABLED_EXCHANGES[order.exchangeId].takerFee) -
      (price || 0) * order.volume * (1 + ENABLED_EXCHANGES[order.exchangeId].takerFee)
    );
  }

  return (
    (order.volume > order.openVolume
      ? (price || 0) * order.openVolume * (1 - ENABLED_EXCHANGES[order.exchangeId].takerFee)
      : (price || 0) * order.volume) -
    (price ? order.openPrice : 0) * order.openVolume * (1 + ENABLED_EXCHANGES[order.exchangeId].takerFee)
  );
}

export function getClosedOrderProfit(order: TradeOrder): number {
  return (
    (order.volume > order.openVolume
      ? (order.closePrice || 0) * order.openVolume * (1 - ENABLED_EXCHANGES[order.exchangeId].takerFee)
      : (order.closePrice || 0) * order.volume) -
    (order.closePrice ? order.openPrice : 0) * order.openVolume * (1 + ENABLED_EXCHANGES[order.exchangeId].takerFee)
  );
}
