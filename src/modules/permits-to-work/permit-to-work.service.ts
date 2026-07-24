import { randomUUID } from "node:crypto";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import { createPreparedSubmissions, type PreparedSubmission } from "@/modules/forms/runtime-form.service";
import { isPermitToWorkTransitionAllowed } from "@/modules/permits-to-work/permit-to-work-lifecycle";
import { ActivityAction, ConfigurableFormModule, ConfigurableFormVersionStatus, ConfigurableSubmissionStatus, ContractorStatus, ContractorWorkerStatus, NotificationType, PermitGasTestResult, PermitToWorkStatus, PermitToWorkType } from "@prisma/client";

export async function createPermitToWorkService(input: {
  organizationId: string; userId: string; title: string; description?: string | null; type: PermitToWorkType;
  siteId: string; departmentId?: string | null; contractorId?: string | null; responsiblePerson: string; exactLocation: string;
  workOrderReference?: string | null; plannedStartAt: Date; plannedEndAt: Date; hazardsSummary: string; controlsSummary: string;
  requiredPpe?: string | null; isolationDetails?: string | null; emergencyPlan?: string | null; gasTestingRequired: boolean;
  controls: string[]; workerIds: string[]; customSubmissions?: PreparedSubmission[];
}) {
  if (input.plannedEndAt <= input.plannedStartAt) throw new Error("The planned end must be after the planned start.");
  if (input.plannedEndAt <= new Date()) throw new Error("The permit end date must be in the future.");
  const controls = [...new Set(input.controls.map(value => value.trim()).filter(Boolean))];
  if (!controls.length) throw new Error("Add at least one work control before creating the permit.");
  const workerIds = [...new Set(input.workerIds)];
  const [requestor, site, department, contractor, workers] = await Promise.all([
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId } }),
    prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }),
    input.departmentId ? prisma.department.findFirst({ where: { id: input.departmentId, siteId: input.siteId, site: { organizationId: input.organizationId } } }) : null,
    input.contractorId ? prisma.contractor.findFirst({ where: { id: input.contractorId, organizationId: input.organizationId }, include: { sites: { where: { siteId: input.siteId } } } }) : null,
    prisma.contractorWorker.findMany({ where: { id: { in: workerIds }, contractor: { organizationId: input.organizationId, ...(input.contractorId ? { id: input.contractorId } : {}) } } }),
  ]);
  if (!requestor || !site) throw new Error("Select a valid tenant requestor and site.");
  if (input.departmentId && !department) throw new Error("The selected department does not belong to the permit site.");
  if (input.contractorId) {
    if (!contractor || contractor.status !== ContractorStatus.APPROVED) throw new Error("Select an approved contractor.");
    const authorization = contractor.sites[0];
    if (!authorization || (authorization.expiresAt && authorization.expiresAt <= input.plannedEndAt)) throw new Error("The contractor is not authorized for this site through the permit end date.");
    if (!contractor.insuranceExpiresAt || contractor.insuranceExpiresAt <= input.plannedEndAt) throw new Error("Contractor insurance must remain valid through the permit end date.");
  }
  if (workers.length !== workerIds.length) throw new Error("One or more selected workers do not belong to the selected contractor.");
  const reference = `PTW-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  return prisma.$transaction(async tx => {
    const permit = await tx.permitToWork.create({ data: {
      organizationId: input.organizationId, reference, title: input.title, description: input.description, type: input.type,
      siteId: input.siteId, departmentId: input.departmentId, contractorId: input.contractorId, requestedById: input.userId,
      responsiblePerson: input.responsiblePerson, exactLocation: input.exactLocation, workOrderReference: input.workOrderReference,
      plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt, hazardsSummary: input.hazardsSummary,
      controlsSummary: input.controlsSummary, requiredPpe: input.requiredPpe, isolationDetails: input.isolationDetails,
      emergencyPlan: input.emergencyPlan, gasTestingRequired: input.gasTestingRequired,
      controls: { create: controls.map(description => ({ description })) },
      workers: { create: workers.map(worker => ({ workerId: worker.id, role: worker.jobTitle })) },
      history: { create: { actorId: input.userId, toStatus: PermitToWorkStatus.DRAFT, comments: "Permit drafted" } },
    } });
    await createPreparedSubmissions(tx, { organizationId: input.organizationId, userId: input.userId, module: ConfigurableFormModule.PERMIT_TO_WORK, entityId: permit.id, submissions: input.customSubmissions ?? [] });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "PermitToWork", entityId: permit.id, title: "Permit to work created", description: `${reference} — ${permit.title}`, metadata: { type: permit.type, siteId: permit.siteId, contractorId: permit.contractorId } } });
    return permit;
  });
}

export async function transitionPermitToWorkService(input: {
  organizationId: string;
  userId: string;
  permitId: string;
  status: PermitToWorkStatus;
  comments?: string | null;
  closeoutNotes?: string | null;
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const permit = await prisma.permitToWork.findFirst({ where: { id: input.permitId, organizationId: input.organizationId }, include: { controls: true, gasTests: { orderBy: { testedAt: "desc" }, take: 1 }, contractor: { include: { sites: true } }, workers: { include: { worker: true } } } });
  if (!permit) throw new Error("Permit to work not found in this organization.");
  if (!isPermitToWorkTransitionAllowed(permit.status, input.status)) throw new Error(`A ${permit.status.replaceAll("_", " ")} permit cannot move to ${input.status.replaceAll("_", " ")}.`);
  if (([PermitToWorkStatus.REJECTED, PermitToWorkStatus.SUSPENDED, PermitToWorkStatus.CANCELLED] as PermitToWorkStatus[]).includes(input.status) && !input.comments) throw new Error("Provide a reason for this decision.");
  if (input.status === PermitToWorkStatus.PENDING_APPROVAL) {
    const [published, captured] = await Promise.all([
      prisma.configurableFormDefinition.count({ where: { organizationId: input.organizationId, module: ConfigurableFormModule.PERMIT_TO_WORK, isActive: true, versions: { some: { status: ConfigurableFormVersionStatus.PUBLISHED } } } }),
      prisma.configurableFormSubmission.count({ where: { organizationId: input.organizationId, entityType: ConfigurableFormModule.PERMIT_TO_WORK, entityId: permit.id, status: ConfigurableSubmissionStatus.SUBMITTED } }),
    ]);
    if (captured < published) throw new Error("Complete all published permit forms before submitting for approval.");
  }
  if (input.status === PermitToWorkStatus.ACTIVE) {
    if (permit.plannedEndAt <= new Date()) throw new Error("An expired permit cannot be activated.");
    if (permit.controls.some(control => control.isRequired && !control.isVerified)) throw new Error("Verify all required controls before activation.");
    if (permit.gasTestingRequired && permit.gasTests[0]?.result !== PermitGasTestResult.PASS) throw new Error("Record a passing gas test before activation.");
    if (permit.contractor) {
      if (permit.contractor.status !== ContractorStatus.APPROVED || !permit.contractor.insuranceExpiresAt || permit.contractor.insuranceExpiresAt <= permit.plannedEndAt) throw new Error("The contractor is not approved and insured through the permit period.");
      const authorization = permit.contractor.sites.find(site => site.siteId === permit.siteId);
      if (!authorization || (authorization.expiresAt && authorization.expiresAt <= permit.plannedEndAt)) throw new Error("The contractor site authorization does not cover the permit period.");
      const invalidWorker = permit.workers.find(({ worker }) => worker.status !== ContractorWorkerStatus.ACTIVE || !worker.inductionExpiresAt || worker.inductionExpiresAt <= permit.plannedEndAt);
      if (invalidWorker) throw new Error(`${invalidWorker.worker.firstName} ${invalidWorker.worker.lastName} requires active status and induction valid through the permit period.`);
    }
  }
  if (input.status === PermitToWorkStatus.CLOSED && !input.closeoutNotes) throw new Error("Provide closeout notes before closing the permit.");
  const now = new Date();
  const updated = await prisma.$transaction(async tx => {
    const updated = await tx.permitToWork.update({ where: { id: permit.id }, data: {
      status: input.status,
      approvedById: input.status === PermitToWorkStatus.APPROVED ? input.userId : permit.approvedById,
      approvedAt: input.status === PermitToWorkStatus.APPROVED ? now : permit.approvedAt,
      issuedById: input.status === PermitToWorkStatus.ACTIVE ? input.userId : permit.issuedById,
      activatedAt: input.status === PermitToWorkStatus.ACTIVE ? (permit.activatedAt ?? now) : permit.activatedAt,
      suspendedAt: input.status === PermitToWorkStatus.SUSPENDED ? now : permit.suspendedAt,
      closedById: input.status === PermitToWorkStatus.CLOSED ? input.userId : permit.closedById,
      closedAt: input.status === PermitToWorkStatus.CLOSED ? now : permit.closedAt,
      closeoutNotes: input.status === PermitToWorkStatus.CLOSED ? input.closeoutNotes : permit.closeoutNotes,
    } });
    await tx.permitToWorkHistory.create({ data: { permitId: permit.id, actorId: input.userId, fromStatus: permit.status, toStatus: input.status, comments: input.comments || input.closeoutNotes } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.STATUS_CHANGE, entityType: "PermitToWork", entityId: permit.id, title: "Permit status changed", description: `${permit.status} → ${input.status}`, metadata: { comments: input.comments } } });
    if (input.offlineSubmission) {
      await tx.offlineSubmission.create({
        data: {
          id: input.offlineSubmission.id,
          organizationId: input.organizationId,
          userId: input.userId,
          recordType: "PERMIT_STATUS",
          recordId: updated.id,
          capturedAt: input.offlineSubmission.capturedAt,
          payloadHash: input.offlineSubmission.payloadHash,
        },
      });
    }
    return updated;
  });
  if (permit.requestedById !== input.userId) {
    const notificationType = input.status === PermitToWorkStatus.APPROVED || input.status === PermitToWorkStatus.ACTIVE ? NotificationType.SUCCESS : input.status === PermitToWorkStatus.REJECTED || input.status === PermitToWorkStatus.SUSPENDED ? NotificationType.WARNING : NotificationType.INFO;
    await createNotification({ organizationId: input.organizationId, userId: permit.requestedById, type: notificationType, title: "Permit to work status updated", message: `${permit.reference} moved to ${input.status.replaceAll("_", " ")}.`, link: `/permits-to-work/${permit.id}` }).catch(() => undefined);
  }
  return updated;
}

export async function verifyPermitControlService(input: {
  organizationId: string;
  userId: string;
  permitId: string;
  controlId: string;
  verified: boolean;
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const control = await prisma.permitToWorkControl.findFirst({ where: { id: input.controlId, permitId: input.permitId, permit: { organizationId: input.organizationId } }, include: { permit: true } });
  if (!control) throw new Error("Permit control not found in this organization.");
  if (!([PermitToWorkStatus.APPROVED, PermitToWorkStatus.SUSPENDED] as PermitToWorkStatus[]).includes(control.permit.status)) throw new Error("Controls may only be verified on approved or suspended permits.");
  return prisma.$transaction(async tx => {
    const updated = await tx.permitToWorkControl.update({ where: { id: control.id }, data: { isVerified: input.verified, verifiedById: input.verified ? input.userId : null, verifiedAt: input.verified ? new Date() : null } });
    if (input.offlineSubmission) {
      await tx.offlineSubmission.create({
        data: {
          id: input.offlineSubmission.id,
          organizationId: input.organizationId,
          userId: input.userId,
          recordType: "PERMIT_CONTROL",
          recordId: updated.id,
          capturedAt: input.offlineSubmission.capturedAt,
          payloadHash: input.offlineSubmission.payloadHash,
        },
      });
    }
    return updated;
  });
}

export async function recordPermitGasTestService(input: {
  organizationId: string;
  userId: string;
  permitId: string;
  oxygenPercent?: number | null;
  lelPercent?: number | null;
  h2sPpm?: number | null;
  coPpm?: number | null;
  result: PermitGasTestResult;
  notes?: string | null;
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const permit = await prisma.permitToWork.findFirst({ where: { id: input.permitId, organizationId: input.organizationId } });
  if (!permit) throw new Error("Permit to work not found in this organization.");
  if (!([PermitToWorkStatus.APPROVED, PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED] as PermitToWorkStatus[]).includes(permit.status)) throw new Error("Gas tests can only be recorded after permit approval.");
  const values = [input.oxygenPercent, input.lelPercent, input.h2sPpm, input.coPpm].filter((value): value is number => value !== null && value !== undefined);
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error("Gas readings must be non-negative numbers.");
  if (input.oxygenPercent !== null && input.oxygenPercent !== undefined && input.oxygenPercent > 100) throw new Error("Oxygen percentage cannot exceed 100.");
  return prisma.$transaction(async tx => {
    const gasTest = await tx.permitToWorkGasTest.create({ data: { permitId: permit.id, performedById: input.userId, oxygenPercent: input.oxygenPercent, lelPercent: input.lelPercent, h2sPpm: input.h2sPpm, coPpm: input.coPpm, result: input.result, notes: input.notes } });
    if (input.result === PermitGasTestResult.FAIL && permit.status === PermitToWorkStatus.ACTIVE) {
      const now = new Date();
      await tx.permitToWork.update({ where: { id: permit.id }, data: { status: PermitToWorkStatus.SUSPENDED, suspendedAt: now } });
      await tx.permitToWorkHistory.create({ data: { permitId: permit.id, actorId: input.userId, fromStatus: PermitToWorkStatus.ACTIVE, toStatus: PermitToWorkStatus.SUSPENDED, comments: input.notes || "Automatically suspended after a failed atmospheric test." } });
      await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.STATUS_CHANGE, entityType: "PermitToWork", entityId: permit.id, title: "Permit automatically suspended", description: "A failed atmospheric test stopped the active permit.", metadata: { gasTestId: gasTest.id } } });
    }
    if (input.offlineSubmission) {
      await tx.offlineSubmission.create({
        data: {
          id: input.offlineSubmission.id,
          organizationId: input.organizationId,
          userId: input.userId,
          recordType: "PERMIT_GAS_TEST",
          recordId: gasTest.id,
          capturedAt: input.offlineSubmission.capturedAt,
          payloadHash: input.offlineSubmission.payloadHash,
        },
      });
    }
    return gasTest;
  });
}

export async function assignPermitWorkerService(input: { organizationId: string; userId: string; permitId: string; workerId: string; role?: string | null }) {
  const [permit, worker] = await Promise.all([
    prisma.permitToWork.findFirst({ where: { id: input.permitId, organizationId: input.organizationId } }),
    prisma.contractorWorker.findFirst({ where: { id: input.workerId, contractor: { organizationId: input.organizationId } } }),
  ]);
  if (!permit || !worker || !permit.contractorId || worker.contractorId !== permit.contractorId) throw new Error("Select a worker employed by the permit contractor.");
  if (([PermitToWorkStatus.CLOSED, PermitToWorkStatus.CANCELLED, PermitToWorkStatus.REJECTED, PermitToWorkStatus.EXPIRED] as PermitToWorkStatus[]).includes(permit.status)) throw new Error("Workers cannot be assigned to a closed permit.");
  return prisma.$transaction(async tx => {
    const assignment = await tx.permitToWorkWorker.upsert({ where: { permitId_workerId: { permitId: permit.id, workerId: worker.id } }, update: { role: input.role }, create: { permitId: permit.id, workerId: worker.id, role: input.role } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.ASSIGN, entityType: "PermitToWork", entityId: permit.id, title: "Worker assigned to permit", description: `${worker.firstName} ${worker.lastName}`, metadata: { workerId: worker.id, role: input.role } } });
    return assignment;
  });
}

export async function completePermitFormsService(input: { organizationId: string; userId: string; permitId: string; submissions: PreparedSubmission[] }) {
  const permit = await prisma.permitToWork.findFirst({ where: { id: input.permitId, organizationId: input.organizationId }, select: { id: true } });
  if (!permit) throw new Error("Permit to work not found in this organization.");
  await completeMissingEntityForms({ organizationId: input.organizationId, userId: input.userId, module: ConfigurableFormModule.PERMIT_TO_WORK, entityId: permit.id, activityEntityType: "PermitToWork", activityTitle: "Permit forms captured", formLabel: "permit-to-work", submissions: input.submissions });
}
