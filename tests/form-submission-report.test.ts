import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildFormSubmissionCsv,
  formSubmissionDirectSourceHref,
  parseFormSubmissionFilters,
  type FormSubmissionCsvEntry,
} from "../src/modules/forms/form-submission-report";
import {
  ConfigurableFormModule,
  ConfigurableSubmissionStatus,
} from "@prisma/client";

test("submission filters accept only governed enums and calendar dates", () => {
  const parsed = parseFormSubmissionFilters({
    q: "  Observation review  ",
    module: "OBSERVATION",
    status: "SUBMITTED",
    definitionId: "form-123",
    from: "2026-07-01",
    to: "2026-07-31",
    page: "3",
  });

  assert.equal(parsed.q, "Observation review");
  assert.equal(parsed.module, ConfigurableFormModule.OBSERVATION);
  assert.equal(parsed.status, ConfigurableSubmissionStatus.SUBMITTED);
  assert.equal(parsed.definitionId, "form-123");
  assert.equal(parsed.from?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(parsed.toExclusive?.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(parsed.page, 3);

  const rejected = parseFormSubmissionFilters({
    module: "SUPER_ADMIN",
    status: "DELETED",
    from: "2026-02-31",
    to: "not-a-date",
    page: "-4",
  });
  assert.equal(rejected.module, null);
  assert.equal(rejected.status, null);
  assert.equal(rejected.from, null);
  assert.equal(rejected.toExclusive, null);
  assert.equal(rejected.page, 1);
});

test("submission source routes never point indirect records at the wrong ID", () => {
  assert.equal(
    formSubmissionDirectSourceHref(
      ConfigurableFormModule.OBSERVATION,
      "observation-1",
    ),
    "/observations/observation-1",
  );
  assert.equal(
    formSubmissionDirectSourceHref(
      ConfigurableFormModule.REGULATORY_INTELLIGENCE,
      "change/1",
    ),
    "/compliance/regulatory/changes/change%2F1",
  );
  assert.equal(
    formSubmissionDirectSourceHref(
      ConfigurableFormModule.ASSET_SAFETY,
      "inspection-1",
    ),
    null,
  );
  assert.equal(
    formSubmissionDirectSourceHref(
      ConfigurableFormModule.SIF_ASSURANCE,
      "verification-1",
    ),
    null,
  );
});

test("CSV export quotes values and neutralizes spreadsheet formulas", () => {
  const entry: FormSubmissionCsvEntry = {
    submissionId: "submission-1",
    formName: "Observation, review",
    module: ConfigurableFormModule.OBSERVATION,
    version: 2,
    status: ConfigurableSubmissionStatus.SUBMITTED,
    sourceEntityId: "observation-1",
    submittedBy: "Fouad \"Auditor\"",
    submittedByEmail: "auditor@example.com",
    submittedAt: new Date("2026-07-25T12:00:00.000Z"),
    responseType: "ANSWER",
    fieldKey: "notes",
    fieldLabel: "Review notes",
    fieldType: "LONG_TEXT",
    value: "=HYPERLINK(\"https://example.com\")",
  };
  const csv = buildFormSubmissionCsv([entry]);

  assert.match(csv, /"Observation, review"/);
  assert.match(csv, /"Fouad ""Auditor"""/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.com""\)"/);
});

test("submission pages and export reauthorize and derive tenant scope", async () => {
  const [listPage, detailPage, exportRoute, service, schema] = await Promise.all([
    readFile(
      new URL(
        "../src/app/(platform)/form-studio/submissions/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/form-studio/submissions/[submissionId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/api/forms/submissions/export/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/forms/form-submission.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  ]);

  for (const source of [listPage, detailPage, exportRoute]) {
    assert.match(
      source,
      /requirePermission\(PermissionKey\.MANAGE_ORGANIZATION\)/,
    );
    assert.match(source, /getCurrentUserTenant\(\)/);
  }
  assert.match(service, /organizationId:\s*input\.organizationId/);
  assert.match(service, /organizationId,/);
  assert.match(service, /MAX_EXPORT_SUBMISSIONS = 5_000/);
  assert.match(exportRoute, /Cache-Control": "private, no-store"/);
  assert.match(schema, /@@index\(\[organizationId, submittedAt\]\)/);
  assert.match(schema, /@@index\(\[organizationId, status, submittedAt\]\)/);
});
