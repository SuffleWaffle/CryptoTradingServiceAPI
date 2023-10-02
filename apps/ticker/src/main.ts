import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getIPAddress } from '@cupo/backend/constant';
import { AppModule } from './app/app.module';

process.env.APP_NAME = 'TICKER';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'debug', 'warn', 'log', 'verbose']
        : ['error', 'verbose', 'debug', 'warn', 'log'],
    // logger: process.env.NODE_ENV === 'production' ? ['error', 'warn', 'log', 'verbose'] : ['log', 'error', 'verbose', 'warn'],
  });
  const globalPrefix = '';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.TICKER_PORT || 8092;
  await app.listen(port);

  Logger.log(`🚀 ${process.env.APP_NAME} http://${getIPAddress()}:${port}/${globalPrefix}`);
}

(async function () {
  await bootstrap();
})();
