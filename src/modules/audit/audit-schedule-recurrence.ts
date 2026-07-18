import { EnterpriseAuditFrequency } from "@prisma/client";

function addMonthsClamped(value: Date, months: number) {
  const result = new Date(value);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function advanceAuditScheduleDate(
  value: Date,
  frequency: EnterpriseAuditFrequency,
  intervalValue: number
) {
  const result = new Date(value);
  switch (frequency) {
    case EnterpriseAuditFrequency.ONE_TIME:
      return null;
    case EnterpriseAuditFrequency.WEEKLY:
      result.setDate(result.getDate() + 7 * intervalValue);
      return result;
    case EnterpriseAuditFrequency.MONTHLY:
      return addMonthsClamped(result, intervalValue);
    case EnterpriseAuditFrequency.QUARTERLY:
      return addMonthsClamped(result, 3 * intervalValue);
    case EnterpriseAuditFrequency.SEMIANNUAL:
      return addMonthsClamped(result, 6 * intervalValue);
    case EnterpriseAuditFrequency.ANNUAL:
      return addMonthsClamped(result, 12 * intervalValue);
    case EnterpriseAuditFrequency.CUSTOM:
      result.setDate(result.getDate() + intervalValue);
      return result;
  }
}

export function calculateInitialNextRunAt(input: {
  startDate: Date;
  endDate?: Date | null;
  frequency: EnterpriseAuditFrequency;
  intervalValue: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  let candidate = new Date(input.startDate);

  if (input.frequency === EnterpriseAuditFrequency.ONE_TIME) {
    return candidate >= now && (!input.endDate || candidate <= input.endDate)
      ? candidate
      : null;
  }

  let guard = 0;
  while (candidate < now && guard < 1000) {
    const next = advanceAuditScheduleDate(candidate, input.frequency, input.intervalValue);
    if (!next) return null;
    candidate = next;
    guard += 1;
  }

  if (guard >= 1000 || (input.endDate && candidate > input.endDate)) return null;
  return candidate;
}
