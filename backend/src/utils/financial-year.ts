import { toZonedTime } from 'date-fns-tz';
import { TIMEZONE } from './dates.js';

export function getFinancialYearForDate(date: Date) {
  const istDate = toZonedTime(date, TIMEZONE);
  return istDate.getMonth() >= 3 ? istDate.getFullYear() : istDate.getFullYear() - 1;
}

export function getFinancialQuarterForDate(date: Date) {
  const istDate = toZonedTime(date, TIMEZONE);
  const month = istDate.getMonth();

  if (month >= 3 && month <= 5) {
    return 1;
  }

  if (month >= 6 && month <= 8) {
    return 2;
  }

  if (month >= 9 && month <= 11) {
    return 3;
  }

  return 4;
}

export function getFinancialYearBounds(year: number) {
  return {
    start: new Date(Date.UTC(year, 3, 1)),
    endExclusive: new Date(Date.UTC(year + 1, 3, 1)),
  };
}
