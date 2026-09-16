import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseEmployeePerformanceWindow,
  summarizeEmployeeWork,
  type EmployeeWorkRecord,
} from "../src/modules/employee-performance/employee-performance.service";

const now = new Date("2026-09-16T12:00:00.000Z");

function record(overrides: Partial<EmployeeWorkRecord> = {}): EmployeeWorkRecord {
  return {
    id: "task-1",
    userId: "user-1",
    source: "WORKFLOW_TASK",
    title: "Review evidence",
    href: "/tasks",
    status: "OPEN",
    assignedAt: new Date("2026-09-01T12:00:00.000Z"),
    dueAt: new Date("2026-09-10T12:00:00.000Z"),
    completedAt: null,
    completed: false,
    cancelled: false,
    ...overrides,
  };
}

test("employee performance uses governed transparent denominators", () => {
  const summary = summarizeEmployeeWork([
    record({ id: "on-time", status: "COMPLETED", completed: true, completedAt: new Date("2026-09-09T12:00:00.000Z") }),
    record({ id: "late", status: "COMPLETED", completed: true, completedAt: new Date("2026-09-12T12:00:00.000Z") }),
    record({ id: "overdue" }),
    record({ id: "cancelled", status: "CANCELLED", cancelled: true }),
  ], now);

  assert.equal(summary.assigned, 3);
  assert.equal(summary.completed, 2);
  assert.equal(summary.open, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.completedWithDueDate, 2);
  assert.equal(summary.completedOnTime, 1);
  assert.equal(summary.onTimeRate, 50);
  assert.equal(summary.completionRate, 66.7);
});

test("employee performance windows are bounded", () => {
  assert.equal(parseEmployeePerformanceWindow("30"), 30);
  assert.equal(parseEmployeePerformanceWindow("365"), 365);
  assert.equal(parseEmployeePerformanceWindow("9999"), 90);
  assert.equal(parseEmployeePerformanceWindow(undefined), 90);
});

test("employee performance remains tenant scoped permission governed and source traceable", async () => {
  const [service, dashboard, report, schema, migration, sidebar, catalog] = await Promise.all([
    readFile(new URL("../src/modules/employee-performance/employee-performance.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/employee-performance/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/employee-performance/[userId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260930120000_employee_performance_foundation/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/components/layout/sidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/core/navigation/tenant-module-catalog.ts", import.meta.url), "utf8"),
  ]);

  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /assignedTo: \{ organizationId: input\.organizationId \}/);
  assert.match(service, /not automated employment decisions/);
  assert.match(dashboard, /VIEW_OWN_EMPLOYEE_PERFORMANCE/);
  assert.match(dashboard, /VIEW_EMPLOYEE_PERFORMANCE/);
  assert.match(report, /route\.userId !== user\.id/);
  assert.match(report, /Source-record evidence/);
  assert.match(schema, /VIEW_OWN_EMPLOYEE_PERFORMANCE/);
  assert.match(schema, /VIEW_EMPLOYEE_PERFORMANCE/);
  assert.match(migration, /ON CONFLICT \("role", "permission"\) DO NOTHING/);
  assert.match(sidebar, /href: "\/employee-performance"/);
  assert.match(catalog, /key: "EMPLOYEE_PERFORMANCE"/);
});
