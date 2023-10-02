import { Test, TestingModule } from '@nestjs/testing';
import { EventApiService } from './event-api.service';

describe('EventService', () => {
  let service: EventApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventApiService],
    }).compile();

    service = module.get<EventApiService>(EventApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
