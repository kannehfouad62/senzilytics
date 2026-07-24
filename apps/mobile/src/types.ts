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
  nativeCapability?: "ACTION_CENTER" | "CAPA_EXECUTION" | "OBSERVATION_CAPTURE" | "INCIDENT_CAPTURE" | "INSPECTION_EXECUTION" | "AUDIT_EXECUTION" | "RISK_FIELD" | "JSA_FIELD" | "COMPLIANCE_CALENDAR" | "TRAINING_ASSIGNMENTS" | "MOC_EXECUTION" | "PERMIT_TO_WORK_EXECUTION" | "ASSET_FIELD" | "CONTRACTOR_FIELD" | "INDUSTRIAL_HYGIENE_FIELD" | "OCCUPATIONAL_HEALTH_FIELD" | "CHEMICAL_FIELD" | "ENVIRONMENTAL_FIELD";
};

export type MobileDepartment = {
  id: string;
  name: string;
  siteId: string;
};

export type RiskLikelihood =
  | "RARE"
  | "UNLIKELY"
  | "POSSIBLE"
  | "LIKELY"
  | "ALMOST_CERTAIN";

export type RiskImpact =
  | "INSIGNIFICANT"
  | "MINOR"
  | "MODERATE"
  | "MAJOR"
  | "CATASTROPHIC";

export type MobileRisk = {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: string;
  hazardType: string | null;
  process: string | null;
  status: string;
  currentLikelihood: RiskLikelihood;
  currentImpact: RiskImpact;
  currentScore: number;
  currentRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  residualLikelihood: RiskLikelihood;
  residualImpact: RiskImpact;
  residualScore: number;
  residualRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reviewFrequency: string;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  site: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  controls: Array<{
    id: string;
    name: string;
    description: string | null;
    controlType: string;
    hierarchy: string;
    effectiveness: string;
    status: string;
    dueDate: string | null;
  }>;
  reviewCount: number;
};

export type MobileJsa = {
  id: string;
  reference: string;
  version: number;
  title: string;
  jobDescription: string;
  workLocation: string | null;
  requiredCompetency: string | null;
  requiredPpe: string | null;
  emergencyRequirements: string | null;
  status: string;
  effectiveDate: string | null;
  reviewDueDate: string | null;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  acknowledgment: {
    acknowledgedAt: string;
    statement: string | null;
  } | null;
  steps: Array<{
    id: string;
    sequence: number;
    taskStep: string;
    hazards: Array<{
      id: string;
      hazard: string;
      potentialConsequence: string;
      initialLikelihood: RiskLikelihood;
      initialImpact: RiskImpact;
      initialScore: number;
      residualLikelihood: RiskLikelihood;
      residualImpact: RiskImpact;
      residualScore: number;
      controls: Array<{
        id: string;
        hierarchy: string;
        description: string;
        responsibleRole: string | null;
        verificationRequired: boolean;
      }>;
    }>;
  }>;
};

export type MobileRiskCapabilities = {
  canView: boolean;
  canManage: boolean;
};

export type MobileComplianceOccurrenceStatus =
  | "UPCOMING"
  | "DUE"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "REJECTED"
  | "OVERDUE"
  | "CANCELLED";

export type MobileComplianceOccurrence = {
  id: string;
  dueAt: string;
  status: MobileComplianceOccurrenceStatus;
  completionNotes: string | null;
  evidenceUrl: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  assignedTo: { id: string; name: string };
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  task: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    category: string;
    regulatoryReference: string | null;
    evidenceRequired: boolean;
    approvalRequired: boolean;
    recurrence: string;
  };
  isAssignedToCurrentUser: boolean;
};

export type MobileTrainingAssignment = {
  id: string;
  courseName: string;
  status: MobileCorrectiveActionStatus;
  dueDate: string | null;
  completedAt: string | null;
  assignedAt: string;
  expiresAt: string | null;
  provider: string | null;
  certificateNumber: string | null;
  score: number | null;
  notes: string | null;
  user: { id: string; name: string };
  assignedBy: { id: string; name: string } | null;
  course: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    provider: string | null;
    validityMonths: number | null;
  } | null;
  requirement: {
    id: string;
    dueWithinDays: number;
    renewalLeadDays: number;
  } | null;
  isAssignedToCurrentUser: boolean;
};

export type MobileComplianceTrainingCapabilities = {
  canViewCompliance: boolean;
  canManageCompliance: boolean;
  canViewTraining: boolean;
  canManageTraining: boolean;
};

export type MobileMocStatus =
  | "DRAFT"
  | "TECHNICAL_REVIEW"
  | "RISK_REVIEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IMPLEMENTATION"
  | "VERIFICATION"
  | "CLOSED"
  | "REJECTED"
  | "CANCELLED";

export type MobileMocTaskStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED"
  | "CANCELLED";

export type MobileManagementOfChange = {
  id: string;
  reference: string;
  title: string;
  description: string;
  businessJustification: string;
  changeType: string;
  changeDuration: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: MobileMocStatus;
  emergencyJustification: string | null;
  temporaryExpirationDate: string | null;
  affectedProcess: string | null;
  affectedEquipment: string | null;
  affectedSystems: string | null;
  affectedMaterials: string | null;
  operationalImpact: string | null;
  regulatoryImpact: string | null;
  environmentalImpact: string | null;
  safetyImpact: string | null;
  qualityImpact: string | null;
  initialScore: number;
  initialRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  residualScore: number;
  residualRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  proposedStartDate: string | null;
  plannedCompletionDate: string | null;
  actualStartDate: string | null;
  implementedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  requestor: { id: string; name: string };
  owner: { id: string; name: string } | null;
  nextStatuses: MobileMocStatus[];
  isOwner: boolean;
  isRequestor: boolean;
  approvals: Array<{
    id: string;
    role: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "NOT_REQUIRED";
    sequence: number;
    comments: string | null;
    requestedAt: string;
    decidedAt: string | null;
    approver: { id: string; name: string } | null;
    isAssignedToCurrentUser: boolean;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    taskType: string;
    status: MobileMocTaskStatus;
    sequence: number | null;
    isRequired: boolean;
    dueDate: string | null;
    startedAt: string | null;
    completedAt: string | null;
    verifiedAt: string | null;
    evidenceNote: string | null;
    assignedTo: { id: string; name: string } | null;
    verifiedBy: { id: string; name: string } | null;
    isAssignedToCurrentUser: boolean;
  }>;
  riskLinks: Array<{
    id: string;
    relationshipNote: string | null;
    risk: {
      id: string;
      reference: string;
      title: string;
      currentScore: number;
      currentRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      residualScore: number;
      residualRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    };
  }>;
};

export type MobilePermitToWorkStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "SUSPENDED"
  | "CLOSED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export type MobilePermitToWork = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  type: string;
  status: MobilePermitToWorkStatus;
  responsiblePerson: string;
  exactLocation: string;
  workOrderReference: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  hazardsSummary: string;
  controlsSummary: string;
  requiredPpe: string | null;
  isolationDetails: string | null;
  emergencyPlan: string | null;
  gasTestingRequired: boolean;
  approvedAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  closedAt: string | null;
  closeoutNotes: string | null;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  contractor: {
    id: string;
    name: string;
    status: string;
    insuranceExpiresAt: string | null;
  } | null;
  requestedBy: { id: string; name: string };
  issuedBy: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
  closedBy: { id: string; name: string } | null;
  nextStatuses: MobilePermitToWorkStatus[];
  isRequestedByCurrentUser: boolean;
  controls: Array<{
    id: string;
    description: string;
    isRequired: boolean;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedBy: { id: string; name: string } | null;
  }>;
  gasTests: Array<{
    id: string;
    testedAt: string;
    oxygenPercent: number | null;
    lelPercent: number | null;
    h2sPpm: number | null;
    coPpm: number | null;
    result: "PASS" | "FAIL";
    notes: string | null;
    performedBy: { id: string; name: string };
  }>;
  workers: Array<{
    id: string;
    role: string | null;
    worker: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string | null;
      status: string;
      inductionExpiresAt: string | null;
    };
  }>;
  history: Array<{
    id: string;
    fromStatus: MobilePermitToWorkStatus | null;
    toStatus: MobilePermitToWorkStatus;
    comments: string | null;
    createdAt: string;
    actor: { id: string; name: string };
  }>;
};

export type MobileMocPermitCapabilities = {
  canViewMoc: boolean;
  canManageMoc: boolean;
  canViewPermits: boolean;
  canManagePermits: boolean;
};

export type MobileAssetStatus =
  | "ACTIVE"
  | "OUT_OF_SERVICE"
  | "UNDER_MAINTENANCE"
  | "QUARANTINED"
  | "RETIRED";

export type MobileAssetDefectStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "REPAIR_PLANNED"
  | "REPAIRED"
  | "VERIFIED"
  | "CLOSED"
  | "DEFERRED";

export type MobileAssetMaintenanceStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "OVERDUE";

export type MobileAsset = {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  type: string;
  status: MobileAssetStatus;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isSafetyCritical: boolean;
  manufacturer: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  location: string | null;
  commissionedAt: string | null;
  inspectionIntervalDays: number;
  lastInspectionAt: string | null;
  nextInspectionDueAt: string;
  maintenanceIntervalDays: number;
  lastMaintenanceAt: string | null;
  nextMaintenanceDueAt: string;
  permitRequired: boolean;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  nextStatuses: MobileAssetStatus[];
  isOwner: boolean;
  inspections: Array<{
    id: string;
    inspectedAt: string;
    result: "SATISFACTORY" | "DEFECT_FOUND" | "OUT_OF_SERVICE" | "NOT_INSPECTED";
    conditionScore: number | null;
    evidenceReference: string | null;
    observations: string | null;
    immediateAction: string | null;
    nextInspectionDueAt: string;
    inspectedBy: { id: string; name: string };
  }>;
  defects: Array<{
    id: string;
    reference: string;
    title: string;
    description: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status: MobileAssetDefectStatus;
    dueDate: string | null;
    immediateControls: string | null;
    repairPlan: string | null;
    verificationEvidence: string | null;
    verifiedAt: string | null;
    correctiveActionId: string | null;
    reportedBy: { id: string; name: string };
    owner: { id: string; name: string } | null;
    verifiedBy: { id: string; name: string } | null;
    nextStatuses: MobileAssetDefectStatus[];
    isAssignedToCurrentUser: boolean;
  }>;
  maintenanceRecords: Array<{
    id: string;
    type: string;
    status: MobileAssetMaintenanceStatus;
    title: string;
    scheduledAt: string;
    dueAt: string;
    startedAt: string | null;
    completedAt: string | null;
    serviceProvider: string | null;
    workOrderReference: string | null;
    workSummary: string | null;
    evidenceReference: string | null;
    downtimeHours: number | null;
    nextMaintenanceDueAt: string | null;
    technician: { id: string; name: string } | null;
    defect: { id: string; reference: string; title: string } | null;
    nextStatuses: MobileAssetMaintenanceStatus[];
    isAssignedToCurrentUser: boolean;
  }>;
};

export type MobileContractorStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SUSPENDED"
  | "EXPIRED"
  | "INACTIVE";

export type MobileContractor = {
  id: string;
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  services: string | null;
  safetyProgramSummary: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiresAt: string | null;
  status: MobileContractorStatus;
  safetyRating: number | null;
  approvedAt: string | null;
  suspensionReason: string | null;
  notes: string | null;
  approvedBy: { id: string; name: string } | null;
  nextStatuses: MobileContractorStatus[];
  requiredFormCount: number;
  submittedFormCount: number;
  sites: Array<{
    id: string;
    approvedAt: string;
    expiresAt: string | null;
    notes: string | null;
    site: { id: string; name: string };
  }>;
  workers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    status: "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
    inductionCompletedAt: string | null;
    inductionExpiresAt: string | null;
    medicalExpiresAt: string | null;
    competencySummary: string | null;
    notes: string | null;
    inductionCurrent: boolean;
    medicalCurrent: boolean;
  }>;
  permitsToWork: Array<{
    id: string;
    reference: string;
    title: string;
    status: MobilePermitToWorkStatus;
    plannedStartAt: string;
    plannedEndAt: string;
    site: { id: string; name: string };
  }>;
};

export type MobileAssetContractorCapabilities = {
  canViewAssets: boolean;
  canManageAssets: boolean;
  canViewContractors: boolean;
  canManageContractors: boolean;
};

export type MobileExposureAssessmentStatus =
  | "DRAFT"
  | "PLANNED"
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "COMPLETED"
  | "CANCELLED";

export type MobileExposureAssessment = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  status: MobileExposureAssessmentStatus;
  scheduledAt: string | null;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  scope: string | null;
  samplingPlan: string | null;
  observations: string | null;
  conclusions: string | null;
  recommendations: string | null;
  site: { id: string; name: string };
  department: { id: string; name: string } | null;
  assessor: { id: string; name: string } | null;
  group: {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    jobRoles: string | null;
    tasks: string | null;
    locations: string | null;
    exposedHeadcount: number | null;
    existingControls: string | null;
    requiredPpe: string | null;
    reviewDueDate: string | null;
    owner: { id: string; name: string } | null;
    agents: Array<{
      agent: {
        id: string;
        name: string;
        category: string;
        casNumber: string | null;
        description: string | null;
        healthEffects: string | null;
        exposureRoutes: string | null;
        occupationalLimit: number | null;
        actionLevel: number | null;
        ceilingLimit: number | null;
        unit: string | null;
        limitSource: string | null;
        samplingMethod: string | null;
        analyticalMethod: string | null;
        requiresSurveillance: boolean;
      };
    }>;
  };
  samples: Array<{
    id: string;
    sampleType: "PERSONAL" | "AREA" | "TASK" | "DIRECT_READING" | "WIPE";
    sampleReference: string | null;
    location: string | null;
    task: string | null;
    sampledAt: string;
    durationMinutes: number | null;
    resultValue: number | null;
    reportingLimit: number | null;
    occupationalLimit: number | null;
    actionLevel: number | null;
    unit: string | null;
    exposureRatio: number | null;
    classification:
      | "BELOW_DETECTION"
      | "BELOW_ACTION_LEVEL"
      | "AT_OR_ABOVE_ACTION_LEVEL"
      | "ABOVE_LIMIT"
      | "NOT_EVALUATED";
    laboratory: string | null;
    analyticalMethod: string | null;
    analyzedAt: string | null;
    notes: string | null;
    agent: { id: string; name: string; category: string };
    sampledWorker: { id: string; name: string } | null;
    createdBy: { id: string; name: string };
  }>;
  nextStatuses: MobileExposureAssessmentStatus[];
  isAssignedToCurrentUser: boolean;
  missingFormDefinitionIds: string[];
};

export type MobileSurveillanceProgramStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "ARCHIVED";

export type MobileSurveillanceProgram = {
  id: string;
  name: string;
  description: string | null;
  status: MobileSurveillanceProgramStatus;
  regulatoryBasis: string | null;
  protocolReference: string | null;
  providerName: string | null;
  frequencyMonths: number;
  leadDays: number;
  isActive: boolean;
  agent: { id: string; name: string; category: string } | null;
  group: { id: string; name: string; code: string | null } | null;
  responsibleUser: { id: string; name: string };
  nextStatuses: MobileSurveillanceProgramStatus[];
  isResponsibleUser: boolean;
  enrollments: Array<{
    id: string;
    status: "ENROLLED" | "DUE" | "COMPLETED" | "OVERDUE" | "REMOVED";
    enrolledAt: string;
    lastCompletedAt: string | null;
    nextDueAt: string;
    fitnessOutcome:
      | "NOT_ASSESSED"
      | "CLEARED"
      | "CLEARED_WITH_RESTRICTIONS"
      | "TEMPORARILY_NOT_CLEARED";
    workRestrictions: string | null;
    certificateReference: string | null;
    removedAt: string | null;
    user: { id: string; name: string };
    completedBy: { id: string; name: string } | null;
    isCurrentUser: boolean;
  }>;
};

export type MobileHygieneHealthCapabilities = {
  canViewIndustrialHygiene: boolean;
  canManageIndustrialHygiene: boolean;
  canViewOccupationalHealth: boolean;
  canManageOccupationalHealth: boolean;
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

export type MobileChemicalApprovalStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "RESTRICTED"
  | "PROHIBITED"
  | "ARCHIVED";

export type MobileChemical = {
  id: string;
  productName: string;
  productCode: string | null;
  manufacturer: string | null;
  supplier: string | null;
  casNumber: string | null;
  description: string | null;
  status: MobileChemicalApprovalStatus;
  signalWord: "DANGER" | "WARNING" | "NONE";
  hazardClassifications: string | null;
  pictograms: string | null;
  exposureLimits: string | null;
  requiredPpe: string | null;
  firstAidMeasures: string | null;
  spillResponse: string | null;
  storageRequirements: string | null;
  incompatibilities: string | null;
  sdsRevisionDate: string | null;
  sdsReviewDueDate: string | null;
  regulatoryLists: string | null;
  regulatoryNotes: string | null;
  reviewedAt: string | null;
  reviewedBy: { id: string; name: string } | null;
  nextStatuses: MobileChemicalApprovalStatus[];
  sdsReviewOverdue: boolean;
  missingFormDefinitionIds: string[];
  inventories: Array<{
    id: string;
    storageLocation: string;
    quantity: number;
    unit: string;
    maximumAllowed: number | null;
    containerType: string | null;
    storageNotes: string | null;
    inventoriedAt: string;
    site: { id: string; name: string };
    limitExceeded: boolean;
  }>;
};

export type MobileEnvironmentalDataPoint = {
  id: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  normalizedValue: number;
  quality: "MEASURED" | "CALCULATED" | "ESTIMATED" | "SUPPLIER_PROVIDED";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  evidenceSummary: string | null;
  notes: string | null;
  approvedAt: string | null;
  site: { id: string; name: string };
  enteredBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  missingFormDefinitionIds: string[];
};

export type MobileEnvironmentalMetric = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  sourceUnit: string;
  reportingUnit: string;
  conversionFactor: number;
  methodology: string | null;
  reportingFrequency: string;
  dataPoints: MobileEnvironmentalDataPoint[];
};

export type MobileEnvironmentalTarget = {
  id: string;
  metricId: string;
  name: string;
  baselineYear: number;
  baselineValue: number;
  targetYear: number;
  targetValue: number;
  description: string | null;
};

export type MobileChemicalEnvironmentalCapabilities = {
  canViewChemicals: boolean;
  canManageChemicals: boolean;
  canViewEnvironmental: boolean;
  canManageEnvironmental: boolean;
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
  departments: MobileDepartment[];
  risks: MobileRisk[];
  jsas: MobileJsa[];
  riskCapabilities: MobileRiskCapabilities;
  complianceOccurrences: MobileComplianceOccurrence[];
  trainingAssignments: MobileTrainingAssignment[];
  complianceTrainingCapabilities: MobileComplianceTrainingCapabilities;
  managementOfChanges: MobileManagementOfChange[];
  permitsToWork: MobilePermitToWork[];
  mocPermitCapabilities: MobileMocPermitCapabilities;
  assets: MobileAsset[];
  contractors: MobileContractor[];
  assetContractorCapabilities: MobileAssetContractorCapabilities;
  assetInspectionForms: RuntimeForm[];
  exposureAssessments: MobileExposureAssessment[];
  surveillancePrograms: MobileSurveillanceProgram[];
  hygieneHealthPeople: Array<{ id: string; name: string }>;
  hygieneHealthCapabilities: MobileHygieneHealthCapabilities;
  industrialHygieneForms: RuntimeForm[];
  chemicals: MobileChemical[];
  environmentalMetrics: MobileEnvironmentalMetric[];
  environmentalTargets: MobileEnvironmentalTarget[];
  chemicalEnvironmentalCapabilities:
    MobileChemicalEnvironmentalCapabilities;
  chemicalForms: RuntimeForm[];
  environmentalForms: RuntimeForm[];
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

export type RiskCapturePayload = {
  siteId: string;
  departmentId?: string;
  title: string;
  description: string;
  category:
    | "SAFETY"
    | "ENVIRONMENTAL"
    | "OCCUPATIONAL_HEALTH"
    | "OPERATIONAL"
    | "COMPLIANCE"
    | "SECURITY"
    | "QUALITY"
    | "STRATEGIC"
    | "REPUTATIONAL"
    | "FINANCIAL"
    | "TECHNOLOGY"
    | "OTHER";
  hazardType?: string;
  process?: string;
  initialLikelihood: RiskLikelihood;
  initialImpact: RiskImpact;
  residualLikelihood: RiskLikelihood;
  residualImpact: RiskImpact;
  reviewFrequency: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "BIENNIAL" | "AD_HOC";
  nextReviewDate?: string;
};

export type RiskReviewPayload = {
  riskId: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  controlEffectiveness?:
    | "INEFFECTIVE"
    | "WEAK"
    | "PARTIALLY_EFFECTIVE"
    | "EFFECTIVE"
    | "HIGHLY_EFFECTIVE"
    | "NOT_ASSESSED";
  trend?: "IMPROVING" | "STABLE" | "DETERIORATING";
  notes?: string;
  nextReviewDate?: string;
};

export type JsaAcknowledgmentPayload = {
  jsaId: string;
  statement: string;
};

export type ComplianceOccurrenceCompletionPayload = {
  occurrenceId: string;
  completionNotes?: string;
  evidenceUrl?: string;
};

export type ComplianceOccurrenceReviewPayload = {
  occurrenceId: string;
  decision: "APPROVE" | "REJECT";
  reviewNotes?: string;
};

export type TrainingProgressPayload = {
  trainingRecordId: string;
  notes?: string;
};

export type TrainingCompletionPayload = {
  trainingRecordId: string;
  completedAt: string;
  certificateNumber?: string;
  score?: number;
  notes?: string;
};

export type MocStatusPayload = {
  mocId: string;
  status: MobileMocStatus;
  comments?: string;
};

export type MocApprovalDecisionPayload = {
  mocId: string;
  approvalId: string;
  status: "APPROVED" | "REJECTED";
  comments?: string;
};

export type MocTaskStatusPayload = {
  mocId: string;
  taskId: string;
  status: MobileMocTaskStatus;
  evidenceNote?: string;
};

export type PermitStatusPayload = {
  permitId: string;
  status: MobilePermitToWorkStatus;
  comments?: string;
  closeoutNotes?: string;
};

export type PermitControlPayload = {
  permitId: string;
  controlId: string;
  verified: boolean;
};

export type PermitGasTestPayload = {
  permitId: string;
  oxygenPercent?: number;
  lelPercent?: number;
  h2sPpm?: number;
  coPpm?: number;
  result: "PASS" | "FAIL";
  notes?: string;
};

export type AssetStatusPayload = {
  assetId: string;
  status: MobileAssetStatus;
  reason: string;
};

export type AssetInspectionPayload = {
  assetId: string;
  inspectedAt: string;
  result: "SATISFACTORY" | "DEFECT_FOUND" | "OUT_OF_SERVICE";
  conditionScore?: number;
  evidenceReference?: string;
  observations?: string;
  immediateAction?: string;
  customForms: CapturedForm[];
};

export type AssetDefectPayload = {
  assetId: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  ownerId?: string;
  dueDate?: string;
  immediateControls?: string;
};

export type AssetDefectStatusPayload = {
  defectId: string;
  status: MobileAssetDefectStatus;
  repairPlan?: string;
  verificationEvidence?: string;
};

export type AssetMaintenanceStatusPayload = {
  recordId: string;
  status: "IN_PROGRESS" | "CANCELLED";
  reason: string;
};

export type AssetMaintenanceCompletionPayload = {
  recordId: string;
  completedAt: string;
  workSummary: string;
  evidenceReference: string;
  downtimeHours?: number;
};

export type ContractorStatusPayload = {
  contractorId: string;
  status: MobileContractorStatus;
  reason?: string;
};

export type HygieneAssessmentStatusPayload = {
  assessmentId: string;
  status: MobileExposureAssessmentStatus;
  observations?: string;
  conclusions?: string;
  recommendations?: string;
};

export type HygieneSamplePayload = {
  assessmentId: string;
  agentId: string;
  sampleType: "PERSONAL" | "AREA" | "TASK" | "DIRECT_READING" | "WIPE";
  sampleReference?: string;
  sampledWorkerId?: string;
  location?: string;
  task?: string;
  sampledAt: string;
  durationMinutes?: number;
  resultValue?: number;
  reportingLimit?: number;
  occupationalLimit?: number;
  actionLevel?: number;
  unit?: string;
  laboratory?: string;
  analyticalMethod?: string;
  analyzedAt?: string;
  notes?: string;
};

export type HygieneFormsPayload = {
  assessmentId: string;
  customForms: CapturedForm[];
};

export type SurveillanceProgramStatusPayload = {
  programId: string;
  status: MobileSurveillanceProgramStatus;
};

export type SurveillanceEnrollmentPayload = {
  programId: string;
  enrolledUserId: string;
  nextDueAt: string;
  notes?: string;
};

export type SurveillanceCompletionPayload = {
  enrollmentId: string;
  completedAt: string;
  fitnessOutcome:
    | "CLEARED"
    | "CLEARED_WITH_RESTRICTIONS"
    | "TEMPORARILY_NOT_CLEARED";
  workRestrictions?: string;
  certificateReference?: string;
  notes?: string;
};

export type SurveillanceRemovalPayload = {
  enrollmentId: string;
  reason: string;
};

export type ChemicalInventoryPayload = {
  chemicalId: string;
  siteId: string;
  storageLocation: string;
  quantity: number;
  unit: string;
  maximumAllowed?: number;
  containerType?: string;
  storageNotes?: string;
};

export type ChemicalStatusPayload = {
  chemicalId: string;
  status: MobileChemicalApprovalStatus;
};

export type ChemicalFormsPayload = {
  chemicalId: string;
  customForms: CapturedForm[];
};

export type EnvironmentalDataPayload = {
  metricId: string;
  siteId: string;
  value: number;
  quality:
    | "MEASURED"
    | "CALCULATED"
    | "ESTIMATED"
    | "SUPPLIER_PROVIDED";
  periodStart: string;
  periodEnd: string;
  evidenceSummary?: string;
  notes?: string;
  customForms: CapturedForm[];
};

export type EnvironmentalReviewPayload = {
  dataPointId: string;
  status: "APPROVED" | "REJECTED";
};

export type EnvironmentalFormsPayload = {
  dataPointId: string;
  customForms: CapturedForm[];
};
