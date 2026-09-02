"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { addResearchMilestoneService, assignResearchTeamMemberService, changeResearchProjectStatusService, createResearchClientService, createResearchProjectService } from "@/modules/research/research.service";
import { PermissionKey, ResearchDataClassification, ResearchMethodology, ResearchProjectStatus, ResearchTeamRole } from "@prisma/client";
import { ResearchResponseIdentityMode } from "@prisma/client";
import { createResearchQuestionnaireService } from "@/modules/research/research-questionnaire.service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const value = text(data, key);
  if (!value) throw new Error(`${key.replaceAll(/([A-Z])/g, " $1").toLowerCase()} is required.`);
  return value;
};
const optionalDate = (data: FormData, key: string) => {
  const value = text(data, key);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Enter a valid ${key}.`);
  return parsed;
};
const optionalInteger = (data: FormData, key: string) => {
  const value = text(data, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${key} must be a whole number.`);
  return parsed;
};
const enumValue = <T extends string>(data: FormData, key: string, values: Record<string, T>) => {
  const value = required(data, key);
  if (!Object.values(values).includes(value as T)) throw new Error(`Select a valid ${key}.`);
  return value as T;
};
const success = (message: string): FormActionState => ({ status: "SUCCESS", message });
const failure = (cause: unknown, fallback: string): FormActionState => ({ status: "ERROR", message: cause instanceof Error ? cause.message : fallback });

function refresh(projectId?: string) {
  revalidatePath("/research");
  revalidatePath("/research/projects");
  revalidatePath("/research/clients");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/notifications");
  revalidatePath("/activity");
  if (projectId) revalidatePath(`/research/projects/${projectId}`);
}

export async function createResearchClient(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_RESEARCH_CLIENTS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    await createResearchClientService({ organizationId, userId: user.id, name: required(data, "name"), legalName: text(data, "legalName") || null, code: text(data, "code") || null, industry: text(data, "industry") || null, country: text(data, "country") || null, website: text(data, "website") || null, primaryContactName: text(data, "primaryContactName") || null, primaryContactEmail: text(data, "primaryContactEmail") || null, dataOwnerName: text(data, "dataOwnerName") || null, dataOwnerEmail: text(data, "dataOwnerEmail") || null, dataClassification: enumValue(data, "dataClassification", ResearchDataClassification), retentionDays: optionalInteger(data, "retentionDays"), contractualNotes: text(data, "contractualNotes") || null });
    refresh();
    return success("Research client created.");
  } catch (cause) { return failure(cause, "Research client could not be created."); }
}

export async function createResearchProject(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.CREATE_RESEARCH_PROJECT);
  const { organizationId, user } = await getCurrentUserTenant();
  let projectId = "";
  try {
    const project = await createResearchProjectService({ organizationId, userId: user.id, reference: required(data, "reference"), title: required(data, "title"), purpose: required(data, "purpose"), objectives: required(data, "objectives"), researchQuestions: required(data, "researchQuestions"), hypotheses: text(data, "hypotheses") || null, methodology: enumValue(data, "methodology", ResearchMethodology), targetPopulation: text(data, "targetPopulation") || null, geographicScope: text(data, "geographicScope") || null, samplingStrategy: text(data, "samplingStrategy") || null, sampleTarget: optionalInteger(data, "sampleTarget"), clientId: text(data, "clientId") || null, projectManagerId: required(data, "projectManagerId"), principalInvestigatorId: text(data, "principalInvestigatorId") || null, dataClassification: enumValue(data, "dataClassification", ResearchDataClassification), intendedUse: text(data, "intendedUse") || null, dataOwnershipStatement: text(data, "dataOwnershipStatement") || null, confidentialityTerms: text(data, "confidentialityTerms") || null, retentionDays: optionalInteger(data, "retentionDays"), ethicsApprovalRequired: data.get("ethicsApprovalRequired") === "on", ethicsApprovalReference: text(data, "ethicsApprovalReference") || null, consentRequired: data.get("consentRequired") === "on", startDate: optionalDate(data, "startDate"), dueDate: optionalDate(data, "dueDate") });
    projectId = project.id;
    refresh(project.id);
  } catch (cause) { return failure(cause, "Research project could not be created."); }
  redirect(`/research/projects/${projectId}`);
}

export async function assignResearchTeamMember(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_RESEARCH_TEAMS);
  const { organizationId, user } = await getCurrentUserTenant();
  const projectId = required(data, "projectId");
  try {
    await assignResearchTeamMemberService({ organizationId, actorId: user.id, projectId, userId: required(data, "userId"), role: enumValue(data, "role", ResearchTeamRole), isLead: data.get("isLead") === "on" });
    refresh(projectId);
    return success("Research team assignment updated.");
  } catch (cause) { return failure(cause, "Research team assignment could not be updated."); }
}

export async function addResearchMilestone(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_RESEARCH_PROJECTS);
  const { organizationId, user } = await getCurrentUserTenant();
  const projectId = required(data, "projectId");
  try {
    await addResearchMilestoneService({ organizationId, actorId: user.id, projectId, title: required(data, "title"), description: text(data, "description") || null, dueDate: optionalDate(data, "dueDate"), ownerId: text(data, "ownerId") || null });
    refresh(projectId);
    return success("Research milestone added.");
  } catch (cause) { return failure(cause, "Research milestone could not be added."); }
}

export async function changeResearchProjectStatus(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_RESEARCH_PROJECTS);
  const [{ organizationId, user }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  const projectId = required(data, "projectId");
  try {
    await changeResearchProjectStatusService({ organizationId, actorId: user.id, projectId, status: enumValue(data, "status", ResearchProjectStatus), canApprove: permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS) });
    refresh(projectId);
    return success("Research project status updated.");
  } catch (cause) { return failure(cause, "Research project status could not be updated."); }
}

export async function createResearchQuestionnaire(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.DESIGN_RESEARCH_QUESTIONNAIRES);
  const { organizationId, user } = await getCurrentUserTenant();
  const projectId = required(data, "projectId");
  let definitionId = "";
  try {
    const questionnaire = await createResearchQuestionnaireService({ organizationId, userId: user.id, projectId, name: required(data, "name"), purpose: required(data, "purpose"), targetAudience: text(data, "targetAudience") || null, identityMode: enumValue(data, "identityMode", ResearchResponseIdentityMode), defaultLanguage: text(data, "defaultLanguage") || "en", consentStatement: text(data, "consentStatement") || null });
    definitionId = questionnaire.formDefinitionId;
    refresh(projectId);
    revalidatePath(`/research/projects/${projectId}/questionnaires`);
  } catch (cause) { return failure(cause, "Research questionnaire could not be created."); }
  redirect(`/form-studio/${definitionId}`);
}
