import { formatInTimeZone, toDate, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { startOfDay as fnsStartOfDay, endOfDay as fnsEndOfDay } from 'date-fns';

export const TIMEZONE = 'Asia/Kolkata';

export function startOfDay(value: Date | string | number) {
  const zonedDate = toZonedTime(new Date(value), TIMEZONE);
  const start = fnsStartOfDay(zonedDate);
  return fromZonedTime(start, TIMEZONE);
}

export function endOfDay(value: Date | string | number) {
  const zonedDate = toZonedTime(new Date(value), TIMEZONE);
  const end = fnsEndOfDay(zonedDate);
  return fromZonedTime(end, TIMEZONE);
}

export function getCurrentTimeInIST() {
  return toZonedTime(new Date(), TIMEZONE);
}

export function calculateLeaveDays(startDate: Date, endDate: Date) {
  const diffInMs = endOfDay(endDate).getTime() - startOfDay(startDate).getTime();
  return Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
}
