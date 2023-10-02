import { Test, TestingModule } from '@nestjs/testing';
import { NotifyController } from './notify.controller';

describe('NotifyController', () => {
  let controller: NotifyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotifyController],
    }).compile();

    controller = module.get<NotifyController>(NotifyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
