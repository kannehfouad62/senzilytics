import assert from "node:assert/strict";
import test from "node:test";
import { ScheduledJobRunStatus } from "@prisma/client";
import {
  classifyScheduledJobHealth,
  scheduledJobDefinitions,
} from "../src/modules/platform/scheduled-job-monitor.service";

const now = new Date("2026-07-24T12:00:00.000Z");

test("the production job catalog covers every Vercel scheduler", () => {
  assert.deepEqual(
    scheduledJobDefinitions.map((job) => job.key),
    [
      "workflow-sla",
      "audit-schedules",
      "training-compliance",
      "compliance-monitor",
      "chemical-monitor",
      "environmental-monitor",
    ],
  );
});

test("job health distinguishes never-run, successful, failed, and stale runs", () => {
  assert.equal(classifyScheduledJobHealth(null, 60, now), "NEVER_RUN");
  assert.equal(
    classifyScheduledJobHealth(
      {
        status: ScheduledJobRunStatus.SUCCEEDED,
        startedAt: new Date("2026-07-24T11:30:00.000Z"),
      },
      60,
      now,
    ),
    "HEALTHY",
  );
  assert.equal(
    classifyScheduledJobHealth(
      {
        status: ScheduledJobRunStatus.FAILED,
        startedAt: new Date("2026-07-24T11:30:00.000Z"),
      },
      60,
      now,
    ),
    "FAILED",
  );
  assert.equal(
    classifyScheduledJobHealth(
      {
        status: ScheduledJobRunStatus.SUCCEEDED,
        startedAt: new Date("2026-07-24T09:00:00.000Z"),
      },
      60,
      now,
    ),
    "STALE",
  );
});
