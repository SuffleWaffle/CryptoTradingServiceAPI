import { Test, TestingModule } from '@nestjs/testing';
import { MarketingController } from './marketing.controller';

describe('MarketingController', () => {
  let controller: MarketingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketingController],
    }).compile();

    controller = module.get<MarketingController>(MarketingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
