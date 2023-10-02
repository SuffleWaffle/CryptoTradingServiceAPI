import { Controller, Get, HttpException, HttpStatus, Param } from '@nestjs/common';
import { LogService } from './log.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LogRecordType } from '@cupo/backend/interface';
import { REST_API_RESPONSE_STATUS } from '@cupo/backend/constant';
import { HTTP_RESPONSE } from '@cupo/backend/interface/src/lib/rest-api.interface';

@ApiTags('crm', 'log')
@Controller('log')
export class LogController {
  constructor(private readonly service: LogService) {}

  @Get('')
  @ApiOperation({
    description: 'Get log records',
  })
  async getAllLog(): Promise<HTTP_RESPONSE<LogRecordType[]>> {
    const log = await this.service.getLog();
    return {
      statusCode: HttpStatus.OK,
      length: log?.length,
      data: log,
    };
  }

  @Get(':timestamp')
  @ApiOperation({
    description: 'Get the log record',
    parameters: [{ name: 'exchangeId', in: 'path', schema: { type: 'number' } }],
  })
  async getLogRecord(@Param('timestamp') timestamp: number): Promise<HTTP_RESPONSE<LogRecordType | null>> {
    const rec = await this.service.getLogRecord(+timestamp);

    if (rec) {
      return {
        statusCode: HttpStatus.OK,
        data: rec,
      };
    } else {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: `Log record [${timestamp}] not found`,
          error: REST_API_RESPONSE_STATUS.ENTITY_NOT_FOUND,
        } as HTTP_RESPONSE<void>,
        HttpStatus.NOT_FOUND
      );
    }
  }
}
