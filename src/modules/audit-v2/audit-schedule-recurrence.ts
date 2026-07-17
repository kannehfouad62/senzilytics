import {
    EnterpriseAuditFrequency,
  } from "@prisma/client";
  
  type RecurrenceRule = {
    weekdays?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
  };
  
  const DAY_IN_MILLISECONDS =
    24 * 60 * 60 * 1000;
  
  function startOfDay(
    value: Date
  ) {
    const result = new Date(value);
  
    result.setHours(0, 0, 0, 0);
  
    return result;
  }
  
  function addDays(
    value: Date,
    days: number
  ) {
    return new Date(
      value.getTime() +
        days *
          DAY_IN_MILLISECONDS
    );
  }
  
  function addMonths(
    value: Date,
    months: number
  ) {
    const result =
      new Date(value);
  
    const originalDay =
      result.getDate();
  
    result.setDate(1);
  
    result.setMonth(
      result.getMonth() +
        months
    );
  
    const lastDay =
      new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0
      ).getDate();
  
    result.setDate(
      Math.min(
        originalDay,
        lastDay
      )
    );
  
    return result;
  }
  
  function addYears(
    value: Date,
    years: number
  ) {
    const result =
      new Date(value);
  
    result.setFullYear(
      result.getFullYear() +
        years
    );
  
    return result;
  }
  
  function normalizeInterval(
    value: number
  ) {
    if (
      !Number.isInteger(value) ||
      value < 1
    ) {
      return 1;
    }
  
    return value;
  }
  
  function parseRecurrenceRule(
    value: unknown
  ): RecurrenceRule {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }
  
    const record =
      value as Record<
        string,
        unknown
      >;
  
    const weekdays =
      Array.isArray(
        record.weekdays
      )
        ? record.weekdays
            .map(Number)
            .filter(
              (day) =>
                Number.isInteger(
                  day
                ) &&
                day >= 0 &&
                day <= 6
            )
        : undefined;
  
    const dayOfMonth =
      Number(
        record.dayOfMonth
      );
  
    const monthOfYear =
      Number(
        record.monthOfYear
      );
  
    return {
      weekdays:
        weekdays &&
        weekdays.length > 0
          ? [
              ...new Set(
                weekdays
              ),
            ]
          : undefined,
  
      dayOfMonth:
        Number.isInteger(
          dayOfMonth
        ) &&
        dayOfMonth >= 1 &&
        dayOfMonth <= 31
          ? dayOfMonth
          : undefined,
  
      monthOfYear:
        Number.isInteger(
          monthOfYear
        ) &&
        monthOfYear >= 1 &&
        monthOfYear <= 12
          ? monthOfYear
          : undefined,
    };
  }
  
  function setDayOfMonth(
    value: Date,
    dayOfMonth: number
  ) {
    const result =
      new Date(value);
  
    const finalDay =
      Math.min(
        dayOfMonth,
        new Date(
          result.getFullYear(),
          result.getMonth() + 1,
          0
        ).getDate()
      );
  
    result.setDate(finalDay);
  
    return result;
  }
  
  function getNextWeeklyDate(
    input: {
      currentDate: Date;
      intervalValue: number;
      weekdays?: number[];
    }
  ) {
    const weekdays =
      input.weekdays?.length
        ? input.weekdays
        : [
            input.currentDate.getDay(),
          ];
  
    for (
      let offset = 1;
      offset <=
      7 *
        input.intervalValue;
      offset += 1
    ) {
      const candidate =
        addDays(
          input.currentDate,
          offset
        );
  
      if (
        weekdays.includes(
          candidate.getDay()
        )
      ) {
        return candidate;
      }
    }
  
    return addDays(
      input.currentDate,
      7 *
        input.intervalValue
    );
  }
  
  export function calculateNextAuditScheduleRun(
    input: {
      frequency: EnterpriseAuditFrequency;
      intervalValue: number;
      currentRunAt: Date;
      recurrenceRule?: unknown;
      endDate?: Date | null;
    }
  ) {
    const intervalValue =
      normalizeInterval(
        input.intervalValue
      );
  
    const currentRunAt =
      startOfDay(
        input.currentRunAt
      );
  
    const rule =
      parseRecurrenceRule(
        input.recurrenceRule
      );
  
    let nextRunAt:
      | Date
      | null = null;
  
    switch (input.frequency) {
      case EnterpriseAuditFrequency.ONE_TIME:
        nextRunAt = null;
        break;
  
      case EnterpriseAuditFrequency.WEEKLY:
        nextRunAt =
          getNextWeeklyDate({
            currentDate:
              currentRunAt,
  
            intervalValue,
  
            weekdays:
              rule.weekdays,
          });
        break;
  
      case EnterpriseAuditFrequency.MONTHLY: {
        const candidate =
          addMonths(
            currentRunAt,
            intervalValue
          );
  
        nextRunAt =
          setDayOfMonth(
            candidate,
            rule.dayOfMonth ??
              currentRunAt.getDate()
          );
  
        break;
      }
  
      case EnterpriseAuditFrequency.QUARTERLY: {
        const candidate =
          addMonths(
            currentRunAt,
            3 *
              intervalValue
          );
  
        nextRunAt =
          setDayOfMonth(
            candidate,
            rule.dayOfMonth ??
              currentRunAt.getDate()
          );
  
        break;
      }
  
      case EnterpriseAuditFrequency.SEMIANNUAL: {
        const candidate =
          addMonths(
            currentRunAt,
            6 *
              intervalValue
          );
  
        nextRunAt =
          setDayOfMonth(
            candidate,
            rule.dayOfMonth ??
              currentRunAt.getDate()
          );
  
        break;
      }
  
      case EnterpriseAuditFrequency.ANNUAL: {
        let candidate =
          addYears(
            currentRunAt,
            intervalValue
          );
  
        if (
          rule.monthOfYear
        ) {
          candidate.setMonth(
            rule.monthOfYear -
              1
          );
        }
  
        candidate =
          setDayOfMonth(
            candidate,
            rule.dayOfMonth ??
              currentRunAt.getDate()
          );
  
        nextRunAt =
          candidate;
  
        break;
      }
  
      case EnterpriseAuditFrequency.CUSTOM:
        nextRunAt =
          addDays(
            currentRunAt,
            intervalValue
          );
        break;
  
      default:
        nextRunAt = null;
    }
  
    if (
      nextRunAt &&
      input.endDate &&
      nextRunAt >
        input.endDate
    ) {
      return null;
    }
  
    return nextRunAt;
  }
  
  export function createAuditScheduleGenerationKey(
    input: {
      scheduleId: string;
      runAt: Date;
    }
  ) {
    const runDate =
      startOfDay(
        input.runAt
      )
        .toISOString()
        .slice(0, 10);
  
    return `${input.scheduleId}:${runDate}`;
  }
  
  export function calculateGeneratedAuditDueDate(
    input: {
      scheduledAt: Date;
      dueDaysAfter: number;
    }
  ) {
    const dueDaysAfter =
      Math.max(
        0,
        Math.min(
          Number.isInteger(
            input.dueDaysAfter
          )
            ? input.dueDaysAfter
            : 14,
          3650
        )
      );
  
    return addDays(
      input.scheduledAt,
      dueDaysAfter
    );
  }