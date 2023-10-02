import { Test, TestingModule } from '@nestjs/testing';
import { TickersService } from './tickers.service';

describe('TickersService', () => {
  let service: TickersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TickersService],
    }).compile();

    service = module.get<TickersService>(TickersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
