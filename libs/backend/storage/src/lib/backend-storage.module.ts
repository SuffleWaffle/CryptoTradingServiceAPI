import { Global, Module } from '@nestjs/common';

import { MongodbModule } from './mongodb/mongodb.module';
import { RedisModule } from './redis/redis.module';

@Global()
@Module({
  imports: [MongodbModule, RedisModule],
  controllers: [],
  providers: [],
  exports: [MongodbModule, RedisModule],
})
export class BackendStorageModule {}
