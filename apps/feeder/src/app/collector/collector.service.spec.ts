import { Test, TestingModule } from '@nestjs/testing';
import { CollectorService } from './collector.service';

describe('CollectorService', () => {
  let service: CollectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CollectorService],
    }).compile();

    service = module.get<CollectorService>(CollectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
