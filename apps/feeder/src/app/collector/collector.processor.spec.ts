import { Test, TestingModule } from '@nestjs/testing';
import { CollectorProcessor } from './collector.processor';

describe('Collector.ProcessorService', () => {
  let service: CollectorProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CollectorProcessor],
    }).compile();

    service = module.get<CollectorProcessor>(CollectorProcessor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
