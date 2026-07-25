export const complianceCalendarWeekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function buildComplianceMonthGrid(monthStart: Date) {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const numberOfDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingCells = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const occupiedCells = leadingCells + numberOfDays;
  const trailingCells = (7 - (occupiedCells % 7)) % 7;

  return [
    ...Array.from({ length: leadingCells }, () => null),
    ...Array.from({ length: numberOfDays }, (_, index) => index + 1),
    ...Array.from({ length: trailingCells }, () => null),
  ];
}

export function complianceCalendarWeekdayForDay(
  monthStart: Date,
  day: number,
) {
  const weekday = new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth(),
      day,
    ),
  ).getUTCDay();
  return complianceCalendarWeekdays[weekday];
}
