import { HttpException, HttpStatus, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { getIPAddress, REST_API_RESPONSE_STATUS } from "@cupo/backend/constant";
import { HTTP_RESPONSE } from "@cupo/backend/interface/src/lib/rest-api.interface";
import { EventService } from "@cupo/event";
import { EVENT_TYPE } from "@cupo/backend/interface";
import axios from "axios";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const querystring = require('node:querystring');

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const axios = require('axios');

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private readonly event: EventService) {}

  async onApplicationBootstrap() {
    await this.event.addSystemEvent({
      type: EVENT_TYPE.APP_STARTED,
      event: `${process.env.APP_NAME} started`,
      data: {
        serverIP: getIPAddress(),
      },
    });
  }

  getData(): HTTP_RESPONSE<void> {
    return {
      statusCode: HttpStatus.OK,
      message: `TRADING API HEALTH OK: ${process.uptime()}`,
    };
  }

  //get data from rest api by axios
  getHealthInfoFromFeeder(): Promise<HTTP_RESPONSE<string>> {
    return axios
      .get('https://api.cupocoin.com/feeder/')
      .then((res) => {
        Logger.log(`FEEDER HEALTH OK ${res.data}`);

        return {
          statusCode: HttpStatus.OK,
          data: res.data,
          message: 'FEEDER HEALTH OK',
        };
      })
      .catch((err) => {
        Logger.error(`ERROR getHealthInfoFromFeeder: ${err.message}`);

        throw new HttpException(
          {
            statusCode: HttpStatus.GONE,
            message: 'HEALTH FAIL',
            error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
          } as HTTP_RESPONSE<void>,
          HttpStatus.GONE
        );
      });
  }

  getHealthInfoFromTrader(version: string): Promise<HTTP_RESPONSE<string>> {
    return axios
      .get('https://api.cupocoin.com/trader/')
      .then((res) => {
        Logger.log(`TRADER HEALTH OK ${res.data}`);

        return {
          statusCode: HttpStatus.OK,
          data: res.data,
          message: `TRADER HEALTH <${version}> OK`,
        };
      })
      .catch((err) => {
        Logger.error(`ERROR getHealthInfoFromTrader: ${err.message}`);

        throw new HttpException(
          {
            statusCode: HttpStatus.GONE,
            message: `HEALTH <${version}> FAIL`,
            error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
          } as HTTP_RESPONSE<void>,
          HttpStatus.GONE
        );
      });
  }

  getHealthInfoFromTicker(): Promise<HTTP_RESPONSE<string>> {
    return axios
      .get('https://api.cupocoin.com/ticker/')
      .then((res) => {
        Logger.log(`TICKER HEALTH OK ${res.data}`);

        return {
          data: res.data,
          message: 'TICKER HEALTH OK',
          statusCode: HttpStatus.OK,
        } as HTTP_RESPONSE<string>;
      })
      .catch((err) => {
        Logger.error(`ERROR getHealthInfoFromTicker: ${err.message}`);

        throw new HttpException(
          {
            statusCode: HttpStatus.GONE,
            message: 'HEALTH FAIL',
            error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
          } as HTTP_RESPONSE<void>,
          HttpStatus.GONE
        );
      });
  }

  getHealthInfoFromExchange(): Promise<HTTP_RESPONSE<string>> {
    return axios
      .get('https://api.cupocoin.com/userexchange/')
      .then((res) => {
        Logger.log(`EXCHANGE HEALTH OK ${res.data}`);

        return {
          data: res.data,
          message: 'EXCHANGE HEALTH OK',
          statusCode: HttpStatus.OK,
        } as HTTP_RESPONSE<string>;
      })
      .catch((err) => {
        Logger.error(`ERROR ${err.message}`, 'getHealthInfoFromExchange');

        throw new HttpException(
          {
            statusCode: HttpStatus.GONE,
            message: 'EXCHANGE HEALTH FAIL',
            error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
          } as HTTP_RESPONSE<void>,
          HttpStatus.GONE
        );
      });
  }

  haltTickerApp(): Promise<HTTP_RESPONSE<string>> {
    return axios
      .post('https://api.cupocoin.com/ticker/haltAndCatchFire')
      .then((res) => {
        Logger.log(`TICKER HALTED: ${JSON.stringify(res.data || {})}`);

        return {
          data: res.data,
          message: 'TICKER HALTED',
          statusCode: HttpStatus.OK,
        } as HTTP_RESPONSE<string>;
      })
      .catch((err) => {
        Logger.error(`ERROR: ${err.message}`, 'haltTickerApp');

        throw new HttpException(
          {
            statusCode: HttpStatus.GONE,
            message: 'HEALTH FAIL',
            error: REST_API_RESPONSE_STATUS.INTERNAL_ERROR,
          } as HTTP_RESPONSE<void>,
          HttpStatus.GONE
        );
      });
  }

  async validateRecaptcha(token): Promise<boolean> {
    const secret = process.env.GOOGLE_RECAPTCHA_SECRET || '';

    const postData = querystring.stringify({
      secret: secret,
      response: token,
    });

    // const response = await axios.get(`https://www.google.com/recaptcha/api/siteverify?${postData}`);
    const response = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
      },
    });
    // const response = await axios.post(
    //   `https://www.google.com/recaptcha/api/siteverify`,
    //   {
    //     secret: secret,
    //     response: token,
    //   },
    //   {
    //     headers: {
    //       'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8;',
    //     },
    //   }
    // );

    if (!response.data?.success) {
      console.log('Recaptcha failed', response.data, postData);
      Logger.error(`Recaptcha error: ${response.status}, ${JSON.stringify(response.data ?? {})}`, 'validateRecaptcha');
    }

    return response.data?.success;
  }
}
