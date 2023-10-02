export const MILLIS_IN_DAY = 86400000;
export const SEC_IN_DAY = 86400;

export function getLastMonthsDate(count: number = 12, date?: Date): Date {
  const now = new Date(date || Date.now());
  return new Date(now.setMonth(now.getMonth() - count));
}

export function getLastDaysDate(count: number = 30, date?: Date): Date {
  const now = new Date(date || Date.now());
  return new Date(now.setDate(now.getDate() - count));
}

export function getLastDays(count: number = 30, date?: Date): Date[] {
  const now = new Date(date || Date.now());
  const last = getLastDaysDate(count, date);

  const res = [];

  res.push(now);

  const currentDay = new Date(now);
  while (currentDay > last) {
    res.push(new Date(currentDay.setDate(currentDay.getDate() - 1)));
  }

  return res;
}

export function getLastMonths(count: number = 12, date?: Date): Date[] {
  const now = new Date(date || Date.now());
  const last = getLastMonthsDate(count, date);

  const res = [];

  res.push(now);

  while (now > last) {
    res.push(new Date(now.setMonth(now.getMonth() - 1)));
  }

  return res;
}
