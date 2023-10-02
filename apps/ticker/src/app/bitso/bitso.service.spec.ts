import { Test, TestingModule } from '@nestjs/testing';
import { BitsoService } from './bitso.service';

describe('BitsoService', () => {
  let service: BitsoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitsoService],
    }).compile();

    service = module.get<BitsoService>(BitsoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
