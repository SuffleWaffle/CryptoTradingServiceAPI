import { Module } from '@nestjs/common';
import { PostgresService } from './postgres.service';

@Module({
  imports: [
    // TypeOrmModule.forRoot(configService.getPostgreTypeOrmConfig())
  ],
  providers: [PostgresService],
  exports: [PostgresService],
})
export class PostgresModule {}
