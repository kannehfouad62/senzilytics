import assert from "node:assert/strict";
import test from "node:test";
import { IndustryCategory, PermissionKey } from "@prisma/client";
import {
  canViewNavigationItem,
  filterNavigationItems,
  resolveActiveNavigationHref,
} from "../src/core/permissions/navigation-access";
import { filterIndustryRecommendedModules, isIndustryRecommendedModule } from "../src/core/navigation/industry-module-recommendations";

test("navigation hides an item when its required permission is not granted", () => {
  assert.equal(
    canViewNavigationItem(
      { permission: PermissionKey.VIEW_USERS },
      [PermissionKey.VIEW_AUDITS],
    ),
    false,
  );
});

test("navigation supports pages that accept any one of several permissions", () => {
  const requirement = {
    anyPermissions: [PermissionKey.CREATE_CAPA, PermissionKey.VIEW_REPORTS],
  };

  assert.equal(
    canViewNavigationItem(requirement, [PermissionKey.VIEW_REPORTS]),
    true,
  );
  assert.equal(
    canViewNavigationItem(requirement, [PermissionKey.VIEW_AUDITS]),
    false,
  );
});

test("navigation filtering preserves only accessible modules", () => {
  const items = [
    { href: "/audits", permission: PermissionKey.VIEW_AUDITS },
    { href: "/users", permission: PermissionKey.VIEW_USERS },
    { href: "/tasks" },
  ];

  assert.deepEqual(
    filterNavigationItems(items, [PermissionKey.VIEW_AUDITS]).map(
      (item) => item.href,
    ),
    ["/audits", "/tasks"],
  );
});

test("active navigation uses the most specific matching module route", () => {
  const hrefs = [
    "/assurance",
    "/assurance/sif",
    "/assurance/certification",
  ];

  assert.equal(
    resolveActiveNavigationHref("/assurance/sif/controls/control-1", hrefs),
    "/assurance/sif",
  );
  assert.equal(
    resolveActiveNavigationHref(
      "/assurance/certification/reviews/review-1",
      hrefs,
    ),
    "/assurance/certification",
  );
});

test("active navigation does not match unrelated route prefixes", () => {
  assert.equal(
    resolveActiveNavigationHref("/risk-assessments", ["/risks"]),
    null,
  );
  assert.equal(
    resolveActiveNavigationHref("/form-studio/new/", ["/form-studio"]),
    "/form-studio",
  );
});

test("industry profiles prioritize relevant modules without becoming authorization controls", () => {
  const permitted = [{ href: "/research" }, { href: "/research/datasets" }, { href: "/assets" }, { href: "/dashboard" }, { href: "/modules" }];
  assert.deepEqual(filterIndustryRecommendedModules(IndustryCategory.RESEARCH_AND_ANALYTICS, permitted).map(item => item.href), ["/research", "/research/datasets", "/dashboard", "/modules"]);
  assert.equal(isIndustryRecommendedModule(IndustryCategory.MANUFACTURING, "/assets"), true);
  assert.equal(isIndustryRecommendedModule(IndustryCategory.GENERAL, "/any-future-module"), true);
});
