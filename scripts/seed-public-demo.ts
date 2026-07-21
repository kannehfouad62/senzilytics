import {
  IncidentType,
  InspectionType,
  RiskCategory,
  RiskImpact,
  RiskLevel,
  RiskLikelihood,
  RiskReviewFrequency,
  RiskStatus,
  SafetyObservationStatus,
  SafetyObservationType,
  Status,
  UserRole,
  AuditType,
  EnterpriseAuditFindingTrigger,
  EnterpriseAuditFrequency,
  EnterpriseAuditProgramStatus,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditQuestionResponseType,
  EnterpriseAuditRiskPriority,
  EnterpriseAuditSeverity,
  EnterpriseAuditSource,
  EnterpriseAuditTeamRole,
  ComplianceCalendarOccurrenceStatus,
  ComplianceCalendarTaskStatus,
  ComplianceRecurrence,
  ContractorStatus,
  ContractorWorkerStatus,
  PermitGasTestResult,
  PermitToWorkStatus,
  PermitToWorkType,
  ExposureAssessmentStatus,
  ExposureResultClassification,
  ExposureSampleType,
  HygieneAgentCategory,
  SurveillanceEnrollmentStatus,
  SurveillanceProgramStatus,
  CompetencyAssessmentStatus,
  CompetencyCategory,
  CompetencyEvidenceType,
  CompetencyProficiency,
  CriticalControlVerificationResult,
  SifExposureCategory,
  SifSignalClassification,
  SifSignalSourceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditService } from "@/modules/audit/audit.service";

const ids = {
  organization: "org_senzilytics_public_demo",
  site: "site_public_demo_operations",
  department: "dept_public_demo_ehs",
  manager: "user_public_demo_manager",
};

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: ids.organization },
    update: { isDemo: true, status: "ACTIVE" },
    create: {
      id: ids.organization,
      name: "Northstar Industrial Group — Demo",
      industry: "Manufacturing, logistics and field services",
      address: "Fictional demonstration organization",
      allowedEmailDomains: [],
      isDemo: true,
    },
  });

  const site = await prisma.site.upsert({
    where: { id: ids.site },
    update: {},
    create: {
      id: ids.site,
      name: "Gulf Operations Center",
      address: "1000 Demonstration Way",
      city: "Houston",
      state: "Texas",
      country: "United States",
      organizationId: organization.id,
    },
  });

  const department = await prisma.department.upsert({
    where: { id: ids.department },
    update: {},
    create: { id: ids.department, name: "Environment, Health & Safety", siteId: site.id },
  });

  const manager = await prisma.user.upsert({
    where: { email: "demo.manager@senzilytics.cloud" },
    update: { organizationId: organization.id, departmentId: department.id },
    create: {
      id: ids.manager,
      name: "Jordan Lee",
      email: "demo.manager@senzilytics.cloud",
      role: UserRole.EHS_MANAGER,
      jobTitle: "Director, EHS & Operational Risk",
      isActive: true,
      activatedAt: new Date(),
      organizationId: organization.id,
      departmentId: department.id,
    },
  });

  const now = new Date();
  const days = (count: number) => new Date(now.getTime() + count * 86_400_000);

  await prisma.incident.upsert({
    where: { id: "incident_public_demo_1" },
    update: {},
    create: {
      id: "incident_public_demo_1",
      title: "Forklift and pedestrian near miss",
      description: "A pedestrian entered a shared traffic lane while a forklift reversed from the receiving area.",
      type: IncidentType.NEAR_MISS,
      riskLevel: RiskLevel.HIGH,
      status: Status.IN_PROGRESS,
      location: "Warehouse receiving lane 2",
      occurredAt: days(-12),
      siteId: site.id,
      reportedById: manager.id,
      investigation: {
        create: {
          summary: "Traffic separation and line-of-sight controls are under review.",
          immediateCause: "Pedestrian entered an active vehicle lane.",
          contributingFactors: "Worn floor markings and obstructed mirror.",
          assignedToId: manager.id,
          dueDate: days(5),
        },
      },
      actions: {
        create: [
          { title: "Restore traffic-lane markings", description: "Repaint pedestrian exclusion zones and crossing points.", riskLevel: RiskLevel.HIGH, status: Status.IN_PROGRESS, dueDate: days(4), assignedToId: manager.id },
          { title: "Install convex visibility mirror", description: "Install and verify a mirror at the receiving blind corner.", riskLevel: RiskLevel.MEDIUM, status: Status.OPEN, dueDate: days(9), assignedToId: manager.id },
        ],
      },
    },
  });

  await prisma.safetyObservation.upsert({
    where: { organizationId_reference: { organizationId: organization.id, reference: "OBS-DEMO-001" } },
    update: {},
    create: {
      reference: "OBS-DEMO-001",
      title: "Positive pre-use equipment inspection",
      description: "The warehouse team stopped work and isolated damaged lifting equipment before use.",
      type: SafetyObservationType.POSITIVE_PRACTICE,
      status: SafetyObservationStatus.CLOSED,
      riskLevel: RiskLevel.LOW,
      location: "Warehouse staging area",
      observedAt: days(-7),
      immediateAction: "Equipment tagged out and supervisor notified.",
      organizationId: organization.id,
      siteId: site.id,
      departmentId: department.id,
      reportedById: manager.id,
      assignedToId: manager.id,
      resolvedAt: days(-7),
    },
  });

  await prisma.risk.upsert({
    where: { organizationId_reference: { organizationId: organization.id, reference: "RISK-DEMO-001" } },
    update: {},
    create: {
      reference: "RISK-DEMO-001",
      title: "Mobile equipment and pedestrian interaction",
      description: "Potential for serious injury where powered industrial trucks and pedestrians share routes.",
      category: RiskCategory.SAFETY,
      hazardType: "Mobile equipment",
      process: "Warehouse receiving and dispatch",
      status: RiskStatus.TREATMENT_REQUIRED,
      organizationId: organization.id,
      siteId: site.id,
      departmentId: department.id,
      ownerId: manager.id,
      initialLikelihood: RiskLikelihood.LIKELY,
      initialImpact: RiskImpact.MAJOR,
      initialScore: 16,
      initialRiskLevel: RiskLevel.CRITICAL,
      currentLikelihood: RiskLikelihood.POSSIBLE,
      currentImpact: RiskImpact.MAJOR,
      currentScore: 12,
      currentRiskLevel: RiskLevel.HIGH,
      residualLikelihood: RiskLikelihood.UNLIKELY,
      residualImpact: RiskImpact.MAJOR,
      residualScore: 8,
      residualRiskLevel: RiskLevel.MEDIUM,
      reviewFrequency: RiskReviewFrequency.QUARTERLY,
      nextReviewDate: days(45),
    },
  });

  const course = await prisma.trainingCourse.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PIT-101" } },
    update: {},
    create: {
      organizationId: organization.id,
      code: "PIT-101",
      name: "Powered Industrial Truck Awareness",
      description: "Demo course for vehicle–pedestrian risk controls.",
      provider: "Northstar Learning",
      validityMonths: 12,
      createdById: manager.id,
    },
  });

  await prisma.trainingRecord.upsert({
    where: { generationKey: "public-demo-training-1" },
    update: {},
    create: {
      generationKey: "public-demo-training-1",
      courseName: course.name,
      status: Status.OPEN,
      dueDate: days(14),
      userId: manager.id,
      courseId: course.id,
      assignedById: manager.id,
      provider: course.provider,
    },
  });

  const pitCompetency = await prisma.competencyDefinition.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "COMP-PIT" } },
    update: {},
    create: {
      id: "competency_public_demo_pit",
      organizationId: organization.id,
      code: "COMP-PIT",
      name: "Powered industrial truck risk awareness",
      description: "Recognize and apply vehicle–pedestrian separation, visibility and pre-use inspection controls.",
      category: CompetencyCategory.SAFETY,
      validityMonths: 12,
      isCritical: true,
      createdById: manager.id,
    },
  });
  await prisma.competencyCourseLink.upsert({
    where: { competencyId_courseId: { competencyId: pitCompetency.id, courseId: course.id } },
    update: { achievedLevel: CompetencyProficiency.WORKING, minimumScore: 80, isPrimary: true },
    create: { competencyId: pitCompetency.id, courseId: course.id, achievedLevel: CompetencyProficiency.WORKING, minimumScore: 80, isPrimary: true },
  });
  await prisma.competencyRequirement.upsert({
    where: { id: "competency_requirement_public_demo_pit" },
    update: { competencyId: pitCompetency.id, role: UserRole.EHS_MANAGER, siteId: site.id, departmentId: department.id, isActive: true },
    create: {
      id: "competency_requirement_public_demo_pit",
      organizationId: organization.id,
      competencyId: pitCompetency.id,
      role: UserRole.EHS_MANAGER,
      siteId: site.id,
      departmentId: department.id,
      requiredLevel: CompetencyProficiency.WORKING,
      dueWithinDays: 30,
      isMandatory: true,
    },
  });

  const leadershipCompetency = await prisma.competencyDefinition.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "COMP-EHS-LEAD" } },
    update: {},
    create: {
      id: "competency_public_demo_ehs_leadership",
      organizationId: organization.id,
      code: "COMP-EHS-LEAD",
      name: "EHS assurance leadership",
      description: "Lead risk-based assurance, evaluate evidence and drive corrective-action accountability.",
      category: CompetencyCategory.LEADERSHIP,
      validityMonths: 24,
      isCritical: true,
      createdById: manager.id,
    },
  });
  await prisma.competencyRequirement.upsert({
    where: { id: "competency_requirement_public_demo_leadership" },
    update: { competencyId: leadershipCompetency.id, role: UserRole.EHS_MANAGER, isActive: true },
    create: {
      id: "competency_requirement_public_demo_leadership",
      organizationId: organization.id,
      competencyId: leadershipCompetency.id,
      role: UserRole.EHS_MANAGER,
      requiredLevel: CompetencyProficiency.PRACTITIONER,
      dueWithinDays: 30,
      isMandatory: true,
    },
  });
  await prisma.competencyAssessment.upsert({
    where: { id: "competency_assessment_public_demo_leadership" },
    update: { status: CompetencyAssessmentStatus.VERIFIED, expiresAt: days(120), verifiedById: manager.id, verifiedAt: days(-30) },
    create: {
      id: "competency_assessment_public_demo_leadership",
      organizationId: organization.id,
      competencyId: leadershipCompetency.id,
      userId: manager.id,
      assessorId: manager.id,
      status: CompetencyAssessmentStatus.VERIFIED,
      assessedLevel: CompetencyProficiency.ADVANCED,
      assessedAt: days(-30),
      expiresAt: days(120),
      evidenceType: CompetencyEvidenceType.EXPERIENCE,
      evidenceReference: "DEMO-EHS-LEADERSHIP-PORTFOLIO",
      notes: "Fictional verified evidence included to demonstrate the workforce competency matrix.",
      verifiedById: manager.id,
      verifiedAt: days(-30),
    },
  });

  await prisma.inspection.upsert({
    where: { id: "inspection_public_demo_1" },
    update: {},
    create: {
      id: "inspection_public_demo_1",
      title: "Monthly Warehouse Safety Inspection",
      reference: "INS-DEMO-001",
      description: "Demonstration inspection covering traffic management and housekeeping.",
      area: "Warehouse and receiving",
      type: InspectionType.ROUTINE,
      status: Status.IN_PROGRESS,
      scheduledAt: days(-2),
      dueDate: days(3),
      startedAt: days(-1),
      siteId: site.id,
      leadInspectorId: manager.id,
    },
  });

  const protocol = await prisma.auditProtocol.upsert({
    where: {
      organizationId_name_version: {
        organizationId: organization.id,
        name: "ISO 45001 Internal Audit Protocol",
        version: 1,
      },
    },
    update: { status: EnterpriseAuditProtocolStatus.ACTIVE, isActive: true },
    create: {
      id: "protocol_public_demo_iso45001",
      organizationId: organization.id,
      name: "ISO 45001 Internal Audit Protocol",
      code: "ISO45K-DEMO",
      description: "Fictional protocol demonstrating leadership, operational control and improvement criteria.",
      standardName: "ISO 45001",
      standardVersion: "2018",
      framework: "Occupational health and safety management system",
      version: 1,
      status: EnterpriseAuditProtocolStatus.ACTIVE,
      isActive: true,
      effectiveFrom: days(-120),
      createdById: manager.id,
      updatedById: manager.id,
      sections: {
        create: [
          {
            title: "Leadership and worker participation",
            description: "Evaluate leadership accountability and workforce consultation.",
            standardRef: "Clauses 5.1–5.4",
            sequence: 1,
            weight: 2,
            questions: {
              create: [
                {
                  questionText: "Is OH&S accountability assigned and demonstrated by top management?",
                  guidance: "Review responsibilities, leadership meeting records and evidence of decisions.",
                  standardClause: "5.1",
                  responseType: EnterpriseAuditQuestionResponseType.YES_NO,
                  sequence: 1,
                  weight: 2,
                  requireComment: true,
                  requireEvidence: true,
                  findingTrigger: EnterpriseAuditFindingTrigger.ON_NO,
                  defaultSeverity: EnterpriseAuditSeverity.HIGH,
                  automaticallyCreateFinding: true,
                  automaticallySuggestCapa: true,
                },
                {
                  questionText: "Are workers consulted on hazards, controls and operational changes?",
                  guidance: "Sample committee records, pre-task planning and change consultations.",
                  standardClause: "5.4",
                  responseType: EnterpriseAuditQuestionResponseType.PASS_FAIL,
                  sequence: 2,
                  weight: 2,
                  requireEvidence: true,
                  findingTrigger: EnterpriseAuditFindingTrigger.ON_FAIL,
                  defaultSeverity: EnterpriseAuditSeverity.MEDIUM,
                  automaticallyCreateFinding: true,
                },
              ],
            },
          },
          {
            title: "Operational planning and control",
            description: "Evaluate whether operational hazards are controlled in practice.",
            standardRef: "Clause 8",
            sequence: 2,
            weight: 3,
            questions: {
              create: [
                {
                  questionText: "Are vehicle and pedestrian controls implemented and verified?",
                  guidance: "Inspect route separation, crossings, visibility aids and local compliance.",
                  standardClause: "8.1",
                  responseType: EnterpriseAuditQuestionResponseType.PASS_FAIL,
                  sequence: 1,
                  weight: 3,
                  requireComment: true,
                  requireEvidence: true,
                  requirePhoto: true,
                  findingTrigger: EnterpriseAuditFindingTrigger.ON_FAIL,
                  defaultSeverity: EnterpriseAuditSeverity.HIGH,
                  automaticallyCreateFinding: true,
                  automaticallySuggestCapa: true,
                  automaticallySuggestRisk: true,
                },
              ],
            },
          },
        ],
      },
    },
  });

  const program = await prisma.auditProgram.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Annual Corporate EHS Audit Program",
      },
    },
    update: { status: EnterpriseAuditProgramStatus.ACTIVE, defaultProtocolId: protocol.id },
    create: {
      id: "program_public_demo_ehs",
      organizationId: organization.id,
      name: "Annual Corporate EHS Audit Program",
      code: "EHS-DEMO-2026",
      description: "Risk-based demonstration program for operational EHS assurance.",
      standardName: "ISO 45001",
      standardVersion: "2018",
      objectives: "Verify control implementation, leadership accountability and corrective-action effectiveness.",
      scope: "Gulf Operations Center warehouse and receiving activities.",
      status: EnterpriseAuditProgramStatus.ACTIVE,
      frequency: EnterpriseAuditFrequency.ANNUAL,
      riskPriority: EnterpriseAuditRiskPriority.HIGH,
      effectiveFrom: days(-180),
      effectiveTo: days(185),
      ownerId: manager.id,
      defaultProtocolId: protocol.id,
      sites: { create: { siteId: site.id, isPrimary: true } },
      departments: { create: { departmentId: department.id, isPrimary: true } },
    },
  });

  const calendarTask = await prisma.complianceCalendarTask.upsert({
    where: { id: "calendar_task_public_demo_monthly" },
    update: { status: ComplianceCalendarTaskStatus.ACTIVE, ownerId: manager.id },
    create: {
      id: "calendar_task_public_demo_monthly", organizationId: organization.id, siteId: site.id, departmentId: department.id, ownerId: manager.id,
      title: "Monthly emergency equipment inspection", description: "Verify emergency showers, eyewash stations, spill kits and first-aid supplies.", instructions: "Complete the controlled inspection and attach the signed checklist or evidence reference.", category: "SAFETY", regulatoryReference: "Northstar EHS Standard 4.2", evidenceRequired: true, approvalRequired: true, recurrence: ComplianceRecurrence.MONTHLY, intervalValue: 1, startDate: days(-20), nextOccurrenceAt: days(10), reminderDaysBefore: 7, escalationDaysAfter: 2, status: ComplianceCalendarTaskStatus.ACTIVE,
    },
  });
  await prisma.complianceCalendarOccurrence.upsert({
    where: { taskId_dueAt: { taskId: calendarTask.id, dueAt: days(10) } }, update: {},
    create: { organizationId: organization.id, taskId: calendarTask.id, siteId: site.id, departmentId: department.id, assignedToId: manager.id, dueAt: days(10), status: ComplianceCalendarOccurrenceStatus.UPCOMING },
  });

  const contractor = await prisma.contractor.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Apex Industrial Services",
      },
    },
    update: {},
    create: {
      id: "contractor_public_demo_apex",
      organizationId: organization.id,
      name: "Apex Industrial Services",
      legalName: "Apex Industrial Services LLC",
      registrationNumber: "DEMO-TX-88421",
      primaryContactName: "Morgan Davis",
      primaryContactEmail: "morgan.davis@example.com",
      services: "Mechanical maintenance, welding, lifting support and equipment installation.",
      safetyProgramSummary: "Prequalified contractor with task planning, energy-isolation and competency controls.",
      insuranceProvider: "Demonstration Commercial Insurance",
      insurancePolicyNumber: "DEMO-GL-24051",
      insuranceExpiresAt: days(90),
      status: ContractorStatus.APPROVED,
      safetyRating: 92,
      approvedById: manager.id,
      approvedAt: days(-30),
      sites: { create: { siteId: site.id, expiresAt: days(90), notes: "Authorized for supervised maintenance work." } },
    },
  });
  const contractorWorker = await prisma.contractorWorker.upsert({
    where: { contractorId_employeeNumber: { contractorId: contractor.id, employeeNumber: "APX-1042" } },
    update: {},
    create: {
      id: "contractor_worker_public_demo_1",
      contractorId: contractor.id,
      firstName: "Taylor",
      lastName: "Morgan",
      employeeNumber: "APX-1042",
      jobTitle: "Certified Welder",
      status: ContractorWorkerStatus.ACTIVE,
      inductionCompletedAt: days(-20),
      inductionExpiresAt: days(160),
      medicalExpiresAt: days(160),
      competencySummary: "Hot-work, fire-watch and lockout/tagout qualified.",
    },
  });
  await prisma.permitToWork.upsert({
    where: { organizationId_reference: { organizationId: organization.id, reference: "PTW-DEMO-001" } },
    update: {},
    create: {
      id: "permit_to_work_public_demo_1",
      organizationId: organization.id,
      reference: "PTW-DEMO-001",
      title: "Weld support bracket in maintenance bay",
      description: "Demonstration active hot-work permit with verified controls and atmospheric test.",
      type: PermitToWorkType.HOT_WORK,
      status: PermitToWorkStatus.ACTIVE,
      siteId: site.id,
      departmentId: department.id,
      contractorId: contractor.id,
      requestedById: manager.id,
      approvedById: manager.id,
      issuedById: manager.id,
      responsiblePerson: "Jordan Lee",
      exactLocation: "Maintenance bay 3",
      workOrderReference: "WO-DEMO-4821",
      plannedStartAt: days(-1),
      plannedEndAt: days(1),
      hazardsSummary: "Hot metal, ignition sources, fumes and nearby combustible materials.",
      controlsSummary: "Area clearance, fire watch, extinguisher, ventilation and post-work monitoring.",
      requiredPpe: "Welding hood, flame-resistant clothing, gloves, safety footwear and respiratory protection as assessed.",
      emergencyPlan: "Stop work, raise alarm and follow the site emergency response plan.",
      gasTestingRequired: true,
      approvedAt: days(-1),
      activatedAt: days(-1),
      controls: { create: [
        { description: "Combustibles removed or protected", isVerified: true, verifiedById: manager.id, verifiedAt: days(-1) },
        { description: "Fire watch and extinguisher in place", isVerified: true, verifiedById: manager.id, verifiedAt: days(-1) },
        { description: "Ventilation confirmed", isVerified: true, verifiedById: manager.id, verifiedAt: days(-1) },
      ] },
      gasTests: { create: { performedById: manager.id, testedAt: days(-1), oxygenPercent: 20.9, lelPercent: 0, h2sPpm: 0, coPpm: 0, result: PermitGasTestResult.PASS, notes: "Acceptable pre-work atmosphere." } },
      workers: { create: { workerId: contractorWorker.id, role: "Welder" } },
      history: { create: [
        { actorId: manager.id, toStatus: PermitToWorkStatus.DRAFT, comments: "Permit drafted" },
        { actorId: manager.id, fromStatus: PermitToWorkStatus.DRAFT, toStatus: PermitToWorkStatus.PENDING_APPROVAL, comments: "Submitted for approval" },
        { actorId: manager.id, fromStatus: PermitToWorkStatus.PENDING_APPROVAL, toStatus: PermitToWorkStatus.APPROVED, comments: "Controls reviewed" },
        { actorId: manager.id, fromStatus: PermitToWorkStatus.APPROVED, toStatus: PermitToWorkStatus.ACTIVE, comments: "Work authorized" },
      ] },
    },
  });

  const mobileControl = await prisma.criticalControlStandard.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "CC-MOBILE-01" } },
    update: { ownerId: manager.id, nextVerificationDueAt: days(15), isActive: true },
    create: {
      id: "critical_control_public_demo_mobile",
      organizationId: organization.id,
      code: "CC-MOBILE-01",
      name: "Physical separation of vehicles and pedestrians",
      category: SifExposureCategory.MOBILE_EQUIPMENT,
      description: "Prevent pedestrian exposure to powered industrial trucks in shared operational areas.",
      performanceStandard: "Pedestrian routes, crossings and exclusion zones remain physically separated, visible and unobstructed during operations.",
      verificationPrompt: "Observe active traffic movements and confirm barriers, markings, crossings, mirrors and exclusion controls are present and being followed.",
      verificationFrequencyDays: 30,
      siteId: site.id,
      departmentId: department.id,
      ownerId: manager.id,
      createdById: manager.id,
      nextVerificationDueAt: days(15),
    },
  });
  await prisma.criticalControlVerification.upsert({
    where: { id: "critical_control_verification_public_demo_mobile" },
    update: { result: CriticalControlVerificationResult.DEGRADED, verifiedAt: days(-15), nextDueAt: days(15) },
    create: {
      id: "critical_control_verification_public_demo_mobile",
      organizationId: organization.id,
      controlId: mobileControl.id,
      verifiedById: manager.id,
      verifiedAt: days(-15),
      nextDueAt: days(15),
      result: CriticalControlVerificationResult.DEGRADED,
      evidenceReference: "DEMO-TRAFFIC-WALKDOWN-001",
      findings: "Floor markings are worn near receiving lane 2 and the convex mirror has a visibility obstruction.",
      immediateAction: "Temporary cones installed and supervisors briefed pending permanent restoration.",
    },
  });
  const hotWorkControl = await prisma.criticalControlStandard.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "CC-FIRE-01" } },
    update: { ownerId: manager.id, nextVerificationDueAt: days(20), isActive: true },
    create: {
      id: "critical_control_public_demo_hot_work",
      organizationId: organization.id,
      code: "CC-FIRE-01",
      name: "Hot-work ignition prevention",
      category: SifExposureCategory.FIRE_EXPLOSION,
      description: "Prevent ignition and uncontrolled fire during welding, cutting and grinding.",
      performanceStandard: "Combustibles are removed or protected, fire watch is assigned, atmosphere is acceptable where required, and post-work monitoring is completed.",
      verificationPrompt: "Verify the permit, work area, fire watch, extinguisher, gas-test evidence and post-work monitoring controls in the field.",
      verificationFrequencyDays: 30,
      siteId: site.id,
      departmentId: department.id,
      ownerId: manager.id,
      createdById: manager.id,
      nextVerificationDueAt: days(20),
    },
  });
  await prisma.criticalControlVerification.upsert({
    where: { id: "critical_control_verification_public_demo_hot_work" },
    update: { result: CriticalControlVerificationResult.EFFECTIVE, verifiedAt: days(-10), nextDueAt: days(20) },
    create: {
      id: "critical_control_verification_public_demo_hot_work",
      organizationId: organization.id,
      controlId: hotWorkControl.id,
      verifiedById: manager.id,
      verifiedAt: days(-10),
      nextDueAt: days(20),
      result: CriticalControlVerificationResult.EFFECTIVE,
      evidenceReference: "PTW-DEMO-001 / field verification",
      findings: "Required controls were observed in place and functioning during the demonstration verification.",
    },
  });
  await prisma.sifSignalReview.upsert({
    where: { organizationId_sourceType_sourceId: { organizationId: organization.id, sourceType: SifSignalSourceType.INCIDENT, sourceId: "incident_public_demo_1" } },
    update: { classification: SifSignalClassification.POTENTIAL_SIF, exposureCategory: SifExposureCategory.MOBILE_EQUIPMENT, potentialSeverity: RiskLevel.CRITICAL, reviewedById: manager.id, reviewedAt: days(-5) },
    create: {
      id: "sif_signal_review_public_demo_incident",
      organizationId: organization.id,
      sourceType: SifSignalSourceType.INCIDENT,
      sourceId: "incident_public_demo_1",
      classification: SifSignalClassification.POTENTIAL_SIF,
      exposureCategory: SifExposureCategory.MOBILE_EQUIPMENT,
      potentialSeverity: RiskLevel.CRITICAL,
      rationale: "The near miss involved pedestrian exposure to moving powered equipment with credible major or fatal potential.",
      controlFailureNotes: "Traffic separation markings and sight-line controls were degraded.",
      reviewedById: manager.id,
      reviewedAt: days(-5),
    },
  });

  const noiseAgent = await prisma.hygieneAgent.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Occupational noise" } },
    update: {},
    create: {
      id: "hygiene_agent_public_demo_noise",
      organizationId: organization.id,
      name: "Occupational noise",
      category: HygieneAgentCategory.NOISE,
      description: "Fictional demonstration agent for full-shift noise exposure assessment.",
      healthEffects: "Potential occupational hearing impact if exposure is not controlled.",
      exposureRoutes: "Auditory exposure",
      occupationalLimit: 85,
      actionLevel: 82,
      unit: "dBA",
      limitSource: "Northstar demonstration exposure standard",
      samplingMethod: "Personal full-shift dosimetry",
      requiresSurveillance: true,
    },
  });
  const exposureGroup = await prisma.similarExposureGroup.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Maintenance technicians — fabrication bay" } },
    update: {},
    create: {
      id: "exposure_group_public_demo_maintenance",
      organizationId: organization.id,
      siteId: site.id,
      departmentId: department.id,
      name: "Maintenance technicians — fabrication bay",
      code: "SEG-DEMO-001",
      description: "Fictional Similar Exposure Group used to demonstrate exposure governance.",
      jobRoles: "Maintenance technician, welder and fabrication mechanic",
      tasks: "Grinding, welding, cutting and equipment repair",
      locations: "Maintenance and fabrication bay",
      exposedHeadcount: 14,
      existingControls: "Local exhaust ventilation, equipment maintenance and scheduled noise surveys.",
      requiredPpe: "Task-specific hearing protection and welding PPE.",
      ownerId: manager.id,
      reviewDueDate: days(60),
      agents: { create: { agentId: noiseAgent.id } },
    },
  });
  const assessment = await prisma.exposureAssessment.upsert({
    where: { organizationId_reference: { organizationId: organization.id, reference: "IH-DEMO-001" } },
    update: {},
    create: {
      id: "exposure_assessment_public_demo_1",
      organizationId: organization.id,
      reference: "IH-DEMO-001",
      title: "Fabrication bay noise exposure assessment",
      description: "Fictional full-shift dosimetry assessment demonstrating exposure classification.",
      status: ExposureAssessmentStatus.UNDER_REVIEW,
      groupId: exposureGroup.id,
      siteId: site.id,
      departmentId: department.id,
      assessorId: manager.id,
      scheduledAt: days(-8),
      dueDate: days(5),
      startedAt: days(-8),
      scope: "Maintenance technicians performing representative fabrication tasks.",
      samplingPlan: "Collect personal full-shift dosimetry during grinding, cutting and welding work.",
      observations: "High tool-noise periods were observed during intermittent grinding.",
    },
  });
  await prisma.exposureSample.upsert({
    where: { assessmentId_sampleReference: { assessmentId: assessment.id, sampleReference: "IH-SAMPLE-DEMO-001" } },
    update: {},
    create: {
      id: "exposure_sample_public_demo_1",
      assessmentId: assessment.id,
      agentId: noiseAgent.id,
      sampleType: ExposureSampleType.PERSONAL,
      sampleReference: "IH-SAMPLE-DEMO-001",
      sampledWorkerId: manager.id,
      location: "Maintenance and fabrication bay",
      task: "Grinding and welding",
      sampledAt: days(-6),
      durationMinutes: 465,
      resultValue: 88,
      occupationalLimit: 85,
      actionLevel: 82,
      unit: "dBA",
      exposureRatio: 1.035,
      classification: ExposureResultClassification.ABOVE_LIMIT,
      analyticalMethod: "Personal noise dosimetry",
      analyzedAt: days(-5),
      notes: "Fictional demonstration result only.",
      createdById: manager.id,
    },
  });
  const surveillanceProgram = await prisma.medicalSurveillanceProgram.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Hearing conservation surveillance" } },
    update: {},
    create: {
      id: "surveillance_program_public_demo_hearing",
      organizationId: organization.id,
      name: "Hearing conservation surveillance",
      description: "Administrative demonstration program; no diagnoses or clinical test results are stored.",
      status: SurveillanceProgramStatus.ACTIVE,
      regulatoryBasis: "Northstar demonstration hearing conservation standard",
      protocolReference: "OH-DEMO-HCP-01",
      providerName: "Fictional Occupational Health Provider",
      frequencyMonths: 12,
      leadDays: 30,
      agentId: noiseAgent.id,
      groupId: exposureGroup.id,
      responsibleUserId: manager.id,
    },
  });
  await prisma.medicalSurveillanceEnrollment.upsert({
    where: { programId_userId: { programId: surveillanceProgram.id, userId: manager.id } },
    update: {},
    create: {
      id: "surveillance_enrollment_public_demo_1",
      programId: surveillanceProgram.id,
      userId: manager.id,
      status: SurveillanceEnrollmentStatus.DUE,
      nextDueAt: days(14),
      notes: "Fictional administrative demonstration record; no clinical information.",
    },
  });

  const existingAudit = await prisma.enterpriseAudit.findFirst({
    where: { organizationId: organization.id, reference: "AUD-DEMO-001" },
    select: { id: true },
  });
  if (!existingAudit) {
    await createAuditService({
      organizationId: organization.id,
      userId: manager.id,
      reference: "AUD-DEMO-001",
      title: "Warehouse Operational Control Audit",
      description: "Fictional scheduled audit demonstrating protocol execution and evidence requirements.",
      objectives: "Assess vehicle–pedestrian controls and worker participation.",
      scope: "Warehouse receiving, staging and dispatch areas.",
      criteria: "ISO 45001:2018 and Northstar traffic-management requirements.",
      auditType: AuditType.INTERNAL,
      siteId: site.id,
      departmentId: department.id,
      programId: program.id,
      protocolId: protocol.id,
      leadAuditorId: manager.id,
      ownerId: manager.id,
      scheduledAt: days(-1),
      dueDate: days(10),
      source: EnterpriseAuditSource.PROGRAM,
      teamMembers: [{ userId: manager.id, role: EnterpriseAuditTeamRole.LEAD_AUDITOR, canEdit: true, canReview: true }],
    });
  }

  console.log("Public demo tenant and sample data are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
