import { Processor } from '@nestjs/bull';
import { CommonProcessor } from '@cupo/backend/common';
import { QUEUE_TYPE } from '@cupo/backend/interface';
import { ExchangeService } from './exchange.service';

@Processor(QUEUE_TYPE.EXCHANGE)
export class ExchangeProcessor extends CommonProcessor {
  constructor(private readonly service: ExchangeService) {
    super(QUEUE_TYPE.EXCHANGE);
  }

  async updateExchangesList(): Promise<void> {
    await this.service.setExchangesList();
  }
}
