import { randomUUID } from "node:crypto";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import { type PreparedSubmission, createPreparedSubmissions } from "@/modules/forms/runtime-form.service";
import { exposureRatio, classifyExposureResult } from "@/modules/industrial-hygiene/exposure-classification";
import { isExposureAssessmentTransitionAllowed } from "@/modules/industrial-hygiene/exposure-assessment-lifecycle";
import { ActivityAction, ConfigurableFormModule, ExposureAssessmentStatus, ExposureResultClassification, ExposureSampleType, HygieneAgentCategory, NotificationType } from "@prisma/client";

export async function createHygieneAgentService(input: { organizationId: string; userId: string; name: string; category: HygieneAgentCategory; casNumber?: string | null; description?: string | null; healthEffects?: string | null; exposureRoutes?: string | null; occupationalLimit?: number | null; actionLevel?: number | null; ceilingLimit?: number | null; unit?: string | null; limitSource?: string | null; samplingMethod?: string | null; analyticalMethod?: string | null; requiresSurveillance: boolean }) {
  const limits = [input.occupationalLimit, input.actionLevel, input.ceilingLimit].filter((value): value is number => value !== null && value !== undefined);
  if (limits.some(value => !Number.isFinite(value) || value < 0)) throw new Error("Exposure limits must be non-negative numbers.");
  if (limits.length && !input.unit) throw new Error("Record the unit used by the exposure limits.");
  return prisma.$transaction(async tx => {
    const agent = await tx.hygieneAgent.create({ data: { organizationId: input.organizationId, name: input.name, category: input.category, casNumber: input.casNumber, description: input.description, healthEffects: input.healthEffects, exposureRoutes: input.exposureRoutes, occupationalLimit: input.occupationalLimit, actionLevel: input.actionLevel, ceilingLimit: input.ceilingLimit, unit: input.unit, limitSource: input.limitSource, samplingMethod: input.samplingMethod, analyticalMethod: input.analyticalMethod, requiresSurveillance: input.requiresSurveillance } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "HygieneAgent", entityId: agent.id, title: "Exposure agent created", description: agent.name, metadata: { category: agent.category, requiresSurveillance: agent.requiresSurveillance } } });
    return agent;
  });
}

export async function createExposureGroupService(input: { organizationId: string; userId: string; name: string; code?: string | null; siteId: string; departmentId?: string | null; description?: string | null; jobRoles?: string | null; tasks?: string | null; locations?: string | null; exposedHeadcount?: number | null; existingControls?: string | null; requiredPpe?: string | null; ownerId?: string | null; reviewDueDate?: Date | null; agentIds: string[] }) {
  const agentIds = [...new Set(input.agentIds)];
  if (!agentIds.length) throw new Error("Link at least one exposure agent to the group.");
  if (input.exposedHeadcount !== null && input.exposedHeadcount !== undefined && (!Number.isInteger(input.exposedHeadcount) || input.exposedHeadcount < 0)) throw new Error("Exposed headcount must be a non-negative whole number.");
  const [site, department, owner, agents] = await Promise.all([
    prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }),
    input.departmentId ? prisma.department.findFirst({ where: { id: input.departmentId, siteId: input.siteId, site: { organizationId: input.organizationId } } }) : null,
    input.ownerId ? prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId, isActive: true } }) : null,
    prisma.hygieneAgent.findMany({ where: { id: { in: agentIds }, organizationId: input.organizationId, isActive: true }, select: { id: true } }),
  ]);
  if (!site || (input.departmentId && !department) || (input.ownerId && !owner) || agents.length !== agentIds.length) throw new Error("Select valid tenant sites, departments, owners, and agents.");
  return prisma.$transaction(async tx => {
    const group = await tx.similarExposureGroup.create({ data: { organizationId: input.organizationId, siteId: input.siteId, departmentId: input.departmentId, name: input.name, code: input.code, description: input.description, jobRoles: input.jobRoles, tasks: input.tasks, locations: input.locations, exposedHeadcount: input.exposedHeadcount, existingControls: input.existingControls, requiredPpe: input.requiredPpe, ownerId: input.ownerId, reviewDueDate: input.reviewDueDate, agents: { create: agents.map(agent => ({ agentId: agent.id })) } } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "SimilarExposureGroup", entityId: group.id, title: "Similar exposure group created", description: group.name, metadata: { siteId: group.siteId, agentCount: agents.length } } });
    return group;
  });
}

export async function createExposureAssessmentService(input: { organizationId: string; userId: string; title: string; description?: string | null; groupId: string; assessorId?: string | null; scheduledAt?: Date | null; dueDate?: Date | null; scope?: string | null; samplingPlan?: string | null; customSubmissions?: PreparedSubmission[] }) {
  const [group, assessor] = await Promise.all([
    prisma.similarExposureGroup.findFirst({ where: { id: input.groupId, organizationId: input.organizationId, isActive: true } }),
    input.assessorId ? prisma.user.findFirst({ where: { id: input.assessorId, organizationId: input.organizationId, isActive: true } }) : null,
  ]);
  if (!group || (input.assessorId && !assessor)) throw new Error("Select a valid active exposure group and tenant assessor.");
  if (input.scheduledAt && input.dueDate && input.dueDate < input.scheduledAt) throw new Error("Assessment due date must be on or after the scheduled date.");
  const reference = `IH-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  return prisma.$transaction(async tx => {
    const assessment = await tx.exposureAssessment.create({ data: { organizationId: input.organizationId, reference, title: input.title, description: input.description, groupId: group.id, siteId: group.siteId, departmentId: group.departmentId, assessorId: input.assessorId, scheduledAt: input.scheduledAt, dueDate: input.dueDate, scope: input.scope, samplingPlan: input.samplingPlan } });
    await createPreparedSubmissions(tx, { organizationId: input.organizationId, userId: input.userId, module: ConfigurableFormModule.INDUSTRIAL_HYGIENE, entityId: assessment.id, submissions: input.customSubmissions ?? [] });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "ExposureAssessment", entityId: assessment.id, title: "Exposure assessment created", description: `${reference} — ${assessment.title}`, metadata: { groupId: group.id, assessorId: input.assessorId } } });
    return assessment;
  });
}

export async function addExposureSampleService(input: { organizationId: string; userId: string; assessmentId: string; agentId: string; sampleType: ExposureSampleType; sampleReference?: string | null; sampledWorkerId?: string | null; location?: string | null; task?: string | null; sampledAt: Date; durationMinutes?: number | null; resultValue?: number | null; reportingLimit?: number | null; occupationalLimit?: number | null; actionLevel?: number | null; unit?: string | null; laboratory?: string | null; analyticalMethod?: string | null; analyzedAt?: Date | null; notes?: string | null }) {
  const [assessment, agent, worker] = await Promise.all([
    prisma.exposureAssessment.findFirst({ where: { id: input.assessmentId, organizationId: input.organizationId }, include: { group: { include: { agents: true } } } }),
    prisma.hygieneAgent.findFirst({ where: { id: input.agentId, organizationId: input.organizationId } }),
    input.sampledWorkerId ? prisma.user.findFirst({ where: { id: input.sampledWorkerId, organizationId: input.organizationId, isActive: true } }) : null,
  ]);
  if (!assessment || !agent || (input.sampledWorkerId && !worker)) throw new Error("Select a valid tenant assessment, agent, and worker.");
  if (!assessment.group.agents.some(link => link.agentId === agent.id)) throw new Error("The sample agent is not linked to this exposure group.");
  if (assessment.status !== ExposureAssessmentStatus.IN_PROGRESS) throw new Error("Start the assessment before recording exposure samples.");
  if (input.durationMinutes !== null && input.durationMinutes !== undefined && (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0)) throw new Error("Sampling duration must be a positive whole number.");
  if (input.sampledAt > new Date()) throw new Error("Sample date cannot be in the future.");
  const sampleDay = new Date(input.sampledAt); sampleDay.setUTCHours(0, 0, 0, 0);
  if (input.analyzedAt && (input.analyzedAt < sampleDay || input.analyzedAt > new Date())) throw new Error("Analysis date must be between the sample date and today.");
  const numeric = [input.resultValue, input.reportingLimit, input.occupationalLimit, input.actionLevel].filter((value): value is number => value !== null && value !== undefined);
  if (numeric.some(value => !Number.isFinite(value) || value < 0)) throw new Error("Sample values and limits must be non-negative numbers.");
  const occupationalLimit = input.occupationalLimit ?? agent.occupationalLimit;
  const actionLevel = input.actionLevel ?? agent.actionLevel;
  const resultValue = input.resultValue ?? null;
  if (resultValue !== null && !(input.unit ?? agent.unit)) throw new Error("Record the unit used by the sample result.");
  const classification = classifyExposureResult({ resultValue, reportingLimit: input.reportingLimit ?? null, actionLevel: actionLevel ?? null, occupationalLimit: occupationalLimit ?? null });
  const ratio = exposureRatio(resultValue, occupationalLimit ?? null);
  const sample = await prisma.$transaction(async tx => {
    const created = await tx.exposureSample.create({ data: { assessmentId: assessment.id, agentId: agent.id, sampleType: input.sampleType, sampleReference: input.sampleReference, sampledWorkerId: input.sampledWorkerId, location: input.location, task: input.task, sampledAt: input.sampledAt, durationMinutes: input.durationMinutes, resultValue, reportingLimit: input.reportingLimit, occupationalLimit, actionLevel, unit: input.unit ?? agent.unit, exposureRatio: ratio, classification, laboratory: input.laboratory, analyticalMethod: input.analyticalMethod ?? agent.analyticalMethod, analyzedAt: input.analyzedAt, notes: input.notes, createdById: input.userId } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "ExposureSample", entityId: created.id, title: "Exposure sample recorded", description: `${assessment.reference} — ${agent.name}`, metadata: { assessmentId: assessment.id, classification, exposureRatio: ratio } } });
    return created;
  });
  if ((classification === ExposureResultClassification.ABOVE_LIMIT || classification === ExposureResultClassification.AT_OR_ABOVE_ACTION_LEVEL) && assessment.assessorId) await createNotification({ organizationId: input.organizationId, userId: assessment.assessorId, type: classification === ExposureResultClassification.ABOVE_LIMIT ? NotificationType.CRITICAL : NotificationType.WARNING, title: "Exposure result requires review", message: `${assessment.reference}: ${agent.name} was classified ${classification.replaceAll("_", " ")}.`, link: `/industrial-hygiene/${assessment.id}` }).catch(() => undefined);
  return sample;
}

export async function transitionExposureAssessmentService(input: { organizationId: string; userId: string; assessmentId: string; status: ExposureAssessmentStatus; observations?: string | null; conclusions?: string | null; recommendations?: string | null }) {
  const assessment = await prisma.exposureAssessment.findFirst({ where: { id: input.assessmentId, organizationId: input.organizationId }, include: { samples: true } });
  if (!assessment) throw new Error("Exposure assessment not found in this organization.");
  if (!isExposureAssessmentTransitionAllowed(assessment.status, input.status)) throw new Error(`A ${assessment.status.replaceAll("_", " ")} assessment cannot move to ${input.status.replaceAll("_", " ")}.`);
  if (input.status === ExposureAssessmentStatus.UNDER_REVIEW && !assessment.samples.length) throw new Error("Record at least one exposure sample before review.");
  if (input.status === ExposureAssessmentStatus.COMPLETED && !(input.conclusions || assessment.conclusions)) throw new Error("Record assessment conclusions before completion.");
  const now = new Date();
  return prisma.$transaction(async tx => {
    const updated = await tx.exposureAssessment.update({ where: { id: assessment.id }, data: { status: input.status, observations: input.observations ?? assessment.observations, conclusions: input.conclusions ?? assessment.conclusions, recommendations: input.recommendations ?? assessment.recommendations, startedAt: input.status === ExposureAssessmentStatus.IN_PROGRESS ? (assessment.startedAt ?? now) : assessment.startedAt, completedAt: input.status === ExposureAssessmentStatus.COMPLETED ? now : assessment.completedAt } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.STATUS_CHANGE, entityType: "ExposureAssessment", entityId: assessment.id, title: "Exposure assessment status changed", description: `${assessment.status} → ${input.status}`, metadata: { previousStatus: assessment.status, newStatus: input.status } } });
    return updated;
  });
}

export async function completeExposureAssessmentFormsService(input: { organizationId: string; userId: string; assessmentId: string; submissions: PreparedSubmission[] }) {
  const assessment = await prisma.exposureAssessment.findFirst({ where: { id: input.assessmentId, organizationId: input.organizationId }, select: { id: true } });
  if (!assessment) throw new Error("Exposure assessment not found in this organization.");
  await completeMissingEntityForms({ organizationId: input.organizationId, userId: input.userId, module: ConfigurableFormModule.INDUSTRIAL_HYGIENE, entityId: assessment.id, activityEntityType: "ExposureAssessment", activityTitle: "Exposure assessment forms captured", formLabel: "industrial-hygiene", submissions: input.submissions });
}
