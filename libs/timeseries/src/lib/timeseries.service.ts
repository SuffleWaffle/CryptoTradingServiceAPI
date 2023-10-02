'use strict';

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TimeSeriesService {
  constructor() {
    const now = new Date();
    const minutes = now.getUTCMinutes();
    const hours = now.getUTCHours();
    const days = now.getUTCDate();
    const months = now.getUTCMonth();
    const years = now.getUTCFullYear();

    Logger.log(
      `Timezone offset ${new Date().getTimezoneOffset() / 60} Local hour: ${new Date().getHours()} UTC: ${years}-${months}-${days} ${hours}:${minutes}`
    );

    // const now = new Date('2020-03-03T13:27:57.000Z');
    // console.log('Date.now()', new Date());
    // console.log('1 minute: ', this.tsTime('1m'));
    // console.log('5 minutes: ', this.tsTime('5m'));
    // console.log('15 minutes: ', this.tsTime('15m'));
    // console.log('30 minutes: ', this.tsTime('30m'));
    // console.log('1 hour: ', this.tsTime('1h'));
    // console.log('2 hours: ', this.tsTime('2h'));
    // console.log('4 hours: ', this.tsTime('4h'));
    // console.log('8 hours: ', this.tsTime('8h'));
    // console.log('12 hours: ', this.tsTime('12h'));
    // console.log('1 day: ', this.tsTime('1d'));
    // console.log('3 days: ', this.tsTime('3d'));
    // console.log('1 week: ', this.tsTime('1w'));
    // console.log('1 month: ', this.tsTime('1M'));

    // const now = new Date('2020-03-03T13:27:57.000Z');
    // console.log('Date: ', now);
    // console.log('1 minute: ', this.tsTime('1m', now));
    // console.log('5 minutes: ', this.tsTime('5m', now));
    // console.log('15 minutes: ', this.tsTime('15m', now));
    // console.log('30 minutes: ', this.tsTime('30m', now));
    // console.log('1 hour: ', this.tsTime('1h', now));
    // console.log('2 hours: ', this.tsTime('2h', now));
    // console.log('4 hours: ', this.tsTime('4h', now));
    // console.log('8 hours: ', this.tsTime('8h', now));
    // console.log('12 hours: ', this.tsTime('12h', now));
    // console.log('1 day: ', this.tsTime('1d', now));
    // console.log('3 days: ', this.tsTime('3d', now));
    // console.log('1 week: ', this.tsTime('1w', now));
    // console.log('1 month: ', this.tsTime('1M', now));
  }
}
