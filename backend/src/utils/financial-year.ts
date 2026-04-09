export function getFinancialYearForDate(date: Date) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getFinancialQuarterForDate(date: Date) {
  const month = date.getMonth();

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
