import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeProcessor } from './exchange.processor';

describe('ExchangeProcessorService', () => {
  let service: ExchangeProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExchangeProcessor],
    }).compile();

    service = module.get<ExchangeProcessor>(ExchangeProcessor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
