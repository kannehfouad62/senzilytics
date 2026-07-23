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
  dueAt: string | null;
  status: string;
  instance: { entityType: string; entityId: string; template: { name: string } };
};

export type MobileModule = {
  key: string;
  label: string;
  description: string;
  href: string;
  category: "COMMAND" | "SAFETY" | "ASSURANCE" | "GOVERNANCE" | "ADMINISTRATION";
  nativeCapability?: "OBSERVATION_CAPTURE" | "INCIDENT_CAPTURE" | "INSPECTION_EXECUTION";
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

export type MobileBootstrap = {
  user: MobileUser;
  organization: { id: string; name: string; subscriptionPlan: string };
  permissions: string[];
  sites: Array<{ id: string; name: string }>;
  observationForms: RuntimeForm[];
  incidentForms: RuntimeForm[];
  inspections: MobileInspection[];
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
