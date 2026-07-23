export type MobileUser = { id: string; name: string; email: string; role: string };

export type MobileTokens = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshToken: string;
  user: MobileUser;
  organization: { id: string; name: string };
};

export type RuntimeField = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  fieldType: "SHORT_TEXT" | "LONG_TEXT" | "NUMBER" | "DATE" | "DATETIME" | "BOOLEAN" | "SINGLE_SELECT" | "MULTI_SELECT" | "EMAIL" | "PHONE" | "FILE" | "SIGNATURE";
  isRequired: boolean;
  options: unknown;
  visibilityRule: unknown;
  sequence: number;
};

export type RuntimeForm = {
  id: string;
  name: string;
  description: string | null;
  version: { id: string; version: number; instructions: string | null; fields: RuntimeField[] };
};

export type MobileNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type MobileTask = {
  id: string;
  name: string;
  stepType: string;
  assignedRole: string | null;
  dueAt: string | null;
  status: string;
  startedAt: string | null;
  href: string | null;
  instance: { entityType: string; entityId: string; template: { name: string } };
};

export type MobileCorrectiveActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "OVERDUE";

export type MobileCorrectiveAction = {
  id: string;
  title: string;
  description: string | null;
  status: MobileCorrectiveActionStatus;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate: string;
  assignedTo: { id: string; name: string };
  isAssignedToCurrentUser: boolean;
  source: { type: string; label: string; href: string };
};

export type MobileCapaCapabilities = {
  canView: boolean;
  canUpdate: boolean;
  canClose: boolean;
  allowedStatuses: MobileCorrectiveActionStatus[];
};

export type MobileModule = {
  key: string;
  label: string;
  description: string;
  href: string;
  category: "COMMAND" | "SAFETY" | "ASSURANCE" | "GOVERNANCE" | "ADMINISTRATION";
  nativeCapability?: "ACTION_CENTER" | "CAPA_EXECUTION" | "OBSERVATION_CAPTURE" | "INCIDENT_CAPTURE" | "INSPECTION_EXECUTION" | "AUDIT_EXECUTION";
};

export type MobileInspectionResponse = {
  result: "NOT_ASSESSED" | "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";
  responseText: string | null;
  numericValue: number | null;
  booleanValue: boolean | null;
  score: number | null;
  comments: string | null;
  answeredAt: string | null;
  finding: { id: string; title: string; riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; status: string } | null;
};

export type MobileInspectionItem = {
  id: string;
  sectionName: string;
  questionText: string;
  guidance: string | null;
  questionType: "YES_NO" | "COMPLIANCE" | "TEXT" | "NUMBER" | "PHOTO";
  isRequired: boolean;
  weight: number;
  sequence: number;
  response: MobileInspectionResponse | null;
};

export type MobileInspection = {
  id: string;
  title: string;
  reference: string | null;
  description: string | null;
  area: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  dueDate: string | null;
  site: { id: string; name: string };
  leadInspector: { id: string; name: string } | null;
  checklistItems: MobileInspectionItem[];
};

export type AuditResponseResult =
  | "PASS"
  | "FAIL"
  | "YES"
  | "NO"
  | "COMPLIANT"
  | "NON_COMPLIANT"
  | "PARTIALLY_COMPLIANT"
  | "NOT_APPLICABLE"
  | "OBSERVATION"
  | "INFORMATION_ONLY";

export type MobileAuditQuestion = {
  id: string;
  questionText: string;
  description: string | null;
  guidance: string | null;
  standardClause: string | null;
  regulatoryRef: string | null;
  responseType: "PASS_FAIL" | "YES_NO" | "NUMERIC" | "FREE_TEXT" | "OBSERVATION" | "MULTIPLE_CHOICE" | "RATING" | "NOT_APPLICABLE";
  sequence: number;
  weight: number;
  isRequired: boolean;
  allowNotApplicable: boolean;
  requireComment: boolean;
  requireEvidence: boolean;
  requirePhoto: boolean;
  minimumNumericValue: number | null;
  maximumNumericValue: number | null;
  options: Array<{
    id: string;
    label: string;
    value: string;
    description: string | null;
    sequence: number;
    triggersFinding: boolean;
  }>;
  response: {
    result: "NOT_ASSESSED" | AuditResponseResult;
    responseText: string | null;
    numericValue: number | null;
    booleanValue: boolean | null;
    selectedOptionValues: string[];
    comments: string | null;
    scoreAwarded: number | null;
    isCompliant: boolean | null;
    requiresFollowUp: boolean;
    answeredAt: string | null;
  } | null;
  evidenceCount: number;
  photoEvidenceCount: number;
  findingCount: number;
};

export type MobileAudit = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  objectives: string | null;
  scope: string | null;
  criteria: string | null;
  auditType: string;
  status: "DRAFT" | "PLANNED" | "SCHEDULED" | "IN_PROGRESS";
  scheduledAt: string | null;
  dueDate: string | null;
  totalQuestionCount: number;
  answeredQuestionCount: number;
  failedQuestionCount: number;
  scorePercentage: number | null;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  leadAuditor: { id: string; name: string } | null;
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    guidance: string | null;
    sequence: number;
    status: string;
    totalQuestionCount: number;
    answeredQuestionCount: number;
    questions: MobileAuditQuestion[];
  }>;
};

export type MobileBootstrap = {
  user: MobileUser;
  organization: { id: string; name: string; subscriptionPlan: string };
  permissions: string[];
  sites: Array<{ id: string; name: string }>;
  observationForms: RuntimeForm[];
  incidentForms: RuntimeForm[];
  inspections: MobileInspection[];
  audits: MobileAudit[];
  correctiveActions: MobileCorrectiveAction[];
  capaCapabilities: MobileCapaCapabilities;
  notifications: MobileNotification[];
  tasks: MobileTask[];
  modules: MobileModule[];
};

export type CapturedAnswer = { fieldId: string; value: string | number | boolean | string[] };
export type CapturedForm = { definitionId: string; versionId: string; answers: CapturedAnswer[] };

export type ObservationPayload = {
  siteId: string;
  title: string;
  description: string;
  type: "UNSAFE_ACT" | "UNSAFE_CONDITION" | "POSITIVE_PRACTICE" | "ENVIRONMENTAL" | "QUALITY" | "OTHER";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  location?: string;
  immediateAction?: string;
  observedAt: string;
  isAnonymous: boolean;
  customForms: CapturedForm[];
};

export type IncidentPayload = {
  siteId: string;
  title: string;
  description: string;
  type: "INJURY" | "NEAR_MISS" | "PROPERTY_DAMAGE" | "ENVIRONMENTAL" | "VEHICLE" | "SECURITY" | "OTHER";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  location?: string;
  occurredAt: string;
  customForms: CapturedForm[];
};

export type InspectionResponsePayload = {
  inspectionId: string;
  checklistItemId: string;
  result: "COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";
  responseText?: string;
  numericValue?: number;
  booleanValue?: boolean;
  score?: number;
  comments?: string;
  createFinding: boolean;
  findingTitle?: string;
  findingDescription?: string;
  findingRiskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findingDueDate?: string;
};

export type AuditStartPayload = {
  auditId: string;
};

export type AuditResponsePayload = {
  auditId: string;
  questionId: string;
  result: AuditResponseResult;
  responseText?: string;
  numericValue?: number;
  booleanValue?: boolean;
  selectedOptionValues: string[];
  comments?: string;
  evidenceNote?: string;
  evidenceUrl?: string;
};

export type CapaStatusPayload = {
  actionId: string;
  status: MobileCorrectiveActionStatus;
  comments?: string;
};
