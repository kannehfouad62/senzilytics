import { prisma } from "@/lib/prisma";
import { ScheduledJobRunStatus, type Prisma } from "@prisma/client";

export const scheduledJobDefinitions = [
  {
    key: "workflow-sla",
    label: "Workflow & notification SLA",
    cadence: "Hourly",
    staleAfterMinutes: 150,
  },
  {
    key: "audit-schedules",
    label: "Audit schedule generation",
    cadence: "Hourly",
    staleAfterMinutes: 150,
  },
  {
    key: "training-compliance",
    label: "Training compliance",
    cadence: "Daily at 06:00 UTC",
    staleAfterMinutes: 2_160,
  },
  {
    key: "compliance-monitor",
    label: "Compliance monitoring",
    cadence: "Daily at 06:30 UTC",
    staleAfterMinutes: 2_160,
  },
  {
    key: "chemical-monitor",
    label: "Chemical monitoring",
    cadence: "Daily at 07:00 UTC",
    staleAfterMinutes: 2_160,
  },
  {
    key: "environmental-monitor",
    label: "Environmental monitoring",
    cadence: "Daily at 07:30 UTC",
    staleAfterMinutes: 2_160,
  },
] as const;

export type ScheduledJobKey = (typeof scheduledJobDefinitions)[number]["key"];
export type ScheduledJobHealthStatus =
  | "HEALTHY"
  | "RUNNING"
  | "FAILED"
  | "STALE"
  | "NEVER_RUN";

export function classifyScheduledJobHealth(
  latest: { status: ScheduledJobRunStatus; startedAt: Date } | null,
  staleAfterMinutes: number,
  now = new Date(),
): ScheduledJobHealthStatus {
  if (!latest) return "NEVER_RUN";
  const ageMs = now.getTime() - latest.startedAt.getTime();
  if (ageMs > staleAfterMinutes * 60_000) return "STALE";
  if (latest.status === ScheduledJobRunStatus.FAILED) return "FAILED";
  if (latest.status === ScheduledJobRunStatus.RUNNING) return "RUNNING";
  return "HEALTHY";
}

export async function runTrackedScheduledJob<T>(
  jobKey: ScheduledJobKey,
  operation: () => Promise<T>,
  summarize: (result: T) => unknown = () => ({ recorded: true }),
) {
  const startedAt = new Date();
  const run = await prisma.scheduledJobRun.create({
    data: { jobKey, status: ScheduledJobRunStatus.RUNNING, startedAt },
    select: { id: true },
  });
  try {
    const result = await operation();
    const completedAt = new Date();
    await prisma.scheduledJobRun.update({
      where: { id: run.id },
      data: {
        status: ScheduledJobRunStatus.SUCCEEDED,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        summary: jsonValue(summarize(result)),
      },
    });
    return result;
  } catch (cause) {
    const completedAt = new Date();
    await prisma.scheduledJobRun
      .update({
        where: { id: run.id },
        data: {
          status: ScheduledJobRunStatus.FAILED,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          errorMessage: "Scheduled processing failed. Review protected runtime logs.",
        },
      })
      .catch(() => undefined);
    throw cause;
  }
}

export async function getScheduledJobHealth(now = new Date()) {
  const runs = await prisma.scheduledJobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 250,
  });
  return scheduledJobDefinitions.map((definition) => {
    const jobRuns = runs.filter((run) => run.jobKey === definition.key);
    const latest = jobRuns[0] ?? null;
    const lastSuccess =
      jobRuns.find((run) => run.status === ScheduledJobRunStatus.SUCCEEDED) ?? null;
    return {
      ...definition,
      status: classifyScheduledJobHealth(
        latest,
        definition.staleAfterMinutes,
        now,
      ),
      latest,
      lastSuccess,
    };
  });
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) return {};
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { recorded: true };
  }
}
