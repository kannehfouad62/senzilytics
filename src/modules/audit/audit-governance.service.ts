import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  EnterpriseAuditFindingTrigger,
  EnterpriseAuditFrequency,
  EnterpriseAuditProgramStatus,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditQuestionResponseType,
  EnterpriseAuditRiskPriority,
  EnterpriseAuditSeverity,
} from "@prisma/client";

export async function createAuditProgramService(input: {
  organizationId: string;
  userId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;
  objectives?: string | null;
  scope?: string | null;
  frequency: EnterpriseAuditFrequency;
  riskPriority: EnterpriseAuditRiskPriority;
  ownerId?: string | null;
  defaultProtocolId?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  siteIds: string[];
  departmentIds: string[];
}) {
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    throw new Error("The effective end date cannot be before the start date.");
  }

  const [owner, protocol, sites, departments] = await Promise.all([
    input.ownerId ? prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId } }) : null,
    input.defaultProtocolId ? prisma.auditProtocol.findFirst({ where: { id: input.defaultProtocolId, organizationId: input.organizationId } }) : null,
    prisma.site.findMany({ where: { id: { in: input.siteIds }, organizationId: input.organizationId }, select: { id: true } }),
    prisma.department.findMany({ where: { id: { in: input.departmentIds }, site: { organizationId: input.organizationId } }, select: { id: true } }),
  ]);

  if (input.ownerId && !owner) throw new Error("The selected program owner is invalid.");
  if (input.defaultProtocolId && !protocol) throw new Error("The selected default protocol is invalid.");
  if (sites.length !== new Set(input.siteIds).size) throw new Error("One or more selected sites are invalid.");
  if (departments.length !== new Set(input.departmentIds).size) throw new Error("One or more selected departments are invalid.");

  const program = await prisma.auditProgram.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      code: input.code,
      description: input.description,
      standardName: input.standardName,
      standardVersion: input.standardVersion,
      framework: input.framework,
      objectives: input.objectives,
      scope: input.scope,
      frequency: input.frequency,
      riskPriority: input.riskPriority,
      status: EnterpriseAuditProgramStatus.DRAFT,
      ownerId: input.ownerId,
      defaultProtocolId: input.defaultProtocolId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      sites: { create: [...new Set(input.siteIds)].map((siteId, index) => ({ siteId, isPrimary: index === 0 })) },
      departments: { create: [...new Set(input.departmentIds)].map((departmentId, index) => ({ departmentId, isPrimary: index === 0 })) },
    },
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditProgram",
    entityId: program.id,
    title: "Audit program created",
    description: input.name,
    metadata: { frequency: input.frequency, riskPriority: input.riskPriority },
  });
  return program;
}

export async function createAuditProtocolService(input: {
  organizationId: string;
  userId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
}) {
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    throw new Error("The effective end date cannot be before the start date.");
  }
  const protocol = await prisma.auditProtocol.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      code: input.code,
      description: input.description,
      standardName: input.standardName,
      standardVersion: input.standardVersion,
      framework: input.framework,
      status: EnterpriseAuditProtocolStatus.DRAFT,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      createdById: input.userId,
      updatedById: input.userId,
    },
  });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "AuditProtocol", entityId: protocol.id, title: "Audit protocol created", description: `${input.name} version 1` });
  return protocol;
}

export async function activateAuditProgramService(input: {
  organizationId: string;
  userId: string;
  programId: string;
}) {
  const program = await prisma.auditProgram.findFirst({
    where: { id: input.programId, organizationId: input.organizationId },
    include: { sites: true, defaultProtocol: true },
  });
  if (!program) throw new Error("Audit program not found.");
  if (program.sites.length === 0) throw new Error("Select at least one site before activating the program.");
  if (!program.defaultProtocol || program.defaultProtocol.status !== EnterpriseAuditProtocolStatus.ACTIVE) {
    throw new Error("Select an active default protocol before activating the program.");
  }
  const updated = await prisma.auditProgram.update({
    where: { id: program.id },
    data: { status: EnterpriseAuditProgramStatus.ACTIVE, isActive: true },
  });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.STATUS_CHANGE, entityType: "AuditProgram", entityId: program.id, title: "Audit program activated", description: program.name });
  return updated;
}

export async function addAuditProtocolSectionService(input: {
  organizationId: string;
  userId: string;
  protocolId: string;
  title: string;
  description?: string | null;
  guidance?: string | null;
  standardRef?: string | null;
  weight: number;
}) {
  const protocol = await prisma.auditProtocol.findFirst({ where: { id: input.protocolId, organizationId: input.organizationId }, include: { _count: { select: { sections: true } } } });
  if (!protocol) throw new Error("Audit protocol not found.");
  if (protocol.status !== EnterpriseAuditProtocolStatus.DRAFT) throw new Error("Only draft protocols can be edited.");
  const section = await prisma.auditProtocolSection.create({ data: { protocolId: protocol.id, title: input.title, description: input.description, guidance: input.guidance, standardRef: input.standardRef, weight: input.weight, sequence: protocol._count.sections + 1 } });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.UPDATE, entityType: "AuditProtocol", entityId: protocol.id, title: "Protocol section added", description: input.title });
  return section;
}

export async function addAuditProtocolQuestionService(input: {
  organizationId: string;
  userId: string;
  protocolId: string;
  sectionId: string;
  questionText: string;
  description?: string | null;
  guidance?: string | null;
  standardClause?: string | null;
  regulatoryRef?: string | null;
  responseType: EnterpriseAuditQuestionResponseType;
  weight: number;
  allowNotApplicable: boolean;
  requireComment: boolean;
  requireEvidence: boolean;
  requirePhoto: boolean;
  findingTrigger: EnterpriseAuditFindingTrigger;
  defaultSeverity?: EnterpriseAuditSeverity | null;
  automaticallyCreateFinding: boolean;
  automaticallySuggestCapa: boolean;
  automaticallySuggestRisk: boolean;
  optionLabels: string[];
}) {
  const section = await prisma.auditProtocolSection.findFirst({ where: { id: input.sectionId, protocolId: input.protocolId, protocol: { organizationId: input.organizationId, status: EnterpriseAuditProtocolStatus.DRAFT } }, include: { _count: { select: { questions: true } } } });
  if (!section) throw new Error("Editable protocol section not found.");
  const question = await prisma.auditProtocolQuestion.create({
    data: {
      sectionId: section.id,
      questionText: input.questionText,
      description: input.description,
      guidance: input.guidance,
      standardClause: input.standardClause,
      regulatoryRef: input.regulatoryRef,
      responseType: input.responseType,
      sequence: section._count.questions + 1,
      weight: input.weight,
      allowNotApplicable: input.allowNotApplicable,
      requireComment: input.requireComment,
      requireEvidence: input.requireEvidence,
      requirePhoto: input.requirePhoto,
      findingTrigger: input.findingTrigger,
      defaultSeverity: input.defaultSeverity,
      automaticallyCreateFinding: input.automaticallyCreateFinding,
      automaticallySuggestCapa: input.automaticallySuggestCapa,
      automaticallySuggestRisk: input.automaticallySuggestRisk,
      options: { create: input.optionLabels.map((label, index) => ({ label, value: label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || `OPTION_${index + 1}`, sequence: index + 1 })) },
    },
  });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.UPDATE, entityType: "AuditProtocol", entityId: input.protocolId, title: "Protocol question added", description: input.questionText });
  return question;
}

export async function activateAuditProtocolService(input: { organizationId: string; userId: string; protocolId: string }) {
  const protocol = await prisma.auditProtocol.findFirst({ where: { id: input.protocolId, organizationId: input.organizationId }, include: { sections: { include: { _count: { select: { questions: true } } } } } });
  if (!protocol) throw new Error("Audit protocol not found.");
  if (protocol.sections.length === 0 || protocol.sections.some((section) => section._count.questions === 0)) throw new Error("Every protocol must contain at least one section and every section must contain a question before activation.");
  const updated = await prisma.auditProtocol.update({ where: { id: protocol.id }, data: { status: EnterpriseAuditProtocolStatus.ACTIVE, isActive: true, updatedById: input.userId } });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.STATUS_CHANGE, entityType: "AuditProtocol", entityId: protocol.id, title: "Audit protocol activated", description: `${protocol.name} version ${protocol.version}` });
  return updated;
}
