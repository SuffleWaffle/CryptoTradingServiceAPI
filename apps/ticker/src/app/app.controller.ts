import { Body, Controller, Get, Post, Response } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Post('addExchange')
  async addExchange(@Body() body: { exchangeId: string }): Promise<void> {
    await this.appService.addExchange(body.exchangeId);
  }
  @Post('removeExchange')
  async removeExchange(@Body() body: { exchangeId: string }): Promise<void> {
    await this.appService.removeExchange(body.exchangeId);
  }

  @Post('haltAndCatchFire')
  async haltApplication(@Response() res): Promise<void> {
    await res.send({ message: `TICKER HALT OK` });
    this.appService.haltApplication();
  }
}
