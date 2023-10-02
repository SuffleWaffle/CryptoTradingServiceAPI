import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { getIPAddress } from '@cupo/backend/constant';

process.env.APP_NAME = 'FEEDER';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log', 'verbose', 'debug']
        : ['log', 'error', 'verbose', 'warn'],
  });
  const globalPrefix = '';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.FEEDER_PORT || 8091;
  await app.listen(port);

  Logger.log(`🚀 ${process.env.APP_NAME} http://${getIPAddress()}:${port}/${globalPrefix}`);
}

(async function () {
  await bootstrap();
})();
