import { Injectable } from '@nestjs/common';
import { EVENT, EVENT_KIND, IGetAllEvents, ORDER_EVENT, SYSTEM_EVENT, USER_EVENT } from '@cupo/backend/interface';
import { CollectionNames } from './collections';
import { MongodbService } from './mongodb.service';

@Injectable()
export class EventsMongodbService extends MongodbService {
  async saveOrderEvent(event: ORDER_EVENT): Promise<string | null> {
    const now = new Date(event.time || Date.now());
    const res = await this.insertOne<ORDER_EVENT>(CollectionNames.PlatformEvents, {
      ...event,
      type: event.type,
      time: now.getTime(),
      humanTime: now,
    });

    return res?.insertedId?.toString() || null;
  }

  async saveUserEvent(event: USER_EVENT): Promise<string | null> {
    const now = new Date(event.time || Date.now());
    const res = await this.insertOne<USER_EVENT>(CollectionNames.PlatformEvents, {
      ...event,
      type: event.type,
      time: now.getTime(),
      kind: EVENT_KIND.USER,
      humanTime: now,
    });

    return res?.insertedId?.toString() || null;
  }

  async saveSystemEvent(event: SYSTEM_EVENT): Promise<string | null> {
    const now = new Date(event.time || Date.now());
    const res = await this.insertOne<SYSTEM_EVENT>(CollectionNames.PlatformEvents, {
      ...event,
      type: event.type,
      time: now.getTime(),
      kind: EVENT_KIND.SYSTEM,
      humanTime: now,
    });

    return res?.insertedId?.toString() || null;
  }

  async getPlatformEvents(params: IGetAllEvents): Promise<{ events: EVENT[]; totalItems: number }> {
    const { page, itemsPerPage, ...query } = params;

    const totalItems = await this.count(CollectionNames.PlatformEvents, query);

    const events = await this.find<EVENT>(
      CollectionNames.PlatformEvents,
      {
        ...query,
      },
      { sort: { _id: -1 }, limit: itemsPerPage || 10, skip: page ? (page - 1) * (itemsPerPage || 10) : 0 }
    );

    return { events: events || [], totalItems };
  }

  async getPlatformEventItem(time: number): Promise<EVENT | null> {
    return this.findOne<EVENT>(CollectionNames.PlatformEvents, {
      time,
    });
  }
}
