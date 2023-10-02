import { Global, Module } from '@nestjs/common';
import { PlatformMongodbService } from './platform.mongodb.service';
import { AccountMongodbService } from './account.mongodb.service';
import { OrdersMongodbService } from './orders.mongodb.service';
import { EventsMongodbService } from './events.mongodb.service';
import { UserMongodbService } from './user.mongodb.service';
import { MongodbService } from './mongodb.service';

@Global()
@Module({
  providers: [
    MongodbService,
    OrdersMongodbService,
    AccountMongodbService,
    EventsMongodbService,
    UserMongodbService,
    PlatformMongodbService,
  ],
  exports: [
    OrdersMongodbService,
    AccountMongodbService,
    EventsMongodbService,
    UserMongodbService,
    PlatformMongodbService,
  ],
})
export class MongodbModule {}
