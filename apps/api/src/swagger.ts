import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import * as PATH from 'path';
import * as appData from '../../../package.json';

export function swaggerInit(app: INestApplication, serverAddress: string) {
  const config = new DocumentBuilder()
    .setTitle(appData.name)
    .setVersion(appData.version)
    .addServer(serverAddress, 'API server')
    .addBearerAuth()
    .addTag('auth')
    .addTag('trader')
    .addTag('notification')
    .addTag('payment')
    .addTag('payout')
    .addTag('marketing')
    .addTag('app')
    .addTag('crm')
    .build();

  const options: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey, methodKey) => methodKey,
  };

  const document = SwaggerModule.createDocument(app, config, options);

  if (process.env.SWAGGER_GENERATOR === 'true') {
    try {
      const tempDir = PATH.join('tools', 'temp');
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, {
          recursive: true,
        });
      }

      const filePath = PATH.join(tempDir, 'swagger.json');
      writeFileSync(filePath, JSON.stringify(document));
      console.log('swagger.json generated');
    } catch (e) {
      console.log(e);
    }

    process.exit(1);
  }

  SwaggerModule.setup('v1/doc', app, document);

  Logger.log(`Swagger address ${serverAddress}v1/doc`);
}
