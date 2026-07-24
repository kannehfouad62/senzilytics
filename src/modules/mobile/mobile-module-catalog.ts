import { PermissionKey } from "@prisma/client";
import { isApprovedPlatformAdministrator } from "@/lib/platform-admin";

export type MobileModuleCategory =
  | "COMMAND"
  | "SAFETY"
  | "ASSURANCE"
  | "GOVERNANCE"
  | "ADMINISTRATION";

export type MobileModuleDefinition = {
  key: string;
  label: string;
  description: string;
  href: string;
  category: MobileModuleCategory;
  permission?: PermissionKey;
  anyPermissions?: readonly PermissionKey[];
  platformOnly?: boolean;
  nativeCapability?: "ACTION_CENTER" | "CAPA_EXECUTION" | "OBSERVATION_CAPTURE" | "INCIDENT_CAPTURE" | "INSPECTION_EXECUTION" | "AUDIT_EXECUTION" | "RISK_FIELD" | "JSA_FIELD" | "COMPLIANCE_CALENDAR" | "TRAINING_ASSIGNMENTS";
  nativePermission?: PermissionKey;
};

const modules: readonly MobileModuleDefinition[] = [
  { key: "dashboard", label: "Executive Dashboard", description: "Enterprise EHS performance, risk signals, and leadership indicators.", href: "/dashboard", category: "COMMAND", permission: PermissionKey.VIEW_DASHBOARD },
  { key: "assurance", label: "Operational Assurance", description: "Connected assurance performance and control effectiveness.", href: "/assurance", category: "COMMAND", permission: PermissionKey.VIEW_DASHBOARD },
  { key: "intelligence", label: "AI Intelligence", description: "Governed EHS intelligence, analysis, and decision support.", href: "/intelligence", category: "COMMAND", permission: PermissionKey.USE_AI },
  { key: "tasks", label: "My Tasks", description: "Assigned workflow steps, due work, and required actions.", href: "/tasks", category: "COMMAND", nativeCapability: "ACTION_CENTER" },
  { key: "observations", label: "Safety Observations", description: "Capture, review, and manage safety observations.", href: "/observations", category: "SAFETY", anyPermissions: [PermissionKey.VIEW_OBSERVATIONS, PermissionKey.CREATE_OBSERVATION], nativeCapability: "OBSERVATION_CAPTURE", nativePermission: PermissionKey.CREATE_OBSERVATION },
  { key: "behavior-safety", label: "Behavior-Based Safety", description: "Behavior programs, coaching, trends, and interventions.", href: "/behavior-safety", category: "SAFETY", permission: PermissionKey.VIEW_BEHAVIOR_SAFETY },
  { key: "incidents", label: "Incidents", description: "Report, investigate, and monitor incidents and near misses.", href: "/incidents", category: "SAFETY", anyPermissions: [PermissionKey.VIEW_INCIDENT, PermissionKey.CREATE_INCIDENT], nativeCapability: "INCIDENT_CAPTURE", nativePermission: PermissionKey.CREATE_INCIDENT },
  { key: "corrective-actions", label: "Corrective Actions", description: "CAPA ownership, verification, closure, and overdue exposure.", href: "/actions", category: "SAFETY", anyPermissions: [PermissionKey.CREATE_CAPA, PermissionKey.UPDATE_CAPA, PermissionKey.CLOSE_CAPA, PermissionKey.VIEW_REPORTS], nativeCapability: "CAPA_EXECUTION" },
  { key: "risks", label: "Risk Register", description: "Enterprise hazards, controls, reviews, and residual risk.", href: "/risks", category: "SAFETY", permission: PermissionKey.VIEW_RISKS, nativeCapability: "RISK_FIELD" },
  { key: "jsa", label: "JSA / JHA", description: "Job steps, hazards, controls, approvals, and acknowledgements.", href: "/risks/jsa", category: "SAFETY", permission: PermissionKey.VIEW_RISKS, nativeCapability: "JSA_FIELD" },
  { key: "moc", label: "Management of Change", description: "Change requests, risk reviews, approvals, and implementation tasks.", href: "/moc", category: "SAFETY", permission: PermissionKey.VIEW_MOC },
  { key: "assets", label: "Assets & Equipment", description: "Asset lifecycle, condition, inspections, and maintenance exposure.", href: "/assets", category: "SAFETY", permission: PermissionKey.VIEW_ASSETS },
  { key: "contractors", label: "Contractors", description: "Contractor qualification, access, performance, and compliance.", href: "/contractors", category: "SAFETY", permission: PermissionKey.VIEW_CONTRACTORS },
  { key: "permits", label: "Permit to Work", description: "Controlled work permits, hazards, controls, and authorizations.", href: "/permits-to-work", category: "SAFETY", permission: PermissionKey.VIEW_PERMITS_TO_WORK },
  { key: "industrial-hygiene", label: "Industrial Hygiene", description: "Exposure assessments, samples, limits, and surveillance.", href: "/industrial-hygiene", category: "SAFETY", permission: PermissionKey.VIEW_INDUSTRIAL_HYGIENE },
  { key: "occupational-health", label: "Occupational Health", description: "Health surveillance programs and fitness controls.", href: "/occupational-health", category: "SAFETY", permission: PermissionKey.VIEW_OCCUPATIONAL_HEALTH },
  { key: "sif", label: "SIF Prevention", description: "Serious injury and fatality signals and critical controls.", href: "/assurance/sif", category: "ASSURANCE", permission: PermissionKey.VIEW_SIF_INTELLIGENCE },
  { key: "certification", label: "Certification Readiness", description: "Management-system readiness, evidence, and gap reviews.", href: "/assurance/certification", category: "ASSURANCE", permission: PermissionKey.VIEW_CERTIFICATION_READINESS },
  { key: "inspections", label: "Inspections", description: "Inspection planning, checklist execution, and findings.", href: "/inspections", category: "ASSURANCE", permission: PermissionKey.VIEW_INSPECTIONS, nativeCapability: "INSPECTION_EXECUTION", nativePermission: PermissionKey.MANAGE_INSPECTIONS },
  { key: "audits", label: "Audit Workspace", description: "Programs, protocols, schedules, execution, findings, and reports.", href: "/audits", category: "ASSURANCE", permission: PermissionKey.VIEW_AUDITS, nativeCapability: "AUDIT_EXECUTION", nativePermission: PermissionKey.MANAGE_AUDITS },
  { key: "compliance", label: "Compliance", description: "Legal obligations, evaluations, permits, and compliance status.", href: "/compliance", category: "GOVERNANCE", permission: PermissionKey.VIEW_COMPLIANCE },
  { key: "compliance-calendar", label: "Compliance Calendar", description: "Daily through annual assigned obligations and completion tracking.", href: "/compliance/calendar", category: "GOVERNANCE", permission: PermissionKey.VIEW_COMPLIANCE, nativeCapability: "COMPLIANCE_CALENDAR" },
  { key: "regulatory", label: "Regulatory Intelligence", description: "Regulatory changes, applicability, impact, and response governance.", href: "/compliance/regulatory", category: "GOVERNANCE", permission: PermissionKey.VIEW_COMPLIANCE },
  { key: "training", label: "Training", description: "Courses, requirements, assignments, competence, and compliance.", href: "/training", category: "GOVERNANCE", permission: PermissionKey.VIEW_TRAINING, nativeCapability: "TRAINING_ASSIGNMENTS" },
  { key: "environmental", label: "Environmental Metrics", description: "Environmental data, targets, controls, and disclosures.", href: "/environmental", category: "GOVERNANCE", permission: PermissionKey.VIEW_ENVIRONMENTAL },
  { key: "esg", label: "Sustainability & ESG", description: "Frameworks, disclosures, governance, and ESG performance.", href: "/esg", category: "GOVERNANCE", permission: PermissionKey.VIEW_ESG },
  { key: "chemicals", label: "Chemicals & SDS", description: "Chemical inventory, SDS records, approvals, and monitoring.", href: "/chemicals", category: "GOVERNANCE", permission: PermissionKey.VIEW_CHEMICALS },
  { key: "reports", label: "Reports", description: "Operational and executive reporting across EHS modules.", href: "/reports", category: "GOVERNANCE", permission: PermissionKey.VIEW_REPORTS },
  { key: "documents", label: "Documents", description: "Controlled documents, evidence, previews, and version history.", href: "/documents", category: "ADMINISTRATION", permission: PermissionKey.MANAGE_DOCUMENTS },
  { key: "organization", label: "Organization Structure", description: "Sites, departments, and organizational structure.", href: "/organizations", category: "ADMINISTRATION", permission: PermissionKey.MANAGE_ORGANIZATION },
  { key: "users", label: "Users", description: "Tenant users, roles, status, and access administration.", href: "/users", category: "ADMINISTRATION", permission: PermissionKey.VIEW_USERS },
  { key: "workflows", label: "Workflows", description: "Workflow templates, approvals, assignments, and SLA controls.", href: "/workflows", category: "ADMINISTRATION", permission: PermissionKey.MANAGE_WORKFLOWS },
  { key: "form-studio", label: "Form Studio", description: "Versioned configurable forms and field governance.", href: "/form-studio", category: "ADMINISTRATION", permission: PermissionKey.MANAGE_ORGANIZATION },
  { key: "integrations", label: "Integrations", description: "Enterprise API credentials, webhooks, and connected systems.", href: "/integrations", category: "ADMINISTRATION", permission: PermissionKey.MANAGE_INTEGRATIONS },
  { key: "activity", label: "Activity Log", description: "Tenant audit trail and accountable platform activity.", href: "/activity", category: "ADMINISTRATION", permission: PermissionKey.VIEW_ACTIVITY_LOG },
  { key: "tenant-provisioning", label: "Tenant Provisioning", description: "Senzilytics tenant plans, identity, and lifecycle administration.", href: "/platform/tenants", category: "ADMINISTRATION", platformOnly: true },
];

export function getMobileModuleCatalog(input: {
  permissions: readonly PermissionKey[];
  user: {
    email: string;
    role: string;
    isActive: boolean;
    isPlatformAdmin: boolean;
  };
}) {
  const granted = new Set(input.permissions);
  const platformAdministrator = isApprovedPlatformAdministrator(input.user);

  return modules
    .filter((module) => {
      if (module.platformOnly) return platformAdministrator;
      if (module.permission && !granted.has(module.permission)) return false;
      if (module.anyPermissions?.length && !module.anyPermissions.some((permission) => granted.has(permission))) return false;
      return true;
    })
    .map((module) => ({
      key: module.key,
      label: module.label,
      description: module.description,
      href: module.href,
      category: module.category,
      ...(module.nativeCapability && (!module.nativePermission || granted.has(module.nativePermission))
        ? { nativeCapability: module.nativeCapability }
        : {}),
    }));
}
