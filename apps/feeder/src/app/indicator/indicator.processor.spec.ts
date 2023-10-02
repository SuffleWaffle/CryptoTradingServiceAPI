import { Test, TestingModule } from '@nestjs/testing';
import { IndicatorProcessor } from './indicator.processor';

describe('IndicatorProcessorService', () => {
  let service: IndicatorProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndicatorProcessor],
    }).compile();

    service = module.get<IndicatorProcessor>(IndicatorProcessor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
