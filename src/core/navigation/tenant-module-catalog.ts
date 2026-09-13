import { IndustryCategory } from "@prisma/client";
import { isIndustryRecommendedModule } from "@/core/navigation/industry-module-recommendations";

export const tenantModuleCatalog = [
  { key: "PERFORMANCE", label: "Performance Scorecards", root: "/performance" },
  { key: "MANAGEMENT_REVIEWS", label: "Management Reviews", root: "/management-reviews" },
  { key: "ASSURANCE", label: "Operational Assurance", root: "/assurance" },
  { key: "AI_INTELLIGENCE", label: "AI Intelligence", root: "/intelligence" },
  { key: "INCIDENTS", label: "Incident Management", root: "/incidents" },
  { key: "OBSERVATIONS", label: "Safety Observations", root: "/observations" },
  { key: "RISKS", label: "Risk Management", root: "/risks" },
  { key: "MOC", label: "Management of Change", root: "/moc" },
  { key: "ASSETS", label: "Asset Management", root: "/assets" },
  { key: "CONTRACTORS", label: "Contractor Management", root: "/contractors" },
  { key: "PERMITS", label: "Permit to Work", root: "/permits-to-work" },
  { key: "BEHAVIOR_SAFETY", label: "Behavior Safety", root: "/behavior-safety" },
  { key: "EMERGENCY", label: "Emergency Preparedness", root: "/emergency" },
  { key: "CONTINUITY", label: "Business Continuity", root: "/business-continuity" },
  { key: "HEALTH", label: "Occupational Health", root: "/occupational-health" },
  { key: "HYGIENE", label: "Industrial Hygiene", root: "/industrial-hygiene" },
  { key: "CHEMICALS", label: "Chemical Management", root: "/chemicals" },
  { key: "ENVIRONMENTAL", label: "Environmental Management", root: "/environmental" },
  { key: "ESG", label: "ESG Management", root: "/esg" },
  { key: "AUDITS", label: "Audit Management", root: "/audits" },
  { key: "AUDIT_SERVICES", label: "Audit & Assurance Services", root: "/audit-services" },
  { key: "INSPECTIONS", label: "Inspections", root: "/inspections" },
  { key: "RESEARCH", label: "Research & Analytics", root: "/research" },
  { key: "COMPLIANCE", label: "Compliance Management", root: "/compliance" },
  { key: "TRAINING", label: "Training Management", root: "/training" },
  { key: "REPORTS", label: "Enterprise Reports", root: "/reports" },
  { key: "DOCUMENTS", label: "Document Control", root: "/documents" },
  { key: "WORKFLOWS", label: "Workflow Automation", root: "/workflows" },
  { key: "INTEGRATIONS", label: "Enterprise Integrations", root: "/integrations" },
] as const;

export type TenantModuleKey = (typeof tenantModuleCatalog)[number]["key"];
export type TenantModuleOverride = { moduleKey: string; enabled: boolean };

export function isTenantModuleKey(value: string): value is TenantModuleKey {
  return tenantModuleCatalog.some(module => module.key === value);
}

export function moduleForHref(href: string) {
  return [...tenantModuleCatalog].sort((a, b) => b.root.length - a.root.length).find(module => href === module.root || href.startsWith(`${module.root}/`));
}

export function isTenantModuleVisible(category: IndustryCategory, assignments: readonly TenantModuleOverride[], href: string) {
  const catalogEntry = moduleForHref(href);
  if (!catalogEntry) return isIndustryRecommendedModule(category, href);
  const override = assignments.find(assignment => assignment.moduleKey === catalogEntry.key);
  if (catalogEntry.key === "AUDIT_SERVICES" && !override) return category === IndustryCategory.AUDIT_AND_ASSURANCE_SERVICES;
  return override ? override.enabled : isIndustryRecommendedModule(category, href);
}

export function filterTenantVisibleModules<T extends { href: string }>(category: IndustryCategory, assignments: readonly TenantModuleOverride[], items: readonly T[]) {
  return items.filter(item => isTenantModuleVisible(category, assignments, item.href));
}

export function hasAuditServicesEntitlement(category: IndustryCategory, assignments: readonly TenantModuleOverride[]) {
  const override = assignments.find(assignment => assignment.moduleKey === "AUDIT_SERVICES");
  return override ? override.enabled : category === IndustryCategory.AUDIT_AND_ASSURANCE_SERVICES;
}
