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

export type MobileBootstrap = {
  user: MobileUser;
  organization: { id: string; name: string; subscriptionPlan: string };
  permissions: string[];
  sites: Array<{ id: string; name: string }>;
  observationForms: RuntimeForm[];
  notifications: MobileNotification[];
  tasks: MobileTask[];
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
