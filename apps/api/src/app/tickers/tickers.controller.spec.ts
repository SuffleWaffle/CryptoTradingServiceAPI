import { Test, TestingModule } from '@nestjs/testing';
import { TickersController } from './tickers.controller';

describe('TickersController', () => {
  let controller: TickersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TickersController],
    }).compile();

    controller = module.get<TickersController>(TickersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
