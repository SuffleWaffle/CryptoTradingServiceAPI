// import { TradeOrderType } from '@cupo/backend/common';
// import { TradeOrderEntity } from '../entities/tradeOrderEntity';

// export function OrderToEntity(order: TradeOrderType): TradeOrderEntity {
//   return {
//     ...order,
//     created: (order.created || 0) === 0 ? undefined : new Date(order.created),
//     updated: (order.updated || 0) === 0 ? undefined : new Date(order.updated),
//     openTime: (order.openTime || 0) === 0 ? undefined : new Date(order.openTime),
//     closeTime: (order.closeTime || 0) === 0 ? undefined : new Date(order.closeTime),
//   };
// }
