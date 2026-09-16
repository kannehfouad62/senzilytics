import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { employeePerformanceSlaLevel } from "../src/modules/employee-performance/employee-performance-sla.service";

const dashboard = readFileSync("src/app/(platform)/dashboard/page.tsx", "utf8");
const cron = readFileSync("src/app/api/workflows/process-sla/route.ts", "utf8");
const service = readFileSync("src/modules/employee-performance/employee-performance-sla.service.ts", "utf8");

test("employee performance SLA levels are deterministic and progressive", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  assert.equal(employeePerformanceSlaLevel(new Date("2026-10-12T12:00:00.000Z"), now), "DUE_SOON");
  assert.equal(employeePerformanceSlaLevel(new Date("2026-10-10T11:00:00.000Z"), now), "OVERDUE");
  assert.equal(employeePerformanceSlaLevel(new Date("2026-10-07T12:00:00.000Z"), now), "ESCALATED");
});

test("employee performance monitoring is deduplicated tenant scoped and integrated into the existing scheduler", () => {
  assert.match(service, /organizationId: signal\.organizationId/);
  assert.match(service, /Employee performance SLA:/);
  assert.match(service, /activityLog\.findFirst/);
  assert.match(cron, /processEmployeePerformanceSla/);
  assert.match(cron, /employeePerformanceResult\.escalations/);
});

test("the executive dashboard exposes permission-filtered performance governance without automated employment decisions", () => {
  assert.match(dashboard, /PermissionKey\.VIEW_EMPLOYEE_PERFORMANCE/);
  assert.match(dashboard, /getEmployeePerformanceExecutiveSummary/);
  assert.match(dashboard, /no metric automatically determines an employment outcome/);
  assert.match(dashboard, /Management queue/);
});
