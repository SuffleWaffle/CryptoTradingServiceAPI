import { Test, TestingModule } from '@nestjs/testing';
import { PayoutService } from './payout.service';

describe('PayoutService', () => {
  let service: PayoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayoutService],
    }).compile();

    service = module.get<PayoutService>(PayoutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
