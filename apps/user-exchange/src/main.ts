import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getIPAddress } from '@cupo/backend/constant';
import { AppModule } from './app/app.module';

process.env.APP_NAME = 'EXCHANGE';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log', 'verbose', 'debug']
        : ['log', 'debug', 'error', 'verbose', 'warn'],
  });
  const globalPrefix = '';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.EXCHANGE_PORT || 8097;
  await app.listen(port);

  Logger.log(`🚀 ${process.env.APP_NAME} http://${getIPAddress()}:${port}/${globalPrefix}`);
}

(async function () {
  await bootstrap();
})();
