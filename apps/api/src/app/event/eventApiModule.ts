import { Module } from '@nestjs/common';
import { EventModule } from '@cupo/event';
import { EventApiService } from './event-api.service';
import { EventController } from './event.controller';

@Module({
  imports: [EventModule],
  controllers: [EventController],
  providers: [EventApiService],
})
export class EventApiModule {}
