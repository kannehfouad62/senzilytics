import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivityAction, ConfigurableFormModule, PermissionKey, RiskLevel, SafetyObservationType, UserRole } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSubscriptionFeature } from "@/lib/subscription";
import { createPreparedSubmissions, prepareCapturedFormSubmissions } from "@/modules/forms/runtime-form.service";

const customValue=z.union([z.string().max(5000),z.number().finite(),z.boolean(),z.array(z.string().max(1000)).max(100)]);
const capturedFormSchema=z.object({definitionId:z.string().min(1),versionId:z.string().min(1),answers:z.array(z.object({fieldId:z.string().min(1),value:customValue})).max(100)});

const itemSchema = z.object({
  id: z.string().uuid(), type: z.literal("SAFETY_OBSERVATION"), capturedAt: z.string().datetime(),
  payload: z.object({ siteId: z.string().min(1), title: z.string().min(2).max(200), description: z.string().min(2).max(5000), type: z.nativeEnum(SafetyObservationType), riskLevel: z.nativeEnum(RiskLevel), location: z.string().max(300).optional(), immediateAction: z.string().max(2000).optional(), observedAt: z.string().datetime(), isAnonymous: z.boolean().default(false),customForms:z.array(capturedFormSchema).max(20).default([]) }),
});
const requestSchema = z.object({ items: z.array(itemSchema).min(1).max(50) });
const safeOfflineError=(error:unknown)=>{const value=error instanceof Error?error.message:"";return /captured|custom form|form version|answer|is required|must be|valid option/i.test(value)?value:"The record could not be synchronized."};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, organizationId: true, departmentId: true, isActive: true } });
  if (!currentUser?.isActive || !currentUser.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canCreate = session.user.role === UserRole.SUPER_ADMIN || Boolean(await prisma.rolePermission.findUnique({ where: { role_permission: { role: session.user.role as UserRole, permission: PermissionKey.CREATE_OBSERVATION } } }));
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid offline submission", details: parsed.error.flatten() }, { status: 400 });
  const organizationId = currentUser.organizationId, userId = currentUser.id;
  try { await requireSubscriptionFeature(organizationId, "OFFLINE_COLLECTION"); } catch { return NextResponse.json({ error: "Offline collection is not included in this subscription." }, { status: 403 }); }
  const results: Array<{ id: string; status: string; recordId?: string; error?: string }> = [];
  for (const item of parsed.data.items) {
    const existing = await prisma.offlineSubmission.findUnique({ where: { id: item.id } });
    if (existing) { results.push({ id: item.id, status: "already_synced", recordId: existing.recordId }); continue; }
    const site = await prisma.site.findFirst({ where: { id: item.payload.siteId, organizationId }, select: { id: true } });
    if (!site) { results.push({ id: item.id, status: "failed", error: "Site is not available to this tenant." }); continue; }
    const hash = createHash("sha256").update(JSON.stringify(item.payload)).digest("hex");
    try {
      const capturedAt=new Date(item.capturedAt);const submissions=await prepareCapturedFormSubmissions({organizationId,module:ConfigurableFormModule.OBSERVATION,capturedAt,forms:item.payload.customForms});
      const record = await prisma.$transaction(async tx => {
        const observation = await tx.safetyObservation.create({ data: { organizationId, siteId: site.id, departmentId: currentUser.departmentId, reportedById: userId, reference: `OBS-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`, title: item.payload.title, description: item.payload.description, type: item.payload.type, riskLevel: item.payload.riskLevel, location: item.payload.location || null, immediateAction: item.payload.immediateAction || null, observedAt: new Date(item.payload.observedAt), isAnonymous: item.payload.isAnonymous } });
        await createPreparedSubmissions(tx,{organizationId,userId,module:ConfigurableFormModule.OBSERVATION,entityId:observation.id,submissions});
        await tx.offlineSubmission.create({ data: { id: item.id, organizationId, userId, recordType: item.type, recordId: observation.id, capturedAt: new Date(item.capturedAt), payloadHash: hash } });
        await tx.activityLog.create({data:{organizationId,userId,action:ActivityAction.CREATE,entityType:"SafetyObservation",entityId:observation.id,title:"Offline safety observation synchronized",description:observation.title,metadata:{offlineSubmissionId:item.id,customFormCount:submissions.length}}});
        return observation;
      });
      results.push({ id: item.id, status: "synced", recordId: record.id });
    } catch(error) { results.push({ id: item.id, status: "failed", error: safeOfflineError(error) }); }
  }
  return NextResponse.json({ results });
}
