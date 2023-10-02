import { Test } from '@nestjs/testing';

import { AppService } from './app.service';
import { HttpStatus } from '@nestjs/common';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getData', () => {
    it('should return "Welcome to api!"', () => {
      expect(service.getData().status).toEqual(HttpStatus.OK);
    });
  });
});
