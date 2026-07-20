import { ComplianceRecurrence } from "@prisma/client";

export function nextComplianceDueDate(value: Date, recurrence: ComplianceRecurrence, interval: number) {
  if (recurrence === ComplianceRecurrence.ONE_TIME) return null;
  const result = new Date(value);
  const safeInterval = Math.max(1, interval);
  if (recurrence === ComplianceRecurrence.DAILY || recurrence === ComplianceRecurrence.CUSTOM) {
    result.setDate(result.getDate() + safeInterval);
    return result;
  }
  if (recurrence === ComplianceRecurrence.WEEKLY) {
    result.setDate(result.getDate() + 7 * safeInterval);
    return result;
  }
  const monthInterval: Partial<Record<ComplianceRecurrence, number>> = {
    [ComplianceRecurrence.MONTHLY]: 1,
    [ComplianceRecurrence.QUARTERLY]: 3,
    [ComplianceRecurrence.SEMIANNUAL]: 6,
    [ComplianceRecurrence.ANNUAL]: 12,
  };
  const months = monthInterval[recurrence];
  if (!months) throw new Error("Unsupported compliance recurrence.");
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months * safeInterval);
  const last = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, last));
  return result;
}
