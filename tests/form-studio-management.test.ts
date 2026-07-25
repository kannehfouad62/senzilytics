import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Form Studio management actions reauthorize and derive tenant ownership", async () => {
  const [actions, service] = await Promise.all([
    readFile(
      new URL("../src/features/forms/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/forms/configurable-form.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(actions, /requirePermission\(PermissionKey\.MANAGE_ORGANIZATION\)/);
  assert.match(actions, /getCurrentUserTenant\(\)/);
  assert.match(service, /organizationId:\s*input\.organizationId/);
  assert.match(service, /configurableFormDeletionBlocker/);
  assert.match(service, /ActivityAction\.DELETE/);
  assert.doesNotMatch(actions, /return\s+prisma\./);
});

test("unassigned forms are excluded from operational runtime forms", async () => {
  const runtime = await readFile(
    new URL("../src/modules/forms/runtime-form.service.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    runtime,
    /configurableFormDefinition\.findMany\(\{where:\{organizationId,module,isActive:true\}/,
  );
});

test("desktop and mobile navigation use route-aware active links", async () => {
  const [activeLink, sidebar, topbar] = await Promise.all([
    readFile(
      new URL(
        "../src/components/layout/active-navigation-link.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/components/layout/sidebar.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/layout/topbar.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(activeLink, /usePathname\(\)/);
  assert.match(activeLink, /aria-current=\{active \? "page"/);
  assert.match(sidebar, /ActiveNavigationLink/);
  assert.match(topbar, /ActiveNavigationLink/);
});
