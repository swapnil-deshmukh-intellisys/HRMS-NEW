import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
export { formatInTimeZone, toZonedTime };

export const TIMEZONE = 'Asia/Kolkata';

export function formatDate(value?: string | null) {
  return value
    ? formatInTimeZone(new Date(value), TIMEZONE, 'd MMM yyyy')
    : "-";
}

export function formatDateLabel(value?: string | null) {
  return value
    ? formatInTimeZone(new Date(value), TIMEZONE, 'd MMM yyyy')
    : "-";
}

export function isToday(value?: string | null) {
  if (!value) {
    return false;
  }

  const date = toZonedTime(new Date(value), TIMEZONE);
  const today = toZonedTime(new Date(), TIMEZONE);

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function formatWeekday(value?: string | null) {
  return value
    ? formatInTimeZone(new Date(value), TIMEZONE, 'EEEE')
    : "-";
}

export function formatDateTime(value?: string | null) {
  return value
    ? formatInTimeZone(new Date(value), TIMEZONE, 'd MMM yyyy, h:mm a')
    : "-";
}

export function formatTime(value?: string | null) {
  return value
    ? formatInTimeZone(new Date(value), TIMEZONE, 'h:mm a')
    : "-";
}

export function formatAttendanceTime(value?: string | null) {
  return value
    ? formatInTimeZone(new Date(value), TIMEZONE, 'h:mm a')
    : "-";
}

export function formatMetricKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

export function formatLeaveDays(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${normalized} day${value === 1 ? "" : "s"}`;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function addMinutesToTime(timeStr: string, minutes: number): string {
  if (!timeStr) return "09:00";
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
