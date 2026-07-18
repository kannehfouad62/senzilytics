import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  changeAuditScheduleStatus,
  createTenantAuditSchedule,
  findGeneratedAuditByScheduleKey,
  findTenantAuditSchedule,
  findTenantAuditScheduleByName,
  getAuditScheduleFormOptions,
  getScheduleGenerationContext,
  listSchedulesReadyForGeneration,
  listTenantAuditSchedules,
  updateAuditScheduleRuntimeState,
  updateTenantAuditSchedule,
} from "@/modules/audit-v2/audit-schedule.repository";
import {
  ActivityAction,
  AuditType,
  EnterpriseAuditFrequency,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditProgramStatus,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditScheduleStatus,
  EnterpriseAuditScheduleTeamRole,
  EnterpriseAuditSectionStatus,
  EnterpriseAuditSource,
  EnterpriseAuditStatus,
  EnterpriseAuditTeamRole,
  NotificationType,
  Prisma,
} from "@prisma/client";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEZONE = "America/Chicago";

const VALID_WEEKDAYS = new Set([
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
]);

type RecurrenceRule = {
  weekdays?: string[];
  dayOfMonth?: number;
  month?: number;
  hour?: number;
  minute?: number;
  customDays?: number;
  blackoutDates?: string[];
};

export type AuditScheduleTeamMemberInput = {
  userId: string;
  role: EnterpriseAuditScheduleTeamRole;
  isRequired: boolean;
};

export type AuditScheduleInput = {
  organizationId: string;
  userId: string;

  programId: string;

  name: string;
  description?: string | null;

  status: EnterpriseAuditScheduleStatus;
  frequency: EnterpriseAuditFrequency;
  intervalValue: number;

  recurrenceRule?: Prisma.InputJsonValue | null;

  timezone?: string | null;

  startDate: Date;
  endDate?: Date | null;

  generateDaysBefore: number;
  dueDaysAfter: number;

  siteId: string;
  departmentId?: string | null;

  leadAuditorId?: string | null;
  protocolId?: string | null;

  autoGenerate: boolean;
  requireTeam: boolean;
  requireLeadAuditor: boolean;

  teamMembers: AuditScheduleTeamMemberInput[];
};

type ScheduleValidationContext = {
  program: {
    id: string;
    name: string;
    status: EnterpriseAuditProgramStatus;
    isActive: boolean;
    frequency: EnterpriseAuditFrequency;
    defaultProtocolId: string | null;
    sites: Array<{
      siteId: string;
    }>;
    departments: Array<{
      departmentId: string;
    }>;
  };

  site: {
    id: string;
    name: string;
  };

  department: {
    id: string;
    name: string;
    siteId: string;
  } | null;

  leadAuditor: {
    id: string;
    name: string;
    email: string | null;
  } | null;

  protocol: {
    id: string;
    name: string;
    version: number;
    status: EnterpriseAuditProtocolStatus;
    isActive: boolean;
  };
};

function normalizeOptionalText(value?: string | null) {
  return value?.trim() || null;
}

function normalizeTimezone(value?: string | null) {
  return value?.trim() || DEFAULT_TIMEZONE;
}

function isValidDate(value: Date) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_IN_MILLISECONDS);
}

function addWeeks(value: Date, weeks: number) {
  return addDays(value, weeks * 7);
}

function addMonths(value: Date, months: number) {
  const result = new Date(value);
  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDayOfMonth));

  return result;
}

function addYears(value: Date, years: number) {
  const result = new Date(value);
  const originalMonth = result.getMonth();
  const originalDay = result.getDate();

  result.setDate(1);
  result.setFullYear(result.getFullYear() + years);
  result.setMonth(originalMonth);

  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDayOfMonth));

  return result;
}

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);

  return result;
}

function validatePositiveInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be a positive whole number.`);
  }
}

function validateNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `${fieldName} must be zero or a positive whole number.`
    );
  }
}

function parseRecurrenceRule(
  value:
    | Prisma.JsonValue
    | Prisma.InputJsonValue
    | null
    | undefined
): RecurrenceRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;

  const weekdays = Array.isArray(raw.weekdays)
    ? raw.weekdays
        .map(String)
        .map((weekday) => weekday.trim().toUpperCase())
        .filter(Boolean)
    : undefined;

  const blackoutDates = Array.isArray(raw.blackoutDates)
    ? raw.blackoutDates
        .map(String)
        .map((date) => date.trim())
        .filter(Boolean)
    : undefined;

  return {
    weekdays,

    dayOfMonth:
      typeof raw.dayOfMonth === "number" ? raw.dayOfMonth : undefined,

    month: typeof raw.month === "number" ? raw.month : undefined,

    hour: typeof raw.hour === "number" ? raw.hour : undefined,

    minute: typeof raw.minute === "number" ? raw.minute : undefined,

    customDays:
      typeof raw.customDays === "number" ? raw.customDays : undefined,

    blackoutDates,
  };
}

function validateRecurrenceRule(input: {
  frequency: EnterpriseAuditFrequency;
  recurrenceRule?: Prisma.InputJsonValue | null;
}) {
  const rule = parseRecurrenceRule(input.recurrenceRule);

  if (
    rule.dayOfMonth !== undefined &&
    (!Number.isInteger(rule.dayOfMonth) ||
      rule.dayOfMonth < 1 ||
      rule.dayOfMonth > 31)
  ) {
    throw new Error(
      "The recurrence day of month must be between 1 and 31."
    );
  }

  if (
    rule.month !== undefined &&
    (!Number.isInteger(rule.month) ||
      rule.month < 1 ||
      rule.month > 12)
  ) {
    throw new Error("The recurrence month must be between 1 and 12.");
  }

  if (
    rule.hour !== undefined &&
    (!Number.isInteger(rule.hour) || rule.hour < 0 || rule.hour > 23)
  ) {
    throw new Error("The recurrence hour must be between 0 and 23.");
  }

  if (
    rule.minute !== undefined &&
    (!Number.isInteger(rule.minute) ||
      rule.minute < 0 ||
      rule.minute > 59)
  ) {
    throw new Error("The recurrence minute must be between 0 and 59.");
  }

  if (
    input.frequency === EnterpriseAuditFrequency.CUSTOM &&
    (!rule.customDays ||
      !Number.isInteger(rule.customDays) ||
      rule.customDays < 1)
  ) {
    throw new Error(
      "A custom schedule requires a positive customDays recurrence value."
    );
  }

  if (
    input.frequency === EnterpriseAuditFrequency.WEEKLY &&
    rule.weekdays?.length
  ) {
    const invalidWeekday = rule.weekdays.some(
      (weekday) => !VALID_WEEKDAYS.has(weekday)
    );

    if (invalidWeekday) {
      throw new Error(
        "One or more weekly recurrence weekdays are invalid."
      );
    }
  }

  if (rule.blackoutDates) {
    for (const blackoutDate of rule.blackoutDates) {
      const parsedDate = new Date(`${blackoutDate}T00:00:00`);

      if (!isValidDate(parsedDate)) {
        throw new Error(
          `The blackout date "${blackoutDate}" is not a valid date.`
        );
      }
    }
  }

  return rule;
}

function applyRuleTime(value: Date, rule: RecurrenceRule) {
  const result = new Date(value);

  if (rule.hour !== undefined) {
    result.setHours(rule.hour);
  }

  if (rule.minute !== undefined) {
    result.setMinutes(rule.minute);
  }

  result.setSeconds(0, 0);

  return result;
}

function weekdayIndex(value: string) {
  const mapping: Record<string, number> = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };

  return mapping[value];
}

function getDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isBlackoutDate(value: Date, rule: RecurrenceRule) {
  if (!rule.blackoutDates?.length) {
    return false;
  }

  return rule.blackoutDates.includes(getDateKey(value));
}

function advancePastBlackoutDates(value: Date, rule: RecurrenceRule) {
  let result = new Date(value);
  let safetyCounter = 0;

  while (isBlackoutDate(result, rule)) {
    result = addDays(result, 1);
    result = applyRuleTime(result, rule);

    safetyCounter += 1;

    if (safetyCounter > 366) {
      throw new Error(
        "The schedule cannot advance because too many blackout dates are configured."
      );
    }
  }

  return result;
}

function findNextWeeklyOccurrence(input: {
  fromDate: Date;
  intervalValue: number;
  weekdays?: string[];
  rule: RecurrenceRule;
}) {
  if (!input.weekdays?.length) {
    return applyRuleTime(
      addWeeks(input.fromDate, input.intervalValue),
      input.rule
    );
  }

  const allowedWeekdays = input.weekdays
    .map(weekdayIndex)
    .filter((value) => value !== undefined);

  let candidate = addDays(startOfDay(input.fromDate), 1);

  const maximumSearchDays = Math.max(input.intervalValue * 14, 14);

  for (let index = 0; index < maximumSearchDays; index += 1) {
    if (allowedWeekdays.includes(candidate.getDay())) {
      return applyRuleTime(candidate, input.rule);
    }

    candidate = addDays(candidate, 1);
  }

  return applyRuleTime(
    addWeeks(input.fromDate, input.intervalValue),
    input.rule
  );
}

export function calculateNextAuditScheduleRun(input: {
  frequency: EnterpriseAuditFrequency;
  intervalValue: number;

  recurrenceRule:
    | Prisma.JsonValue
    | Prisma.InputJsonValue
    | null
    | undefined;

  currentRunAt: Date;
}) {
  validatePositiveInteger(input.intervalValue, "Schedule interval");

  if (!isValidDate(input.currentRunAt)) {
    throw new Error("The current schedule occurrence date is invalid.");
  }

  const rule = parseRecurrenceRule(input.recurrenceRule);

  let nextRunAt: Date | null;

  switch (input.frequency) {
    case EnterpriseAuditFrequency.ONE_TIME:
      nextRunAt = null;
      break;

    case EnterpriseAuditFrequency.WEEKLY:
      nextRunAt = findNextWeeklyOccurrence({
        fromDate: input.currentRunAt,
        intervalValue: input.intervalValue,
        weekdays: rule.weekdays,
        rule,
      });
      break;

    case EnterpriseAuditFrequency.MONTHLY: {
      nextRunAt = addMonths(input.currentRunAt, input.intervalValue);

      if (rule.dayOfMonth) {
        const lastDayOfMonth = new Date(
          nextRunAt.getFullYear(),
          nextRunAt.getMonth() + 1,
          0
        ).getDate();

        nextRunAt.setDate(Math.min(rule.dayOfMonth, lastDayOfMonth));
      }

      nextRunAt = applyRuleTime(nextRunAt, rule);
      break;
    }

    case EnterpriseAuditFrequency.QUARTERLY:
      nextRunAt = applyRuleTime(
        addMonths(input.currentRunAt, input.intervalValue * 3),
        rule
      );
      break;

    case EnterpriseAuditFrequency.SEMIANNUAL:
      nextRunAt = applyRuleTime(
        addMonths(input.currentRunAt, input.intervalValue * 6),
        rule
      );
      break;

    case EnterpriseAuditFrequency.ANNUAL:
      nextRunAt = addYears(input.currentRunAt, input.intervalValue);

      if (rule.month) {
        nextRunAt.setMonth(rule.month - 1);
      }

      if (rule.dayOfMonth) {
        const lastDayOfMonth = new Date(
          nextRunAt.getFullYear(),
          nextRunAt.getMonth() + 1,
          0
        ).getDate();

        nextRunAt.setDate(Math.min(rule.dayOfMonth, lastDayOfMonth));
      }

      nextRunAt = applyRuleTime(nextRunAt, rule);
      break;

    case EnterpriseAuditFrequency.CUSTOM:
      nextRunAt = applyRuleTime(
        addDays(
          input.currentRunAt,
          rule.customDays ?? input.intervalValue
        ),
        rule
      );
      break;

    default:
      throw new Error(
        `Unsupported audit schedule frequency: ${input.frequency}.`
      );
  }

  return nextRunAt ? advancePastBlackoutDates(nextRunAt, rule) : null;
}

function calculateInitialGenerationAt(input: {
  startDate: Date;
  generateDaysBefore: number;
  recurrenceRule?: Prisma.InputJsonValue | null;
}) {
  const rule = parseRecurrenceRule(input.recurrenceRule);

  const generationAt = addDays(
    input.startDate,
    -input.generateDaysBefore
  );

  return advancePastBlackoutDates(generationAt, rule);
}

function buildScheduleGenerationKey(input: {
  scheduleId: string;
  scheduledAt: Date;
}) {
  return `${input.scheduleId}:${input.scheduledAt.toISOString()}`;
}

function buildAuditReference(input: {
  scheduleName: string;
  scheduledAt: Date;
  generationCount: number;
}) {
  const datePart = input.scheduledAt
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const sequencePart = String(input.generationCount + 1).padStart(
    4,
    "0"
  );

  const schedulePart =
    input.scheduleName
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "AUDIT";

  return `EA-${schedulePart}-${datePart}-${sequencePart}`;
}

function mapScheduleRoleToAuditRole(
  role: EnterpriseAuditScheduleTeamRole
): EnterpriseAuditTeamRole {
  switch (role) {
    case EnterpriseAuditScheduleTeamRole.LEAD_AUDITOR:
      return EnterpriseAuditTeamRole.LEAD_AUDITOR;

    case EnterpriseAuditScheduleTeamRole.TECHNICAL_EXPERT:
      return EnterpriseAuditTeamRole.TECHNICAL_EXPERT;

    case EnterpriseAuditScheduleTeamRole.OBSERVER:
      return EnterpriseAuditTeamRole.OBSERVER;

    case EnterpriseAuditScheduleTeamRole.TRAINEE:
      return EnterpriseAuditTeamRole.TRAINEE;

    case EnterpriseAuditScheduleTeamRole.AUDITOR:
    default:
      return EnterpriseAuditTeamRole.AUDITOR;
  }
}

function uniqueTeamMembers(members: AuditScheduleTeamMemberInput[]) {
  const membersByUserId = new Map<
    string,
    AuditScheduleTeamMemberInput
  >();

  for (const member of members) {
    const userId = member.userId.trim();

    if (!userId) {
      continue;
    }

    membersByUserId.set(userId, {
      userId,
      role: member.role,
      isRequired: member.isRequired,
    });
  }

  return Array.from(membersByUserId.values());
}

async function validateScheduleName(input: {
  organizationId: string;
  name: string;
  excludeScheduleId?: string | null;
}) {
  const duplicateSchedule = await findTenantAuditScheduleByName({
    organizationId: input.organizationId,
    name: input.name,
    excludeScheduleId: input.excludeScheduleId,
  });

  if (duplicateSchedule) {
    throw new Error(
      "An audit schedule with this name already exists in the organization."
    );
  }
}

async function validateScheduleRelationships(input: {
  organizationId: string;
  programId: string;
  siteId: string;
  departmentId?: string | null;
  leadAuditorId?: string | null;
  protocolId?: string | null;
  teamMembers: AuditScheduleTeamMemberInput[];
}): Promise<ScheduleValidationContext> {
  const [program, site, department, leadAuditor] = await Promise.all([
    prisma.auditProgram.findFirst({
      where: {
        id: input.programId,
        organizationId: input.organizationId,
      },

      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        frequency: true,
        defaultProtocolId: true,

        sites: {
          select: {
            siteId: true,
          },
        },

        departments: {
          select: {
            departmentId: true,
          },
        },
      },
    }),

    prisma.site.findFirst({
      where: {
        id: input.siteId,
        organizationId: input.organizationId,
      },

      select: {
        id: true,
        name: true,
      },
    }),

    input.departmentId
      ? prisma.department.findFirst({
          where: {
            id: input.departmentId,

            site: {
              organizationId: input.organizationId,
            },
          },

          select: {
            id: true,
            name: true,
            siteId: true,
          },
        })
      : Promise.resolve(null),

    input.leadAuditorId
      ? prisma.user.findFirst({
          where: {
            id: input.leadAuditorId,
            organizationId: input.organizationId,
          },

          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!program) {
    throw new Error(
      "The selected audit program is invalid or belongs to another organization."
    );
  }

  if (
    !program.isActive ||
    program.status === EnterpriseAuditProgramStatus.ARCHIVED ||
    program.status === EnterpriseAuditProgramStatus.INACTIVE
  ) {
    throw new Error("The selected audit program is not active.");
  }

  if (!site) {
    throw new Error(
      "The selected audit site is invalid or belongs to another organization."
    );
  }

  if (input.departmentId && !department) {
    throw new Error(
      "The selected department is invalid or belongs to another organization."
    );
  }

  if (department && department.siteId !== site.id) {
    throw new Error(
      "The selected department does not belong to the selected site."
    );
  }

  if (input.leadAuditorId && !leadAuditor) {
    throw new Error(
      "The selected lead auditor does not belong to this organization."
    );
  }

  const programSiteIds = new Set(
    program.sites.map((programSite) => programSite.siteId)
  );

  if (programSiteIds.size > 0 && !programSiteIds.has(site.id)) {
    throw new Error(
      "The selected site is outside the scope of this audit program."
    );
  }

  if (department && program.departments.length > 0) {
    const programDepartmentIds = new Set(
      program.departments.map(
        (programDepartment) => programDepartment.departmentId
      )
    );

    if (!programDepartmentIds.has(department.id)) {
      throw new Error(
        "The selected department is outside the scope of this audit program."
      );
    }
  }

  const resolvedProtocolId =
    input.protocolId || program.defaultProtocolId;

  if (!resolvedProtocolId) {
    throw new Error(
      "Select an active audit protocol or assign a default protocol to the audit program."
    );
  }

  const protocol = await prisma.auditProtocol.findFirst({
    where: {
      id: resolvedProtocolId,
      organizationId: input.organizationId,
      isActive: true,
      status: EnterpriseAuditProtocolStatus.ACTIVE,
    },

    select: {
      id: true,
      name: true,
      version: true,
      status: true,
      isActive: true,

      sections: {
        where: {
          isActive: true,
        },

        select: {
          id: true,

          questions: {
            where: {
              isActive: true,
            },

            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!protocol) {
    throw new Error(
      "The selected audit protocol is unavailable, inactive, or belongs to another organization."
    );
  }

  const activeQuestionCount = protocol.sections.reduce(
    (total, section) => total + section.questions.length,
    0
  );

  if (protocol.sections.length === 0 || activeQuestionCount === 0) {
    throw new Error(
      "The selected protocol does not contain an executable checklist."
    );
  }

  const teamMembers = uniqueTeamMembers(input.teamMembers);

  if (teamMembers.length > 0) {
    const validUserCount = await prisma.user.count({
      where: {
        organizationId: input.organizationId,

        id: {
          in: teamMembers.map((member) => member.userId),
        },
      },
    });

    if (validUserCount !== teamMembers.length) {
      throw new Error(
        "One or more audit team members are invalid or belong to another organization."
      );
    }
  }

  return {
    program,
    site,
    department,
    leadAuditor,

    protocol: {
      id: protocol.id,
      name: protocol.name,
      version: protocol.version,
      status: protocol.status,
      isActive: protocol.isActive,
    },
  };
}

async function validateAuditScheduleInput(
  input: AuditScheduleInput & {
    excludeScheduleId?: string | null;
  }
) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Schedule name is required.");
  }

  if (name.length > 200) {
    throw new Error("Schedule name cannot exceed 200 characters.");
  }

  if (!isValidDate(input.startDate)) {
    throw new Error("The schedule start date is invalid.");
  }

  if (input.endDate && !isValidDate(input.endDate)) {
    throw new Error("The schedule end date is invalid.");
  }

  if (input.endDate && input.endDate < input.startDate) {
    throw new Error(
      "The schedule end date cannot be earlier than the start date."
    );
  }

  validatePositiveInteger(input.intervalValue, "Schedule interval");

  validateNonNegativeInteger(
    input.generateDaysBefore,
    "Generate-days-before value"
  );

  validatePositiveInteger(input.dueDaysAfter, "Due-days-after value");

  if (input.generateDaysBefore > 365) {
    throw new Error(
      "An audit cannot be generated more than 365 days before its scheduled date."
    );
  }

  if (input.dueDaysAfter > 730) {
    throw new Error(
      "The audit due-date offset cannot exceed 730 days."
    );
  }

  validateRecurrenceRule({
    frequency: input.frequency,
    recurrenceRule: input.recurrenceRule,
  });

  await validateScheduleName({
    organizationId: input.organizationId,
    name,
    excludeScheduleId: input.excludeScheduleId,
  });

  const teamMembers = uniqueTeamMembers(input.teamMembers);

  const relationships = await validateScheduleRelationships({
    organizationId: input.organizationId,
    programId: input.programId,
    siteId: input.siteId,
    departmentId: input.departmentId,
    leadAuditorId: input.leadAuditorId,
    protocolId: input.protocolId,
    teamMembers,
  });

  if (input.requireLeadAuditor && !relationships.leadAuditor) {
    throw new Error("This schedule requires a lead auditor.");
  }

  if (input.requireTeam && teamMembers.length === 0) {
    throw new Error(
      "This schedule requires at least one audit team member."
    );
  }

  const leadAuditorTeamMember = input.leadAuditorId
    ? teamMembers.find(
        (member) => member.userId === input.leadAuditorId
      )
    : null;

  if (
    leadAuditorTeamMember &&
    leadAuditorTeamMember.role !==
      EnterpriseAuditScheduleTeamRole.LEAD_AUDITOR
  ) {
    throw new Error(
      "When the lead auditor is included in the schedule team, their role must be Lead Auditor."
    );
  }

  if (
    input.status === EnterpriseAuditScheduleStatus.ACTIVE &&
    input.endDate &&
    input.endDate < new Date()
  ) {
    throw new Error("An expired schedule cannot be activated.");
  }

  const resolvedProtocolId =
    input.protocolId || relationships.program.defaultProtocolId;

  if (!resolvedProtocolId) {
    throw new Error("The audit schedule requires an active protocol.");
  }

  return {
    name,
    timezone: normalizeTimezone(input.timezone),
    teamMembers,
    relationships,
    resolvedProtocolId,
  };
}

export async function listAuditSchedulesService(input: {
  organizationId: string;
  search?: string | null;
  status?: EnterpriseAuditScheduleStatus | null;
  frequency?: EnterpriseAuditFrequency | null;
  siteId?: string | null;
  programId?: string | null;
  autoGenerate?: boolean | null;
}) {
  return listTenantAuditSchedules(input);
}

export async function getAuditScheduleService(input: {
  organizationId: string;
  scheduleId: string;
}) {
  const schedule = await findTenantAuditSchedule(input);

  if (!schedule) {
    throw new Error("Audit schedule not found in this organization.");
  }

  return schedule;
}

export async function getAuditScheduleFormOptionsService(
  organizationId: string
) {
  return getAuditScheduleFormOptions(organizationId);
}

export async function createAuditScheduleService(
  input: AuditScheduleInput
) {
  const validated = await validateAuditScheduleInput(input);

  const nextRunAt =
    input.status === EnterpriseAuditScheduleStatus.ACTIVE &&
    input.autoGenerate
      ? calculateInitialGenerationAt({
          startDate: input.startDate,
          generateDaysBefore: input.generateDaysBefore,
          recurrenceRule: input.recurrenceRule,
        })
      : null;

  const schedule = await createTenantAuditSchedule({
    organizationId: input.organizationId,
    programId: input.programId,

    name: validated.name,
    description: normalizeOptionalText(input.description),

    status: input.status,
    frequency: input.frequency,
    intervalValue: input.intervalValue,

    recurrenceRule: input.recurrenceRule ?? null,

    timezone: validated.timezone,

    startDate: input.startDate,
    endDate: input.endDate ?? null,

    nextRunAt,
    lastRunAt: null,

    generateDaysBefore: input.generateDaysBefore,
    dueDaysAfter: input.dueDaysAfter,

    siteId: input.siteId,
    departmentId: input.departmentId ?? null,

    leadAuditorId: input.leadAuditorId ?? null,
    protocolId: validated.resolvedProtocolId,

    autoGenerate: input.autoGenerate,
    requireTeam: input.requireTeam,
    requireLeadAuditor: input.requireLeadAuditor,

    createdById: input.userId,
    updatedById: input.userId,

    teamMembers: validated.teamMembers,
  });

  if (!schedule) {
    throw new Error("The audit schedule could not be created.");
  }

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditSchedule",
    entityId: schedule.id,
    title: "Audit schedule created",
    description: `${schedule.name} was created for ${schedule.site.name}.`,

    metadata: {
      scheduleId: schedule.id,
      programId: schedule.program.id,
      siteId: schedule.site.id,
      departmentId: schedule.department?.id ?? null,
      protocolId: schedule.protocol?.id ?? null,
      frequency: schedule.frequency,
      intervalValue: schedule.intervalValue,
      startDate: schedule.startDate.toISOString(),
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      autoGenerate: schedule.autoGenerate,
      teamMemberCount: schedule.teamMembers.length,
      createdAt: new Date().toISOString(),
    },
  });

  return schedule;
}

export async function updateAuditScheduleService(
  input: AuditScheduleInput & {
    scheduleId: string;
  }
) {
  const existingSchedule = await findTenantAuditSchedule({
    organizationId: input.organizationId,
    scheduleId: input.scheduleId,
  });

  if (!existingSchedule) {
    throw new Error("Audit schedule not found in this organization.");
  }

  const validated = await validateAuditScheduleInput({
    ...input,
    excludeScheduleId: input.scheduleId,
  });

  const recurrenceChanged =
    existingSchedule.frequency !== input.frequency ||
    existingSchedule.intervalValue !== input.intervalValue ||
    existingSchedule.startDate.getTime() !==
      input.startDate.getTime() ||
    existingSchedule.generateDaysBefore !==
      input.generateDaysBefore ||
    JSON.stringify(existingSchedule.recurrenceRule) !==
      JSON.stringify(input.recurrenceRule ?? null);

  let nextRunAt = existingSchedule.nextRunAt;

  if (
    input.status !== EnterpriseAuditScheduleStatus.ACTIVE ||
    !input.autoGenerate
  ) {
    nextRunAt = null;
  } else if (recurrenceChanged || !nextRunAt) {
    nextRunAt = calculateInitialGenerationAt({
      startDate: input.startDate,
      generateDaysBefore: input.generateDaysBefore,
      recurrenceRule: input.recurrenceRule,
    });
  }

  const schedule = await updateTenantAuditSchedule({
    organizationId: input.organizationId,
    scheduleId: input.scheduleId,
    programId: input.programId,

    name: validated.name,
    description: normalizeOptionalText(input.description),

    status: input.status,
    frequency: input.frequency,
    intervalValue: input.intervalValue,

    recurrenceRule: input.recurrenceRule ?? null,

    timezone: validated.timezone,

    startDate: input.startDate,
    endDate: input.endDate ?? null,

    nextRunAt,

    generateDaysBefore: input.generateDaysBefore,
    dueDaysAfter: input.dueDaysAfter,

    siteId: input.siteId,
    departmentId: input.departmentId ?? null,

    leadAuditorId: input.leadAuditorId ?? null,
    protocolId: validated.resolvedProtocolId,

    autoGenerate: input.autoGenerate,
    requireTeam: input.requireTeam,
    requireLeadAuditor: input.requireLeadAuditor,

    updatedById: input.userId,

    teamMembers: validated.teamMembers,
  });

  if (!schedule) {
    throw new Error("The audit schedule could not be updated.");
  }

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditSchedule",
    entityId: schedule.id,
    title: "Audit schedule updated",
    description: `${schedule.name} was updated.`,

    metadata: {
      scheduleId: schedule.id,
      previousStatus: existingSchedule.status,
      currentStatus: schedule.status,
      previousFrequency: existingSchedule.frequency,
      currentFrequency: schedule.frequency,
      previousIntervalValue: existingSchedule.intervalValue,
      currentIntervalValue: schedule.intervalValue,
      previousNextRunAt:
        existingSchedule.nextRunAt?.toISOString() ?? null,
      currentNextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      updatedAt: new Date().toISOString(),
    },
  });

  return schedule;
}

export async function changeAuditScheduleStatusService(input: {
  organizationId: string;
  userId: string;
  scheduleId: string;
  status: EnterpriseAuditScheduleStatus;
}) {
  const existingSchedule = await findTenantAuditSchedule({
    organizationId: input.organizationId,
    scheduleId: input.scheduleId,
  });

  if (!existingSchedule) {
    throw new Error("Audit schedule not found in this organization.");
  }

  if (existingSchedule.status === input.status) {
    throw new Error(
      `This audit schedule is already ${input.status
        .replaceAll("_", " ")
        .toLowerCase()}.`
    );
  }

  if (input.status === EnterpriseAuditScheduleStatus.ACTIVE) {
    if (
      existingSchedule.endDate &&
      existingSchedule.endDate < new Date()
    ) {
      throw new Error("An expired audit schedule cannot be activated.");
    }

    await validateScheduleRelationships({
      organizationId: input.organizationId,
      programId: existingSchedule.programId,
      siteId: existingSchedule.siteId,
      departmentId: existingSchedule.departmentId,
      leadAuditorId: existingSchedule.leadAuditorId,
      protocolId: existingSchedule.protocolId,

      teamMembers: existingSchedule.teamMembers.map((member) => ({
        userId: member.user.id,
        role: member.role,
        isRequired: member.isRequired,
      })),
    });
  }

  const updatedSchedule = await changeAuditScheduleStatus({
    organizationId: input.organizationId,
    scheduleId: input.scheduleId,
    status: input.status,
    updatedById: input.userId,
  });

  if (!updatedSchedule) {
    throw new Error(
      "The audit schedule status could not be updated."
    );
  }

  if (
    input.status === EnterpriseAuditScheduleStatus.ACTIVE &&
    updatedSchedule.autoGenerate
  ) {
    const nextRunAt = calculateInitialGenerationAt({
      startDate: updatedSchedule.startDate,
      generateDaysBefore: updatedSchedule.generateDaysBefore,
      recurrenceRule: updatedSchedule.recurrenceRule,
    });

    await updateAuditScheduleRuntimeState({
      organizationId: input.organizationId,
      scheduleId: updatedSchedule.id,
      nextRunAt,
    });
  }

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditSchedule",
    entityId: updatedSchedule.id,
    title: "Audit schedule status changed",
    description: `${updatedSchedule.name} changed from ${existingSchedule.status} to ${input.status}.`,

    metadata: {
      scheduleId: updatedSchedule.id,
      previousStatus: existingSchedule.status,
      currentStatus: input.status,
      changedAt: new Date().toISOString(),
    },
  });

  return findTenantAuditSchedule({
    organizationId: input.organizationId,
    scheduleId: updatedSchedule.id,
  });
}

async function notifyGeneratedAudit(input: {
  organizationId: string;
  auditId: string;
  auditReference: string;
  auditTitle: string;
  leadAuditorId?: string | null;

  teamMembers: Array<{
    userId: string;
  }>;
}) {
  const recipientIds = new Set<string>();

  if (input.leadAuditorId) {
    recipientIds.add(input.leadAuditorId);
  }

  for (const member of input.teamMembers) {
    recipientIds.add(member.userId);
  }

  await Promise.all(
    Array.from(recipientIds).map((userId) =>
      createNotification({
        organizationId: input.organizationId,
        userId,
        type: NotificationType.ASSIGNMENT,
        title: "Enterprise audit assigned",
        message: `You have been assigned to ${input.auditReference}: ${input.auditTitle}.`,
        link: `/audit-management/audit/${input.auditId}`,
      })
    )
  );
}

export async function generateAuditFromScheduleService(input: {
    organizationId: string;
    scheduleId: string;
    generatedByUserId?: string | null;
    generationDate?: Date;
  }) {
    const context = await getScheduleGenerationContext({
      organizationId: input.organizationId,
      scheduleId: input.scheduleId,
    });
  
    if (!context) {
      throw new Error("Audit schedule not found in this organization.");
    }
  
    if (
      context.requireLeadAuditor &&
      !context.leadAuditorId
    ) {
      throw new Error(
        "This audit schedule requires a lead auditor before an audit can be generated."
      );
    }
  
    if (context.requireTeam && context.teamMembers.length === 0) {
      throw new Error(
        "This audit schedule requires an audit team before an audit can be generated."
      );
    }
  
    const protocol = context.protocol;
  
    if (
      !protocol ||
      protocol.status !== EnterpriseAuditProtocolStatus.ACTIVE ||
      !protocol.isActive
    ) {
      throw new Error(
        "The schedule does not have an active executable audit protocol."
      );
    }
  
    if (protocol.sections.length === 0) {
      throw new Error(
        "The selected protocol does not contain any active sections."
      );
    }

    const scheduledAt = context.nextRunAt
    ? addDays(context.nextRunAt, context.generateDaysBefore)
    : input.generationDate ?? context.startDate;

  if (context.endDate && scheduledAt > context.endDate) {
    await changeAuditScheduleStatus({
      organizationId: context.organizationId,
      scheduleId: context.id,
      status: EnterpriseAuditScheduleStatus.COMPLETED,
      updatedById: input.generatedByUserId ?? null,
    });

    throw new Error(
      "The schedule has reached its configured end date."
    );
  }

  const generationKey = buildScheduleGenerationKey({
    scheduleId: context.id,
    scheduledAt,
  });

  const existingAudit = await findGeneratedAuditByScheduleKey({
    scheduleId: context.id,
    generationKey,
  });

  if (existingAudit) {
    return {
      audit: existingAudit,
      generated: false,
      duplicate: true,
      generationKey,
    };
  }

  const auditReference = buildAuditReference({
    scheduleName: context.name,
    scheduledAt,
    generationCount: context.generationCount,
  });

  const dueDate = addDays(scheduledAt, context.dueDaysAfter);

  const transactionResult = await prisma.$transaction(
    async (transaction) => {
      const audit = await transaction.enterpriseAudit.create({
        data: {
          organizationId: context.organizationId,

          reference: auditReference,

          title: `${context.program.name} — ${context.site.name}`,

          description:
            context.description || context.program.description,

          objectives: context.program.objectives,
          scope: context.program.scope,

          criteria:
            [
              context.program.framework,
              context.program.standardName,
              context.program.standardVersion,
            ]
              .filter(Boolean)
              .join(" · ") || null,


              source: EnterpriseAuditSource.SCHEDULE,
              status: EnterpriseAuditStatus.SCHEDULED,
              auditType: AuditType.INTERNAL,
    
              programId: context.program.id,
              scheduleId: context.id,
              protocolId: protocol.id,
    
              siteId: context.siteId,
              departmentId: context.departmentId,
    
              leadAuditorId: context.leadAuditorId,
              ownerId: context.leadAuditorId,
    
              scheduledAt,
              dueDate,
    
              generatedByScheduleKey: generationKey,
    
              createdById: input.generatedByUserId ?? null,
              updatedById: input.generatedByUserId ?? null,
            },
          });

          const teamMemberMap = new Map<
          string,
          {
            userId: string;
            role: EnterpriseAuditTeamRole;
            isRequired: boolean;
          }
        >();
  
        for (const teamMember of context.teamMembers) {
          teamMemberMap.set(teamMember.userId, {
            userId: teamMember.userId,
            role: mapScheduleRoleToAuditRole(teamMember.role),
            isRequired: teamMember.isRequired,
          });
        }
  
        if (context.leadAuditorId) {
          teamMemberMap.set(context.leadAuditorId, {
            userId: context.leadAuditorId,
            role: EnterpriseAuditTeamRole.LEAD_AUDITOR,
            isRequired: true,
          });
        }

        const teamMembers = Array.from(teamMemberMap.values());

        if (teamMembers.length > 0) {
          await transaction.enterpriseAuditTeamMember.createMany({
            data: teamMembers.map((teamMember) => ({
              auditId: audit.id,
              userId: teamMember.userId,
              role: teamMember.role,
              isRequired: teamMember.isRequired,
  
              canEdit:
                teamMember.role !== EnterpriseAuditTeamRole.OBSERVER,
  
              canReview:
                teamMember.role === EnterpriseAuditTeamRole.LEAD_AUDITOR ||
                teamMember.role ===
                  EnterpriseAuditTeamRole.TECHNICAL_EXPERT,
            })),
          });
        }

        let totalQuestionCount = 0;
        let maximumPossibleScore = new Prisma.Decimal(0);
  
        for (const sourceSection of protocol.sections) {
          const section = await transaction.enterpriseAuditSection.create(
            {
              data: {
                auditId: audit.id,
  
                sourceProtocolSectionId: sourceSection.id,
  
                title: sourceSection.title,
                description: sourceSection.description,
                guidance: sourceSection.guidance,
                standardRef: sourceSection.standardRef,
  
                sequence: sourceSection.sequence,
                weight: sourceSection.weight,
  
                status: EnterpriseAuditSectionStatus.NOT_STARTED,
  
                isRequired: sourceSection.isRequired,
                isActive: true,
  
                totalQuestionCount: sourceSection.questions.length,
              },
            }
          );

          let sectionMaximumScore = new Prisma.Decimal(0);

          for (const sourceQuestion of sourceSection.questions) {
            const questionMaximumScore =
              sourceQuestion.maximumScore ??
              new Prisma.Decimal(sourceQuestion.weight);
  
            const question =
              await transaction.enterpriseAuditQuestion.create({
                data: {
                  auditId: audit.id,
                  sectionId: section.id,
  
                  sourceProtocolQuestionId: sourceQuestion.id,
  
                  questionText: sourceQuestion.questionText,
                  description: sourceQuestion.description,
                  guidance: sourceQuestion.guidance,
  
                  standardClause: sourceQuestion.standardClause,
                  regulatoryRef: sourceQuestion.regulatoryRef,
  
                  responseType: sourceQuestion.responseType,
  
                  sequence: sourceQuestion.sequence,
                  weight: sourceQuestion.weight,
  
                  isRequired: sourceQuestion.isRequired,
                  isActive: true,

                  allowNotApplicable: sourceQuestion.allowNotApplicable,

                  requireComment: sourceQuestion.requireComment,
                  requireEvidence: sourceQuestion.requireEvidence,
                  requirePhoto: sourceQuestion.requirePhoto,
  
                  minimumNumericValue:
                    sourceQuestion.minimumNumericValue,
  
                  maximumNumericValue:
                    sourceQuestion.maximumNumericValue,
  
                  minimumPassingScore:
                    sourceQuestion.minimumPassingScore,
  
                  maximumScore: questionMaximumScore,
  
                  findingTrigger: sourceQuestion.findingTrigger,
                  defaultSeverity: sourceQuestion.defaultSeverity,
  
                  automaticallyCreateFinding:
                    sourceQuestion.automaticallyCreateFinding,
  
                  automaticallySuggestCapa:
                    sourceQuestion.automaticallySuggestCapa,
  
                  automaticallySuggestRisk:
                    sourceQuestion.automaticallySuggestRisk,
  
                  findingTitleTemplate:
                    sourceQuestion.findingTitleTemplate,
  
                  findingDescriptionTemplate:
                    sourceQuestion.findingDescriptionTemplate,
  
                  aiGuidance: sourceQuestion.aiGuidance,
                },
              });

              if (sourceQuestion.options.length > 0) {
                await transaction.enterpriseAuditQuestionOptionSnapshot.createMany(
                  {
                    data: sourceQuestion.options.map((option) => ({
                      questionId: question.id,
                      sourceOptionId: option.id,
    
                      label: option.label,
                      value: option.value,
                      description: option.description,
    
                      sequence: option.sequence,
                      scoreValue: option.scoreValue,
    
                      isPassing: option.isPassing,
                      triggersFinding: option.triggersFinding,
                      findingSeverity: option.findingSeverity,
                    })),
                  }
                );
              }
    
              totalQuestionCount += 1;
    
              sectionMaximumScore = sectionMaximumScore.add(
                questionMaximumScore
              );
    
              maximumPossibleScore = maximumPossibleScore.add(
                questionMaximumScore
              );
            }

            await transaction.enterpriseAuditSection.update({
                where: {
                  id: section.id,
                },
      
                data: {
                  maximumPossibleScore: sectionMaximumScore,
                },
              });
            }
      
            await transaction.enterpriseAudit.update({
              where: {
                id: audit.id,
              },
      
              data: {
                totalQuestionCount,
                maximumPossibleScore,
              },
            });

            await transaction.enterpriseAuditHistory.create({
                data: {
                  organizationId: context.organizationId,
                  auditId: audit.id,
                  userId: input.generatedByUserId ?? null,
        
                  action: EnterpriseAuditHistoryAction.CREATED,
        
                  entityType: "EnterpriseAudit",
                  entityId: audit.id,
        
                  title: "Enterprise audit generated",
        
                  description: `${audit.reference} was generated automatically from ${context.name}.`,
        
                  metadata: {
                    scheduleId: context.id,
                    programId: context.program.id,
                    protocolId: protocol.id,
                    generationKey,
                    scheduledAt: scheduledAt.toISOString(),
                    dueDate: dueDate.toISOString(),
                    totalQuestionCount,
                    teamMemberCount: teamMembers.length,
                  },
                },
              });
        
              return {
                audit,
                teamMembers,
              };
            }
          );

  /*
   * Important:
   * Use the schedule's saved intervalValue.
   * Do not hard-code this value to 1.
   */
  const nextScheduledAt = calculateNextAuditScheduleRun({
    frequency: context.frequency,
    intervalValue: context.intervalValue,
    recurrenceRule: context.recurrenceRule,
    currentRunAt: scheduledAt,
  });

  const nextGenerationAt = nextScheduledAt
    ? addDays(nextScheduledAt, -context.generateDaysBefore)
    : null;

  const hasReachedEndDate =
    nextScheduledAt &&
    context.endDate &&
    nextScheduledAt > context.endDate;

  const nextScheduleStatus =
    !nextScheduledAt || hasReachedEndDate
      ? EnterpriseAuditScheduleStatus.COMPLETED
      : EnterpriseAuditScheduleStatus.ACTIVE;

  await prisma.auditSchedule.update({
    where: {
      id: context.id,
    },

    data: {
      status: nextScheduleStatus,

      lastRunAt: new Date(),

      nextRunAt: hasReachedEndDate ? null : nextGenerationAt,

      lastGenerationKey: generationKey,

      generationCount: {
        increment: 1,
      },
    },
  });

  try {
    await notifyGeneratedAudit({
      organizationId: context.organizationId,

      auditId: transactionResult.audit.id,
      auditReference: transactionResult.audit.reference,
      auditTitle: transactionResult.audit.title,

      leadAuditorId: context.leadAuditorId,

      teamMembers: context.teamMembers,
    });
  } catch (error) {
    console.error(
      `Enterprise audit assignment notification failed for audit ${transactionResult.audit.id}:`,
      error
    );
  }

  await logActivity({
    organizationId: context.organizationId,
    userId: input.generatedByUserId ?? null,

    action: ActivityAction.SYSTEM,

    entityType: "EnterpriseAudit",
    entityId: transactionResult.audit.id,

    title: "Enterprise audit generated from schedule",

    description: `${transactionResult.audit.reference} was generated from ${context.name}.`,

    metadata: {
      auditId: transactionResult.audit.id,
      auditReference: transactionResult.audit.reference,

      scheduleId: context.id,
      programId: context.program.id,
      protocolId: protocol.id,

      generationKey,

      scheduledAt: scheduledAt.toISOString(),
      dueDate: dueDate.toISOString(),

      nextScheduleRunAt:
        hasReachedEndDate || !nextGenerationAt
          ? null
          : nextGenerationAt.toISOString(),

      generatedAt: new Date().toISOString(),
    },
  });

  return {
    audit: transactionResult.audit,
    generated: true,
    duplicate: false,
    generationKey,
  };
}

export async function processAuditScheduleGenerationService() {
  const processingStartedAt = new Date();

  const schedules = await listSchedulesReadyForGeneration(
    processingStartedAt
  );

  let generated = 0;
  let duplicates = 0;
  let failed = 0;
  let completedSchedules = 0;

  const results: Array<{
    scheduleId: string;
    scheduleName: string;

    status: "GENERATED" | "DUPLICATE" | "FAILED";

    auditId?: string;
    auditReference?: string;

    error?: string;
  }> = [];

  for (const schedule of schedules) {
    try {
      const result = await generateAuditFromScheduleService({
        organizationId: schedule.organizationId,
        scheduleId: schedule.id,
        generatedByUserId: null,
        generationDate: processingStartedAt,
      });

      if (result.duplicate) {
        duplicates += 1;

        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: "DUPLICATE",
          auditId: result.audit.id,
          auditReference: result.audit.reference,
        });
      } else {
        generated += 1;

        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: "GENERATED",
          auditId: result.audit.id,
          auditReference: result.audit.reference,
        });
      }

      if (
        schedule.frequency === EnterpriseAuditFrequency.ONE_TIME
      ) {
        completedSchedules += 1;
      }
    } catch (error) {
      failed += 1;

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Automatic audit generation failed.";

      console.error(
        `Audit generation failed for schedule ${schedule.id}:`,
        error
      );

      results.push({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        status: "FAILED",
        error: errorMessage,
      });
    }
  }

  return {
    checked: schedules.length,
    generated,
    duplicates,
    failed,
    completedSchedules,

    processedAt: new Date().toISOString(),
    processingStartedAt: processingStartedAt.toISOString(),

    results,
  };
}