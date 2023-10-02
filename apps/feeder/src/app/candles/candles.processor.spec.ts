import { Test, TestingModule } from '@nestjs/testing';
import { CandlesProcessor } from './candles.processor';

describe('Candles.ProcessorService', () => {
  let service: CandlesProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CandlesProcessor],
    }).compile();

    service = module.get<CandlesProcessor>(CandlesProcessor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
