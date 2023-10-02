import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateRecaptcha {
  @Expose()
  @ApiProperty({
    description: 'Google recaptcha token',
    type: String,
  })
  token: string;
}
