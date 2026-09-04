import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  localizedResearchField,
  normalizeResearchLocale,
} from "../src/modules/research/research-localization";

test("research locale codes are normalized and unsafe values rejected", () => {
  assert.equal(normalizeResearchLocale(" PT_BR "), "pt-br");
  assert.equal(normalizeResearchLocale("fr"), "fr");
  assert.equal(normalizeResearchLocale("../english"), null);
  assert.equal(normalizeResearchLocale(""), null);
});

test("localized option labels retain governed source values", () => {
  const field = localizedResearchField(
    {
      id: "field-country",
      label: "Country",
      description: null,
      placeholder: null,
      options: ["Ghana", "Liberia"],
    },
    {
      "field-country": {
        label: "Pays",
        options: { Ghana: "Ghana", Liberia: "Libéria" },
      },
    },
  );
  assert.equal(field.label, "Pays");
  assert.deepEqual(field.options, [
    { value: "Ghana", label: "Ghana" },
    { value: "Liberia", label: "Libéria" },
  ]);
});

test("questionnaire localizations are version-bound, approved and tenant-scoped", async () => {
  const [schema, migration, actions, publicPage, runtimeFields] =
    await Promise.all([
      readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../prisma/migrations/20260907120000_research_questionnaire_localizations/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/features/research/questionnaire-localization-actions.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/app/survey/[token]/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/features/forms/runtime-form-fields.tsx", import.meta.url),
        "utf8",
      ),
    ]);
  assert.match(schema, /model ResearchQuestionnaireLocalization/);
  assert.match(schema, /@@unique\(\[formVersionId, locale\]\)/);
  assert.match(migration, /ResearchQuestionnaireLocalizationStatus/);
  assert.match(migration, /ResearchPublicResponse" ADD COLUMN "locale"/);
  assert.match(actions, /DESIGN_RESEARCH_QUESTIONNAIRES/);
  assert.match(actions, /PUBLISH_RESEARCH_QUESTIONNAIRES/);
  assert.match(actions, /organizationId/);
  assert.match(actions, /status: "DRAFT"/);
  assert.match(publicPage, /where: \{ status: "APPROVED" \}/);
  assert.match(publicPage, /searchParams: Promise<\{ invite\?: string; lang\?: string \}>/);
  assert.match(runtimeFields, /value=\{option\.value\}/);
});
