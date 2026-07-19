import {
  PrismaClient,
  UserRole,
  RiskLevel,
  Status,
  IncidentType,
  PermissionKey,
  WorkflowEntityType,
  WorkflowStepType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const password = await bcrypt.hash("Admin@12345", 10);

  const organization = await prisma.organization.upsert({
    where: { id: "org_senzilytics_demo" },
    update: {},
    create: {
      id: "org_senzilytics_demo",
      name: "Senzilytics Demo Organization",
      industry: "Aviation, Logistics & Industrial Safety",
      address: "100 Innovation Drive",
    },
  });

  const site = await prisma.site.upsert({
    where: { id: "site_main_operations" },
    update: {},
    create: {
      id: "site_main_operations",
      name: "Main Operations Site",
      address: "100 Innovation Drive",
      city: "Houston",
      state: "Texas",
      country: "United States",
      organizationId: organization.id,
    },
  });

  const department = await prisma.department.upsert({
    where: { id: "dept_ehs" },
    update: {},
    create: {
      id: "dept_ehs",
      name: "Environmental Health & Safety",
      siteId: site.id,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@senzilytics.com" },
    update: {
      password,
      role: UserRole.SUPER_ADMIN,
      organizationId: organization.id,
      departmentId: department.id,
    },
    create: {
      name: "Senzilytics Admin",
      email: "admin@senzilytics.com",
      password,
      role: UserRole.SUPER_ADMIN,
      jobTitle: "Platform Administrator",
      organizationId: organization.id,
      departmentId: department.id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@senzilytics.com" },
    update: {
      password,
      role: UserRole.EHS_MANAGER,
      organizationId: organization.id,
      departmentId: department.id,
    },
    create: {
      name: "EHS Manager",
      email: "manager@senzilytics.com",
      password,
      role: UserRole.EHS_MANAGER,
      jobTitle: "EHS Manager",
      organizationId: organization.id,
      departmentId: department.id,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@senzilytics.com" },
    update: {
      password,
      role: UserRole.SUPERVISOR,
      organizationId: organization.id,
      departmentId: department.id,
    },
    create: {
      name: "Operations Supervisor",
      email: "supervisor@senzilytics.com",
      password,
      role: UserRole.SUPERVISOR,
      jobTitle: "Operations Supervisor",
      organizationId: organization.id,
      departmentId: department.id,
    },
  });

  const rolePermissions: Record<UserRole, PermissionKey[]> = {
    SUPER_ADMIN: Object.values(PermissionKey),

    ORG_ADMIN: [
      PermissionKey.MANAGE_ORGANIZATION,
      PermissionKey.MANAGE_USERS,
      PermissionKey.VIEW_USERS,
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.VIEW_REPORTS,
      PermissionKey.CREATE_INCIDENT,
      PermissionKey.VIEW_INCIDENT,
      PermissionKey.UPDATE_INCIDENT,
      PermissionKey.DELETE_INCIDENT,
      PermissionKey.CREATE_CAPA,
      PermissionKey.UPDATE_CAPA,
      PermissionKey.CLOSE_CAPA,
      PermissionKey.VIEW_AUDITS,
      PermissionKey.MANAGE_AUDITS,
      PermissionKey.VIEW_INSPECTIONS,
      PermissionKey.MANAGE_INSPECTIONS,
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.MANAGE_COMPLIANCE,
      PermissionKey.VIEW_TRAINING,
      PermissionKey.MANAGE_TRAINING,
      PermissionKey.USE_AI,
      PermissionKey.MANAGE_WORKFLOWS,
      PermissionKey.VIEW_ACTIVITY_LOG,
      PermissionKey.MANAGE_NOTIFICATIONS,
      PermissionKey.MANAGE_DOCUMENTS,
      PermissionKey.CREATE_OBSERVATION,
      PermissionKey.VIEW_OBSERVATIONS,
      PermissionKey.MANAGE_OBSERVATIONS,
      PermissionKey.VIEW_CHEMICALS,
      PermissionKey.MANAGE_CHEMICALS,
    ],

    EHS_MANAGER: [
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.VIEW_REPORTS,
      PermissionKey.CREATE_INCIDENT,
      PermissionKey.VIEW_INCIDENT,
      PermissionKey.UPDATE_INCIDENT,
      PermissionKey.CREATE_CAPA,
      PermissionKey.UPDATE_CAPA,
      PermissionKey.CLOSE_CAPA,
      PermissionKey.VIEW_AUDITS,
      PermissionKey.MANAGE_AUDITS,
      PermissionKey.VIEW_INSPECTIONS,
      PermissionKey.MANAGE_INSPECTIONS,
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.VIEW_TRAINING,
      PermissionKey.USE_AI,
      PermissionKey.VIEW_ACTIVITY_LOG,
      PermissionKey.CREATE_OBSERVATION,
      PermissionKey.VIEW_OBSERVATIONS,
      PermissionKey.MANAGE_OBSERVATIONS,
      PermissionKey.VIEW_CHEMICALS,
      PermissionKey.MANAGE_CHEMICALS,
    ],

    SUPERVISOR: [
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.CREATE_INCIDENT,
      PermissionKey.VIEW_INCIDENT,
      PermissionKey.UPDATE_INCIDENT,
      PermissionKey.CREATE_CAPA,
      PermissionKey.UPDATE_CAPA,
      PermissionKey.VIEW_INSPECTIONS,
      PermissionKey.MANAGE_INSPECTIONS,
      PermissionKey.VIEW_TRAINING,
      PermissionKey.CREATE_OBSERVATION,
      PermissionKey.VIEW_OBSERVATIONS,
      PermissionKey.MANAGE_OBSERVATIONS,
      PermissionKey.VIEW_CHEMICALS,
    ],

    EMPLOYEE: [
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.CREATE_OBSERVATION,
      PermissionKey.VIEW_OBSERVATIONS,
      PermissionKey.VIEW_CHEMICALS,
      PermissionKey.CREATE_INCIDENT,
      PermissionKey.VIEW_INCIDENT,
      PermissionKey.VIEW_TRAINING,
    ],

    AUDITOR: [
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.VIEW_INCIDENT,
      PermissionKey.VIEW_AUDITS,
      PermissionKey.MANAGE_AUDITS,
      PermissionKey.VIEW_INSPECTIONS,
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.VIEW_REPORTS,
      PermissionKey.VIEW_OBSERVATIONS,
      PermissionKey.VIEW_CHEMICALS,
    ],
  };

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          role_permission: {
            role: role as UserRole,
            permission,
          },
        },
        update: {},
        create: {
          role: role as UserRole,
          permission,
        },
      });
    }
  }

  const incidentWorkflow = await prisma.workflowTemplate.upsert({
    where: {
      id: "workflow_incident_default",
    },
    update: {
      organizationId: organization.id,
      name: "Default Incident Workflow",
      description:
        "Standard incident review, investigation, CAPA, verification, and closure workflow.",
      entityType: WorkflowEntityType.INCIDENT,
      isActive: true,
    },
    create: {
      id: "workflow_incident_default",
      organizationId: organization.id,
      name: "Default Incident Workflow",
      description:
        "Standard incident review, investigation, CAPA, verification, and closure workflow.",
      entityType: WorkflowEntityType.INCIDENT,
      isActive: true,
    },
  });

  const workflowSteps = [
    {
      id: "workflow_step_incident_reported",
      name: "Incident Reported",
      description: "Incident has been submitted.",
      stepType: WorkflowStepType.START,
      sequence: 1,
      requiredRole: null,
      slaHours: 4,
    },
    {
      id: "workflow_step_supervisor_review",
      name: "Supervisor Review",
      description: "Supervisor reviews the initial report.",
      stepType: WorkflowStepType.REVIEW,
      sequence: 2,
      requiredRole: UserRole.SUPERVISOR,
      slaHours: 24,
    },
    {
      id: "workflow_step_investigation",
      name: "Investigation",
      description: "EHS investigates root cause and contributing factors.",
      stepType: WorkflowStepType.TASK,
      sequence: 3,
      requiredRole: UserRole.EHS_MANAGER,
      slaHours: 72,
    },
    {
      id: "workflow_step_capa",
      name: "Corrective Actions",
      description: "CAPA actions are assigned and tracked.",
      stepType: WorkflowStepType.TASK,
      sequence: 4,
      requiredRole: UserRole.EHS_MANAGER,
      slaHours: 120,
    },
    {
      id: "workflow_step_verification",
      name: "Verification",
      description: "Actions are verified for effectiveness.",
      stepType: WorkflowStepType.VERIFICATION,
      sequence: 5,
      requiredRole: UserRole.EHS_MANAGER,
      slaHours: 48,
    },
    {
      id: "workflow_step_closure",
      name: "Closure Approval",
      description: "Final review and closure approval.",
      stepType: WorkflowStepType.CLOSE,
      sequence: 6,
      requiredRole: UserRole.ORG_ADMIN,
      slaHours: 24,
    },
  ];

  for (const step of workflowSteps) {
    await prisma.workflowTemplateStep.upsert({
      where: {
        id: step.id,
      },
      update: {
        name: step.name,
        description: step.description,
        stepType: step.stepType,
        sequence: step.sequence,
        requiredRole: step.requiredRole,
        slaHours: step.slaHours,
      },
      create: {
        id: step.id,
        templateId: incidentWorkflow.id,
        name: step.name,
        description: step.description,
        stepType: step.stepType,
        sequence: step.sequence,
        requiredRole: step.requiredRole,
        slaHours: step.slaHours,
      },
    });
  }

  const incident = await prisma.incident.upsert({
    where: { id: "incident_demo_forklift_near_miss" },
    update: {},
    create: {
      id: "incident_demo_forklift_near_miss",
      title: "Forklift near miss at loading dock",
      description:
        "A forklift passed close to a pedestrian walkway during peak loading activity. No injury occurred.",
      type: IncidentType.NEAR_MISS,
      riskLevel: RiskLevel.HIGH,
      status: Status.IN_PROGRESS,
      location: "Loading Dock A",
      occurredAt: new Date(),
      siteId: site.id,
      reportedById: manager.id,
    },
  });

  await prisma.investigation.upsert({
    where: { incidentId: incident.id },
    update: {
      summary:
        "Initial review indicates pedestrian controls were not clearly marked during shift change.",
      rootCause: "Inadequate traffic separation",
      immediateCause: "Forklift entered pedestrian pathway",
      contributingFactors: "Congestion, poor floor markings, insufficient supervision",
    },
    create: {
      incidentId: incident.id,
      summary:
        "Initial review indicates pedestrian controls were not clearly marked during shift change.",
      rootCause: "Inadequate traffic separation",
      immediateCause: "Forklift entered pedestrian pathway",
      contributingFactors: "Congestion, poor floor markings, insufficient supervision",
    },
  });

  await prisma.correctiveAction.upsert({
    where: { id: "capa_demo_walkway_markings" },
    update: {},
    create: {
      id: "capa_demo_walkway_markings",
      title: "Repaint pedestrian walkway markings",
      description:
        "Refresh all pedestrian walkway markings and install additional warning signs.",
      status: Status.OPEN,
      riskLevel: RiskLevel.HIGH,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      incidentId: incident.id,
      assignedToId: manager.id,
    },
  });

  const audit = await prisma.audit.upsert({
    where: { id: "audit_demo_quarterly_safety" },
    update: {},
    create: {
      id: "audit_demo_quarterly_safety",
      title: "Quarterly Safety Compliance Audit",
      scope: "Review safety procedures, records, training, and corrective actions.",
      status: Status.OPEN,
      scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      siteId: site.id,
    },
  });

  await prisma.auditFinding.upsert({
    where: { id: "audit_finding_demo_missing_signoff" },
    update: {},
    create: {
      id: "audit_finding_demo_missing_signoff",
      title: "Incomplete monthly inspection records",
      description: "Two inspection logs were missing supervisor sign-off.",
      riskLevel: RiskLevel.MEDIUM,
      status: Status.OPEN,
      auditId: audit.id,
    },
  });

  const inspection = await prisma.inspection.upsert({
    where: { id: "inspection_demo_warehouse_safety" },
    update: {},
    create: {
      id: "inspection_demo_warehouse_safety",
      title: "Warehouse Safety Inspection",
      area: "Warehouse",
      status: Status.IN_PROGRESS,
      scheduledAt: new Date(),
      siteId: site.id,
    },
  });

  await prisma.inspectionFinding.upsert({
    where: { id: "inspection_finding_demo_blocked_exit" },
    update: {},
    create: {
      id: "inspection_finding_demo_blocked_exit",
      title: "Blocked emergency exit",
      description: "Boxes were found partially blocking an emergency exit route.",
      riskLevel: RiskLevel.CRITICAL,
      status: Status.OPEN,
      inspectionId: inspection.id,
    },
  });

  await prisma.complianceItem.upsert({
    where: { id: "compliance_demo_fire_extinguisher" },
    update: {},
    create: {
      id: "compliance_demo_fire_extinguisher",
      title: "Annual Fire Extinguisher Inspection",
      description: "Complete third-party inspection for all extinguishers.",
      status: Status.OPEN,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      siteId: site.id,
    },
  });

  await prisma.trainingRecord.upsert({
    where: { id: "training_demo_hazard_communication" },
    update: {},
    create: {
      id: "training_demo_hazard_communication",
      courseName: "Hazard Communication Training",
      status: Status.OPEN,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      userId: manager.id,
    },
  });

  console.log("Seed completed successfully.");
  console.log("Admin login: admin@senzilytics.com / Admin@12345");
  console.log("Manager login: manager@senzilytics.com / Admin@12345");
  console.log("Supervisor login: supervisor@senzilytics.com / Admin@12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
