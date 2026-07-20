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
