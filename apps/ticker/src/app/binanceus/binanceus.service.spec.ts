import { Test, TestingModule } from '@nestjs/testing';
import { BinanceusService } from './binanceus.service';

describe('BinanceusService', () => {
  let service: BinanceusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BinanceusService],
    }).compile();

    service = module.get<BinanceusService>(BinanceusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
