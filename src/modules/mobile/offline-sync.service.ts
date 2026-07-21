import { ActivityAction, ConfigurableFormModule, PermissionKey, RiskLevel, SafetyObservationType, UserRole } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionFeature } from "@/lib/subscription";
import { createPreparedSubmissions, prepareCapturedFormSubmissions } from "@/modules/forms/runtime-form.service";

const customValue = z.union([z.string().max(5000), z.number().finite(), z.boolean(), z.array(z.string().max(1000)).max(100)]);
const capturedFormSchema = z.object({ definitionId: z.string().min(1), versionId: z.string().min(1), answers: z.array(z.object({ fieldId: z.string().min(1), value: customValue })).max(100) });
const itemSchema = z.object({ id: z.string().uuid(), type: z.literal("SAFETY_OBSERVATION"), capturedAt: z.string().datetime(), payload: z.object({ siteId: z.string().min(1), title: z.string().min(2).max(200), description: z.string().min(2).max(5000), type: z.nativeEnum(SafetyObservationType), riskLevel: z.nativeEnum(RiskLevel), location: z.string().max(300).optional(), immediateAction: z.string().max(2000).optional(), observedAt: z.string().datetime(), isAnonymous: z.boolean().default(false), customForms: z.array(capturedFormSchema).max(20).default([]) }) });
export const offlineSyncRequestSchema = z.object({ items: z.array(itemSchema).min(1).max(50) });

export async function syncOfflineSubmissionsService(input: { organizationId: string; userId: string; departmentId: string | null; role: UserRole; request: unknown }) {
  const parsed = offlineSyncRequestSchema.safeParse(input.request);
  if (!parsed.success) return { ok: false as const, status: 400, body: { error: "Invalid offline submission", details: parsed.error.flatten() } };
  const canCreate = input.role === UserRole.SUPER_ADMIN || Boolean(await prisma.rolePermission.findUnique({ where: { role_permission: { role: input.role, permission: PermissionKey.CREATE_OBSERVATION } } }));
  if (!canCreate) return { ok: false as const, status: 403, body: { error: "Forbidden" } };
  try { await requireSubscriptionFeature(input.organizationId, "OFFLINE_COLLECTION"); } catch { return { ok: false as const, status: 403, body: { error: "Offline collection is not included in this subscription." } }; }
  const results: Array<{ id: string; status: string; recordId?: string; error?: string }> = [];
  for (const item of parsed.data.items) {
    const existing = await prisma.offlineSubmission.findUnique({ where: { id: item.id } });
    if (existing) {
      results.push(existing.organizationId === input.organizationId && existing.userId === input.userId ? { id: item.id, status: "already_synced", recordId: existing.recordId } : { id: item.id, status: "failed", error: "Submission identifier is unavailable." });
      continue;
    }
    const site = await prisma.site.findFirst({ where: { id: item.payload.siteId, organizationId: input.organizationId }, select: { id: true } });
    if (!site) { results.push({ id: item.id, status: "failed", error: "Site is not available to this tenant." }); continue; }
    const hash = createHash("sha256").update(JSON.stringify(item.payload)).digest("hex");
    try {
      const capturedAt = new Date(item.capturedAt);
      const submissions = await prepareCapturedFormSubmissions({ organizationId: input.organizationId, module: ConfigurableFormModule.OBSERVATION, capturedAt, forms: item.payload.customForms });
      const record = await prisma.$transaction(async (tx) => {
        const observation = await tx.safetyObservation.create({ data: { organizationId: input.organizationId, siteId: site.id, departmentId: input.departmentId, reportedById: input.userId, reference: `OBS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`, title: item.payload.title, description: item.payload.description, type: item.payload.type, riskLevel: item.payload.riskLevel, location: item.payload.location || null, immediateAction: item.payload.immediateAction || null, observedAt: new Date(item.payload.observedAt), isAnonymous: item.payload.isAnonymous } });
        await createPreparedSubmissions(tx, { organizationId: input.organizationId, userId: input.userId, module: ConfigurableFormModule.OBSERVATION, entityId: observation.id, submissions });
        await tx.offlineSubmission.create({ data: { id: item.id, organizationId: input.organizationId, userId: input.userId, recordType: item.type, recordId: observation.id, capturedAt, payloadHash: hash } });
        await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "SafetyObservation", entityId: observation.id, title: "Offline safety observation synchronized", description: observation.title, metadata: { offlineSubmissionId: item.id, customFormCount: submissions.length } } });
        return observation;
      });
      results.push({ id: item.id, status: "synced", recordId: record.id });
    } catch (error) { results.push({ id: item.id, status: "failed", error: safeOfflineError(error) }); }
  }
  return { ok: true as const, status: 200, body: { results } };
}

const safeOfflineError = (error: unknown) => { const value = error instanceof Error ? error.message : ""; return /captured|custom form|form version|answer|is required|must be|valid option/i.test(value) ? value : "The record could not be synchronized."; };
