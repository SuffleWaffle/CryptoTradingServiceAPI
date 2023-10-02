import { Test, TestingModule } from '@nestjs/testing';
import { PayoutController } from './payout.controller';

describe('PayoutController', () => {
  let controller: PayoutController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayoutController],
    }).compile();

    controller = module.get<PayoutController>(PayoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
