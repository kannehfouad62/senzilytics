import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tenant onboarding derives tenant identity while platform actions require platform administration", async () => {
  const [actions, service, tenantPage, platformPage, operationsPage] =
    await Promise.all([
      readFile(
        new URL("../src/features/identity/onboarding.actions.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/modules/platform/tenant-onboarding.service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/(platform)/implementation/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/(platform)/platform/tenants/[id]/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/(platform)/platform/operations/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(actions, /getCurrentUserTenant\(\)/);
  assert.match(actions, /requirePlatformAdministrator\(\)/);
  assert.match(service, /Only a Senzilytics platform administrator can approve go-live/);
  assert.doesNotMatch(tenantPage, /internalNotes:\s*true/);
  assert.match(platformPage, /requirePlatformAdministrator\(\)/);
  assert.match(operationsPage, /requirePlatformAdministrator\(\)/);
});

test("every deployed scheduler records a production heartbeat", async () => {
  const routes = [
    "../src/app/api/workflows/process-sla/route.ts",
    "../src/app/api/cron/audit-schedules/route.ts",
    "../src/app/api/cron/training-compliance/route.ts",
    "../src/app/api/cron/compliance-monitor/route.ts",
    "../src/app/api/cron/chemical-monitor/route.ts",
    "../src/app/api/cron/environmental-monitor/route.ts",
  ];
  const sources = await Promise.all(
    routes.map((route) => readFile(new URL(route, import.meta.url), "utf8")),
  );
  for (const source of sources) {
    assert.match(source, /runTrackedScheduledJob\(/);
    assert.match(source, /isAuthorizedCronRequest/);
  }
});
