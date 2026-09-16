import { IndustryCategory, PermissionKey } from "@prisma/client";
import { isIndustryRecommendedModule } from "@/core/navigation/industry-module-recommendations";

export const tenantModuleCatalog = [
  { key: "PERFORMANCE", label: "Performance Scorecards", root: "/performance" },
  { key: "EMPLOYEE_PERFORMANCE", label: "Employee Performance", root: "/employee-performance" },
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
export type UserModuleOverride = { moduleKey: string; enabled: boolean };

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

export function filterUserVisibleModules<T extends { href: string }>(assignments: readonly UserModuleOverride[], items: readonly T[]) {
  if (!assignments.length) return [...items];
  return items.filter((item) => {
    const catalogEntry = moduleForHref(item.href);
    if (!catalogEntry) return true;
    return assignments.find((assignment) => assignment.moduleKey === catalogEntry.key)?.enabled === true;
  });
}

export function tenantAssignableModules(category: IndustryCategory, assignments: readonly TenantModuleOverride[]) {
  return tenantModuleCatalog.filter((module) => isTenantModuleVisible(category, assignments, module.root));
}

const permissionModules: Partial<Record<PermissionKey, TenantModuleKey>> = {
  VIEW_REPORTS: "REPORTS",
  CREATE_INCIDENT: "INCIDENTS", VIEW_INCIDENT: "INCIDENTS", UPDATE_INCIDENT: "INCIDENTS", DELETE_INCIDENT: "INCIDENTS",
  CREATE_CAPA: "INCIDENTS", UPDATE_CAPA: "INCIDENTS", CLOSE_CAPA: "INCIDENTS",
  VIEW_AUDITS: "AUDITS", MANAGE_AUDITS: "AUDITS",
  VIEW_INSPECTIONS: "INSPECTIONS", MANAGE_INSPECTIONS: "INSPECTIONS",
  VIEW_COMPLIANCE: "COMPLIANCE", MANAGE_COMPLIANCE: "COMPLIANCE",
  VIEW_TRAINING: "TRAINING", MANAGE_TRAINING: "TRAINING",
  USE_AI: "AI_INTELLIGENCE", VIEW_PREDICTIVE_INTELLIGENCE: "AI_INTELLIGENCE", MANAGE_PREDICTIVE_INTELLIGENCE: "AI_INTELLIGENCE",
  MANAGE_WORKFLOWS: "WORKFLOWS", MANAGE_DOCUMENTS: "DOCUMENTS", MANAGE_INTEGRATIONS: "INTEGRATIONS",
  VIEW_RISKS: "RISKS", MANAGE_RISKS: "RISKS", VIEW_MOC: "MOC", MANAGE_MOC: "MOC",
  CREATE_OBSERVATION: "OBSERVATIONS", VIEW_OBSERVATIONS: "OBSERVATIONS", MANAGE_OBSERVATIONS: "OBSERVATIONS",
  VIEW_CHEMICALS: "CHEMICALS", MANAGE_CHEMICALS: "CHEMICALS", VIEW_ENVIRONMENTAL: "ENVIRONMENTAL", MANAGE_ENVIRONMENTAL: "ENVIRONMENTAL",
  VIEW_ESG: "ESG", MANAGE_ESG: "ESG", VIEW_CONTRACTORS: "CONTRACTORS", MANAGE_CONTRACTORS: "CONTRACTORS",
  VIEW_PERMITS_TO_WORK: "PERMITS", MANAGE_PERMITS_TO_WORK: "PERMITS",
  VIEW_INDUSTRIAL_HYGIENE: "HYGIENE", MANAGE_INDUSTRIAL_HYGIENE: "HYGIENE",
  VIEW_OCCUPATIONAL_HEALTH: "HEALTH", MANAGE_OCCUPATIONAL_HEALTH: "HEALTH",
  VIEW_SIF_INTELLIGENCE: "ASSURANCE", MANAGE_CRITICAL_CONTROLS: "ASSURANCE", VIEW_CERTIFICATION_READINESS: "ASSURANCE", MANAGE_CERTIFICATION_READINESS: "ASSURANCE",
  VIEW_ASSETS: "ASSETS", MANAGE_ASSETS: "ASSETS", VIEW_BEHAVIOR_SAFETY: "BEHAVIOR_SAFETY", RECORD_BEHAVIOR_COACHING: "BEHAVIOR_SAFETY", MANAGE_BEHAVIOR_SAFETY: "BEHAVIOR_SAFETY",
  VIEW_PERFORMANCE_SCORECARDS: "PERFORMANCE", MANAGE_PERFORMANCE_SCORECARDS: "PERFORMANCE",
  VIEW_OWN_EMPLOYEE_PERFORMANCE: "EMPLOYEE_PERFORMANCE", VIEW_EMPLOYEE_PERFORMANCE: "EMPLOYEE_PERFORMANCE", MANAGE_EMPLOYEE_PERFORMANCE: "EMPLOYEE_PERFORMANCE",
  VIEW_EMERGENCY_PREPAREDNESS: "EMERGENCY", MANAGE_EMERGENCY_PREPAREDNESS: "EMERGENCY", RECORD_EMERGENCY_RESPONSE: "EMERGENCY",
  VIEW_BUSINESS_CONTINUITY: "CONTINUITY", MANAGE_BUSINESS_CONTINUITY: "CONTINUITY", RECORD_CONTINUITY_EVENT: "CONTINUITY",
  VIEW_EXECUTIVE_REVIEWS: "MANAGEMENT_REVIEWS", MANAGE_EXECUTIVE_REVIEWS: "MANAGEMENT_REVIEWS", APPROVE_EXECUTIVE_REVIEWS: "MANAGEMENT_REVIEWS",
  VIEW_RESEARCH: "RESEARCH", CREATE_RESEARCH_PROJECT: "RESEARCH", MANAGE_RESEARCH_PROJECTS: "RESEARCH", MANAGE_RESEARCH_CLIENTS: "RESEARCH", MANAGE_RESEARCH_TEAMS: "RESEARCH", DESIGN_RESEARCH_QUESTIONNAIRES: "RESEARCH", PUBLISH_RESEARCH_QUESTIONNAIRES: "RESEARCH", COLLECT_RESEARCH_DATA: "RESEARCH", MANAGE_RESEARCH_DATASETS: "RESEARCH", RUN_RESEARCH_ANALYSIS: "RESEARCH", PUBLISH_RESEARCH_DASHBOARDS: "RESEARCH", EXPORT_RESEARCH_OUTPUTS: "RESEARCH", APPROVE_RESEARCH_OUTPUTS: "RESEARCH",
};

export function filterUserModulePermissions(permissions: readonly PermissionKey[], assignments: readonly UserModuleOverride[]) {
  if (!assignments.length) return [...permissions];
  const enabled = new Set(assignments.filter((assignment) => assignment.enabled).map((assignment) => assignment.moduleKey));
  return permissions.filter((permission) => {
    const moduleKey = permissionModules[permission];
    return !moduleKey || enabled.has(moduleKey);
  });
}

export function hasAuditServicesEntitlement(category: IndustryCategory, assignments: readonly TenantModuleOverride[]) {
  const override = assignments.find(assignment => assignment.moduleKey === "AUDIT_SERVICES");
  return override ? override.enabled : category === IndustryCategory.AUDIT_AND_ASSURANCE_SERVICES;
}
