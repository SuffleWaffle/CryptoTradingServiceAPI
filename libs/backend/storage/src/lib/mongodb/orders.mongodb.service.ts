import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Sort } from 'mongodb';
import { IGetAllOrders, ORDER_STATUS, TradeOrder, TradeOrderIdType, TradeSignalType } from '@cupo/backend/interface';
import { CollectionNames } from './collections';
import { MongodbService } from './mongodb.service';

@Injectable()
export class OrdersMongodbService extends MongodbService implements OnModuleDestroy {
  // **************
  // *** ORDERS ***
  // **************
  async getOrderItem(orderId: string): Promise<TradeOrder | null> {
    const order = await this.findOne<TradeOrder>(CollectionNames.Orders, { id: orderId });

    return order || null;
  }

  async getOrders(params: {
    userId: string;
    exchangeId: string;
    symbol?: string | undefined;
    active?: boolean | undefined; // default = undefined
    opened?: boolean | undefined; // default = undefined, only for active orders
    cancelled?: boolean | undefined; // default = undefined
    virtual?: boolean | undefined; // default = undefined
    orderIds?: string[];
    deleted?: boolean | undefined; // default = false
    sort?: 'openPrice' | 'openTime' | 'profit' | 'closeTime'; // default = 'openPrice'
    sortOrder?: 1 | -1; // default = 1,
    orderStatus?: ORDER_STATUS;
  }): Promise<TradeOrder[]> {
    const {
      userId,
      exchangeId,
      symbol,
      active,
      opened,
      cancelled,
      virtual,
      orderIds,
      deleted,
      sort,
      sortOrder,
      orderStatus,
    } = params;

    const orders = (
      await this.find<TradeOrder>(
        CollectionNames.Orders,
        { exchangeId, userId },
        { sort: sort ? { [sort]: sortOrder || -1 } : { closeTime: -1, openTime: -1 } }
      )
    ).filter(
      (order) =>
        order &&
        (orderStatus === undefined || order.status === orderStatus) &&
        (((deleted === undefined || deleted === false) && !order.isDeleted) || (deleted && order.isDeleted)) &&
        (active === undefined ||
          (active === true &&
            (order.status?.toUpperCase() === ORDER_STATUS.OPENED ||
              order.status?.toUpperCase() === ORDER_STATUS.WAIT_OPEN)) ||
          (active === false &&
            order.status?.toUpperCase() !== ORDER_STATUS.OPENED &&
            order.status?.toUpperCase() !== ORDER_STATUS.WAIT_OPEN)) &&
        (symbol === undefined || order.symbol === symbol) &&
        (opened === undefined ||
          (opened === true && order.status === ORDER_STATUS.OPENED) ||
          (opened === false && order.status === ORDER_STATUS.WAIT_OPEN)) &&
        (cancelled === undefined ||
          (cancelled === true && order.status === ORDER_STATUS.CANCELLED) ||
          (cancelled === false && order.status !== ORDER_STATUS.CANCELLED)) &&
        (virtual === undefined ||
          (virtual === false && order.isVirtual === false) ||
          (virtual === true && (order.isVirtual === true || order.isVirtual === undefined))) &&
        (!orderIds?.length || orderIds.includes(order.id))
    );

    return orders || [];
  }

  async getAllOrders(params: IGetAllOrders): Promise<{ orders: TradeOrder[]; totalItems: number }> {
    const { exchangeId, userId, userIds, orderId, orderIds, symbol, status, deleted, virtual } = params;

    const query = {};
    if (exchangeId) {
      query['exchangeId'] = exchangeId.toLowerCase();
    }

    if (userIds?.length) {
      query['userId'] = { $in: userIds };
    } else if (userId) {
      query['userId'] = userId;
    }

    if (orderIds?.length) {
      query['id'] = { $in: orderIds };
    } else if (orderId) {
      query['id'] = new RegExp(`.*${orderId}.*`, 'i');
    }

    if (
      status?.length &&
      (status.toUpperCase() === ORDER_STATUS.OPENED ||
        status === ORDER_STATUS.CLOSED ||
        status === ORDER_STATUS.CANCELLED)
    ) {
      query['status'] = status.toUpperCase();
    } else if (status?.length) {
      query['status'] = new RegExp(`.*${status}.*`, 'i');
    }
    if (symbol?.length) {
      query['symbol'] = new RegExp(`.*${symbol}.*`, 'i');
    }
    if (exchangeId?.length) {
      query['exchangeId'] = new RegExp(`.*${exchangeId}.*`, 'i');
    }

    if (deleted !== undefined) {
      if (deleted === true) {
        query['isDeleted'] = true;
      } else {
        query['isDeleted'] = { $ne: true };
      }
    }

    if (virtual !== true) {
      query['isVirtual'] = { $ne: true };
    }

    // console.log('getAllOrders: query', query);

    let orders = [];
    const totalItems = await this.count(CollectionNames.Orders, query);

    if (totalItems > 0) {
      const page = Math.max(params.page || 1, 1);
      const limit = Math.min(Math.max(params.itemsPerPage || 25, 1), 100);

      const sortField: string = params.sort || 'created';
      const sortDirection: number = params.sortOrder || -1;
      const sort = sortField
        ? ({ [sortField]: sortDirection } as Sort)
        : ({
            closeTime: sortDirection,
            openTime: sortDirection,
          } as Sort);

      orders = await this.find<TradeOrder>(CollectionNames.Orders, query, {
        sort,
        skip: (page - 1) * limit,
        limit,
      });
    }

    // .filter(
    //   (order) =>
    //     order &&
    //     (status === undefined || order.status === status) &&
    //     (active === undefined ||
    //       (active === true &&
    //         (order.status?.toUpperCase() === ORDER_STATUS.OPENED ||
    //           order.status?.toUpperCase() === ORDER_STATUS.WAIT_OPEN)) ||
    //       (active === false &&
    //         order.status?.toUpperCase() !== ORDER_STATUS.OPENED &&
    //         order.status?.toUpperCase() !== ORDER_STATUS.WAIT_OPEN)) &&
    //     (symbol === undefined || order.symbol === symbol) &&
    //     (active === undefined ||
    //       (active === true && order.status === ORDER_STATUS.OPENED) ||
    //       (active === false && order.status === ORDER_STATUS.WAIT_OPEN)) &&
    //     (virtual === undefined ||
    //       (virtual === false && order.isVirtual === false) ||
    //       (virtual === true && (order.isVirtual === true || order.isVirtual === undefined)))
    // );

    return { orders, totalItems };
  }

  // get orders from Redis
  async getOrderSymbols(params: {
    userId: string;
    exchangeId: string;
    symbol?: string | undefined;
    active?: boolean | undefined; // default = undefined
    virtual?: boolean | undefined; // default = undefined
    deleted?: boolean | undefined; // default = false
  }): Promise<string[]> {
    const symbols: string[] = [];

    if (!params) {
      return symbols;
    }

    const { userId, exchangeId, symbol, active, virtual, deleted } = params;

    const orders = await this.getOrders({ exchangeId, userId, symbol, active, virtual, deleted });
    if (!orders) {
      return symbols;
    }

    orders.forEach((order) => {
      if (symbols.indexOf(order.symbol) === -1) {
        symbols.push(order.symbol);
      }
    });

    return symbols.sort();
  }

  async deleteAllUserOrders(userId: string, exchangeId: string): Promise<void> {
    const orders = await this.getOrders({ userId, exchangeId });

    for (const order of orders) {
      await this.updateMany<TradeOrder>(
        CollectionNames.Orders,
        {
          exchangeId,
          userId,
          id: order.id,
        },
        { isDeleted: true }
      );
    }
  }

  async deleteUserOrder(params: { userId: string; exchangeId: string; id: TradeOrderIdType }): Promise<void> {
    const { userId, exchangeId, id } = params;

    await this.updateMany<TradeOrder>(
      CollectionNames.Orders,
      {
        exchangeId,
        userId,
        id,
      },
      { isDeleted: true }
    );
  }

  async cancelUserOrder(params: { userId: string; exchangeId: string; id: TradeOrderIdType }): Promise<void> {
    const { userId, exchangeId, id } = params;

    await this.updateOne<TradeOrder>(
      CollectionNames.Orders,
      {
        exchangeId,
        userId,
        id,
      },
      { status: ORDER_STATUS.CANCELLED, closeTime: new Date().getTime(), commentClose: 'Cancelled by user' }
    );
  }

  // cancel virtual orders before open a real order
  async deleteVirtualUserOrders(params: {
    userId: string;
    exchangeId: string;
    symbol?: string | undefined;
  }): Promise<number> {
    const { userId, exchangeId, symbol } = params;

    let returnBalance = 0;

    const orders = await this.getOrders({ userId, exchangeId, symbol, virtual: true });
    if (!orders) {
      return returnBalance;
    }

    for (const order of orders) {
      if (order.status === ORDER_STATUS.OPENED) {
        returnBalance += (order.openVolume || order.volume) * order.openPrice;
      }

      await this.updateMany<TradeOrder>(
        CollectionNames.Orders,
        {
          exchangeId,
          userId,
          id: order.id,
        },
        { isDeleted: true }
      );
    }

    return returnBalance;
  }

  async collectOrders(orders: TradeOrder[]): Promise<void> {
    await this.updateManyWithBulkWrite(
      CollectionNames.Orders,
      orders.map((order) => {
        return {
          filter: { id: order.id },
          replacement: order,
        };
      })
    );
  }

  async addSignal(signal: TradeSignalType): Promise<void> {
    await this.insertOne(CollectionNames.TradeSignals, signal);
  }
}
