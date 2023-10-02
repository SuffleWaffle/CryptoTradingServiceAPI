import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { getIPAddress } from '@cupo/backend/constant';
import { swaggerInit } from './swagger';
import { AppModule } from './app/app.module';

process.env.APP_NAME = 'API';

// cors: {
//   credentials: true,
//     origin: '*',
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
//     preflightContinue: false,
//     optionsSuccessStatus: 204,
// },

const whitelist = ['http://localhost:19000', 'http://localhost:19002', 'https://api.cupocoin.com'];
const corsOptionsDelegate = function (origin, callback) {
  const originIsWhitelisted = whitelist.indexOf(origin) !== -1;

  // callback(originIsWhitelisted ? null : 'Bad request origin', originIsWhitelisted);
  callback(null, true);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      credentials: true,
      origin: corsOptionsDelegate,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      preflightContinue: false,
      optionsSuccessStatus: 204,
    },
    bodyParser: true,
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log', 'verbose']
        : ['log', 'debug', 'error', 'verbose', 'warn'],
  });

  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'x-api-version',
  });

  app.use(helmet());

  const globalPrefix = '';
  app.setGlobalPrefix(globalPrefix);

  // region CORS
  // TODO rewrite cors middleware
  // app.use((req: IncomingMessage, res: ServerResponse, next) => {
  //   res.setHeader('Access-Control-Allow-Origin', '*');
  //
  //   if (req.method.toLowerCase() === 'options') {
  //     res.writeHead(204, {
  //       'Access-Control-Allow-Headers': req.headers['access-control-request-headers'],
  //       'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'].join(','),
  //       'Access-Control-Expose-Headers': '*',
  //       Vary: 'Access-Control-Request-Headers',
  //       'Content-Length': 0,
  //     });
  //     return res.end();
  //   }
  //
  //   next();
  // });

  // const serverAddress = getIPAddress();
  const port = process.env.RESTAPI_PORT || 8090;
  const prodEnvs = ['stage', 'production', 'development'];
  // register swagger
  const serverAddress =
    process.env.NODE_ENV === 'development'
      ? `http://localhost:${port}/${globalPrefix}`
      : `https://api.cupocoin.com/${globalPrefix}`;

  if (!process.env.NODE_ENV || !prodEnvs.includes(process.env.NODE_ENV.toLowerCase())) {
    swaggerInit(app, serverAddress);
  }
  swaggerInit(app, serverAddress);

  await app.listen(port);

  Logger.log(`🚀 ${process.env.APP_NAME} http://${getIPAddress()}:${port}/${globalPrefix}`);
}

(async function () {
  await bootstrap();
})();
