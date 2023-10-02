import { Test, TestingModule } from '@nestjs/testing';
import { TimeseriesService } from './timeseries.service';

describe('TimeseriesService', () => {
  let service: TimeseriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimeseriesService],
    }).compile();

    service = module.get<TimeseriesService>(TimeseriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
