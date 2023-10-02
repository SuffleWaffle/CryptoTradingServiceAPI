import { Test, TestingModule } from '@nestjs/testing';
import { CcxtService } from './ccxt.service';

describe('CcxtService', () => {
  let service: CcxtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CcxtService],
    }).compile();

    service = module.get<CcxtService>(CcxtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
