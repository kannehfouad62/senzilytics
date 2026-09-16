import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20261001120000_employee_performance_goals_reviews/migration.sql", "utf8");
const service = readFileSync("src/modules/employee-performance/employee-performance-governance.service.ts", "utf8");
const actions = readFileSync("src/features/employee-performance/employee-performance-governance.actions.ts", "utf8");
const view = readFileSync("src/features/employee-performance/employee-performance-governance.tsx", "utf8");

test("employee performance goals and reviews are tenant-scoped governed records", () => {
  assert.match(schema, /model EmployeePerformanceGoal/);
  assert.match(schema, /model EmployeePerformanceReview/);
  assert.match(schema, /evidenceSnapshot\s+Json/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\)/);
});

test("review lifecycle preserves employee voice before accountable closure", () => {
  assert.match(service, /reviewer cannot create their own governed review/);
  assert.match(service, /CONTEXT_REQUESTED/);
  assert.match(service, /The employee must acknowledge the review before closure/);
  assert.match(view, /Request context/);
  assert.match(view, /Respond and reshare/);
});

test("management mutations require the dedicated permission", () => {
  assert.match(schema, /MANAGE_EMPLOYEE_PERFORMANCE/);
  assert.match(actions, /requirePermission\(PermissionKey\.MANAGE_EMPLOYEE_PERFORMANCE\)/);
  assert.match(actions, /requirePermission\(PermissionKey\.VIEW_OWN_EMPLOYEE_PERFORMANCE\)/);
});

test("reviews use a frozen source-evidence snapshot and notify the employee", () => {
  assert.match(service, /const evidenceSnapshot/);
  assert.match(service, /sources: employee\.sources\.map/);
  assert.match(service, /sendTenantNotificationEmail/);
  assert.match(service, /createNotification/);
});
