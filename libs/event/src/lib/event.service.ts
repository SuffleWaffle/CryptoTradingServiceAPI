import { Injectable, Logger } from '@nestjs/common';
import {
  EVENT,
  EVENT_KIND,
  EVENT_TYPE,
  IGetAllEvents,
  ORDER_EVENT,
  QueueParamsUpdateBalances,
  SYSTEM_EVENT,
  TradeOrder,
  USER_EVENT,
} from '@cupo/backend/interface';
import { EventsMongodbService, RedisOrderService, UserMongodbService } from '@cupo/backend/storage';
import { QueueService } from '@cupo/backend/queue';

@Injectable()
export class EventService {
  constructor(
    private readonly mongoUser: UserMongodbService,
    private readonly mongoEvent: EventsMongodbService,
    private readonly redisOrder: RedisOrderService,
    private readonly queueService: QueueService
  ) {}

  async addOrderEvent(order: string | TradeOrder, event: ORDER_EVENT): Promise<void> {
    if (!order) {
      return;
    }

    try {
      const data: ORDER_EVENT = { ...(event || { type: EVENT_TYPE.OTHER, kind: EVENT_KIND.ORDER }) };

      const dataOrder = {};
      if (typeof order === 'string') {
        dataOrder['orderId'] = order || event?.orderId || event?.data?.orderId || 'NEW-ORDER';
        dataOrder['userId'] = event?.userId || event?.data?.userId;
        dataOrder['symbol'] = event?.symbol || event?.data?.symbol;
        dataOrder['exchangeId'] = event?.exchangeId || event?.data?.exchangeId;
        dataOrder['isVirtual'] = event?.isVirtual || event?.data?.isVirtual;
      } else {
        dataOrder['orderId'] = order.id || event?.orderId || event?.data?.orderId || 'NEW-ORDER';
        dataOrder['userId'] = order.userId || event?.userId || event?.data?.userId;
        dataOrder['symbol'] = order.symbol || event?.symbol || event?.data?.symbol;
        dataOrder['exchangeId'] = order.exchangeId || event?.exchangeId || event?.data?.exchangeId;
        dataOrder['isVirtual'] = order.isVirtual || event?.isVirtual || event?.data?.isVirtual;
      }

      delete data.orderId;
      delete data.userId;
      delete data.exchangeId;
      delete data.symbol;

      await this.queueService.addJob_AddOrderEvent({
        ...dataOrder,
        ...data,
        read: false,
        kind: EVENT_KIND.ORDER,
      });

      // update order errors count
      if (event?.type === EVENT_TYPE.ORDER_ERROR) {
        const changeOrder = await this.redisOrder.getOrder({
          exchangeId: data.exchangeId,
          userId: data.userId,
          orderId: data.orderId,
        });
        if (changeOrder) {
          changeOrder.errorEvents = (changeOrder.errorEvents || 0) + 1;
          changeOrder.errorEventsUnread = (changeOrder.errorEventsUnread || 0) + 1;
          await this.redisOrder.setOrder(changeOrder);
        }
      }
    } catch (err) {
      Logger.error(err.message, err.stack, 'EventService.addOrderEvent');
    }
  }

  async addSystemEvent(event: SYSTEM_EVENT): Promise<void> {
    await this.queueService.addJob_AddSystemEvent({ ...event, read: false, kind: EVENT_KIND.SYSTEM });
  }

  async addUserEvent(event: USER_EVENT): Promise<void> {
    await this.queueService.addJob_AddUserEvent({ ...event, read: false, kind: EVENT_KIND.USER });
  }

  async saveOrderEvent(event: ORDER_EVENT): Promise<string | null> {
    return this.mongoEvent.saveOrderEvent(event);
  }

  async saveUserEvent(event: USER_EVENT): Promise<string | null> {
    return this.mongoEvent.saveUserEvent(event);
  }

  async saveSystemEvent(event: SYSTEM_EVENT): Promise<string | null> {
    return this.mongoEvent.saveSystemEvent(event);
  }

  async updateUserWallet(balances: QueueParamsUpdateBalances): Promise<boolean> {
    return this.mongoUser.updateUserWallet(balances);
  }

  async getUserEvents(params: {
    userId?: string;
    time?: number;
  }): Promise<{ events: USER_EVENT[]; totalItems: number }> {
    return (await this.getPlatformEvents({
      ...params,
      kind: EVENT_KIND.USER,
    })) as { events: USER_EVENT[]; totalItems: number };
  }

  async getOrderEvents(params: IGetAllEvents): Promise<{ events: ORDER_EVENT[]; totalItems: number }> {
    return (await this.getPlatformEvents({
      ...params,
      kind: EVENT_KIND.ORDER,
    })) as { events: ORDER_EVENT[]; totalItems: number };
  }

  async getSystemEvents(params: IGetAllEvents): Promise<{ events: SYSTEM_EVENT[]; totalItems: number }> {
    return (await this.getPlatformEvents({
      ...params,
      kind: EVENT_KIND.SYSTEM,
    })) as { events: SYSTEM_EVENT[]; totalItems: number };
  }

  async getPlatformEvents(params: IGetAllEvents): Promise<{ events: EVENT[]; totalItems: number }> {
    return this.mongoEvent.getPlatformEvents(params);
  }

  async getPlatformEventItem(time: number): Promise<EVENT | null> {
    return this.mongoEvent.getPlatformEventItem(time);
  }
}
