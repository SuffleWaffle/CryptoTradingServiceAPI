import { Injectable } from '@nestjs/common';
import { EVENT, IGetAllEvents, ORDER_EVENT, SYSTEM_EVENT, USER_EVENT } from '@cupo/backend/interface';
import { EventService } from '@cupo/event';

@Injectable()
export class EventApiService {
  constructor(private readonly service: EventService) {}

  async getAllEventsList(params: IGetAllEvents): Promise<{ events: EVENT[]; totalItems: number }> {
    return this.service.getPlatformEvents(params);
  }

  async getEventItem(time: number): Promise<EVENT | null> {
    return this.service.getPlatformEventItem(time);
  }

  async getOrderEvents(params: IGetAllEvents): Promise<{ events: ORDER_EVENT[]; totalItems: number }> {
    return this.service.getOrderEvents(params);
  }

  async getUserEvents(params: IGetAllEvents): Promise<{ events: USER_EVENT[]; totalItems: number }> {
    return this.service.getUserEvents(params);
  }

  async getSystemEvents(params: IGetAllEvents): Promise<{ events: SYSTEM_EVENT[]; totalItems: number }> {
    return this.service.getSystemEvents(params);
  }
}
