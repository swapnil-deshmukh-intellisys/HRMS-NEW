export function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function calculateLeaveDays(startDate: Date, endDate: Date) {
  const diffInMs = endOfDay(endDate).getTime() - startOfDay(startDate).getTime();
  return Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
}
