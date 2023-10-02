import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CommonProcessor } from '@cupo/backend/common';
import {
  QUEUE_NAME,
  QUEUE_TYPE,
  QueueParamsCancelOrders,
  QueueParamsCloseOrders,
  QueueParamsOpenOrder,
  QueueParamsUpdateOrders,
} from '@cupo/backend/interface';
import { OrdersService } from './orders.service';

@Processor(QUEUE_TYPE.ORDER)
export class OrderProcessor extends CommonProcessor {
  constructor(private readonly orders: OrdersService) {
    super(QUEUE_TYPE.ORDER);
  }

  @Process({ name: QUEUE_NAME.CANCEL_ORDER, concurrency: 16 })
  async cancelOrderProcessor(job: Job<QueueParamsCancelOrders>): Promise<void> {
    if (!job.data.exchangeId || !job.data.userId) {
      Logger.error(`Invalid job parameters for ${QUEUE_NAME.CANCEL_ORDER.toUpperCase()}: ${JSON.stringify(job.data)}`);
      await job.discard();
      return;
    }

    if (await this.orders.cancelOrder(job.data)) {
      Logger.log(`*** Canceled orders... ${JSON.stringify(job.data)}`);
    }
  }

  @Process({ name: QUEUE_NAME.OPEN_ORDER, concurrency: 1 })
  async openOrderProcessor(job: Job<QueueParamsOpenOrder>): Promise<void> {
    const { exchangeId, symbol, order, type, userId, comment } = job.data;

    if (!exchangeId || !symbol || !order?.type || !userId) {
      Logger.error(`Invalid job parameters for ${QUEUE_NAME.OPEN_ORDER.toUpperCase()}: ${JSON.stringify(job.data)}`);
      await job.discard();
      return;
    }

    if (process.env.TRADE_ALLOWED === '0' || process.env.TRADE_ALLOWED?.toLowerCase() === 'false') {
      await job.discard();
      return;
    }

    if (process.env.TRADE_OPEN_NEW_ALLOWED === '0' || process.env.TRADE_OPEN_NEW_ALLOWED?.toLowerCase() === 'false') {
      await job.discard();
      return;
    }

    const orderId = await this.orders.openOrder(job.data);

    if (typeof orderId === 'string') {
      const price = await this.orders.getMarketPrice(exchangeId, symbol);

      if (order?.isVirtual) {
        Logger.log(
          `VIRTUAL Open: [${exchangeId}] ${symbol}, ${type} Cost: ${(price?.bid * order?.volume).toFixed(2)}, Ask: ${
            price?.ask
          }, V: ${order?.volume?.toFixed(6)}, User: ${userId} Order: ${orderId} - ${comment}`
        );
      } else {
        Logger.verbose(
          `REAL Open: [${exchangeId}] ${symbol}, ${type} Cost: ${(price?.bid * order?.volume).toFixed(2)}, Ask: ${
            price?.ask
          }, V: ${order?.volume?.toFixed(6)}, User: ${userId} Order: ${orderId} - ${comment}`
        );
      }
    } else {
      Logger.error(
        `Error Open Order: ${JSON.stringify(orderId)} [${exchangeId}] ${symbol}, ${type} V: ${order?.volume?.toFixed(
          6
        )} ${type}, User: ${userId} - ${comment}`
      );
    }
  }

  @Process({ name: QUEUE_NAME.CLOSE_ORDER, concurrency: 4 })
  async closeOrderProcessor(job: Job<QueueParamsCloseOrders>): Promise<void> {
    if (!job.data.exchangeId || !job.data.symbol || !job.data.userId) {
      Logger.error(`Invalid job parameters for ${QUEUE_NAME.CLOSE_ORDER.toUpperCase()}: ${JSON.stringify(job.data)}`);
      await job.discard();
      return;
    }

    const { exchangeId, symbol, userId, comment } = job.data;

    const closedOrders = await this.orders.closeOrder(job.data);
    if (Array.isArray(closedOrders)) {
      if (closedOrders.length) {
        Logger.log(
          `Closed Orders: [${exchangeId}] ${symbol}, user: ${userId} ${comment}: [${closedOrders?.toString()}]`
        );
      }
    } else if (closedOrders?.message) {
      Logger.error(`*** Error Close Orders: ${closedOrders.message} ... ${JSON.stringify(job.data)}`);
    }
  }

  @Process({ name: QUEUE_NAME.UPDATE_ORDER, concurrency: 16 })
  async updateOrderProcessor(job: Job<QueueParamsUpdateOrders>): Promise<void> {
    if (!job.data?.userId || !job.data?.exchangeId || !job.data?.orders?.length) {
      Logger.error(`Invalid job parameters for ${QUEUE_NAME.UPDATE_ORDER.toUpperCase()}: ${JSON.stringify(job.data)}`);
      await job.discard();
      return;
    }

    await this.orders.updateOrders(job.data);
    Logger.verbose(`*** Update Order... ${JSON.stringify(job.data)}`);
  }
}
