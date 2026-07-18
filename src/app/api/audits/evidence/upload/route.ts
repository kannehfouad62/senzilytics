import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { EnterpriseAuditEvidenceType, PermissionKey } from "@prisma/client";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 25 * 1024 * 1024;
const CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4", "text/plain", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
type Payload = { auditId: string; findingId?: string; questionId?: string; title: string; description?: string; evidenceType: EnterpriseAuditEvidenceType; fileName: string; fileSize: number };

function payload(value: string | null | undefined): Payload {
  const parsed = JSON.parse(value || "null") as Partial<Payload> | null;
  if (!parsed || !parsed.auditId || !parsed.title || !parsed.fileName || !parsed.fileSize || !parsed.evidenceType || !Object.values(EnterpriseAuditEvidenceType).includes(parsed.evidenceType)) throw new Error("Complete the evidence title and select a valid file.");
  if (parsed.fileSize < 1 || parsed.fileSize > MAX_BYTES) throw new Error("Evidence files must be between 1 byte and 25 MB.");
  return parsed as Payload;
}

async function currentUser() {
  const session = await auth(); if (!session?.user?.email) throw new Error("Sign in before uploading evidence.");
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, organizationId: true } });
  if (!user?.organizationId) throw new Error("Your account is not assigned to an organization.");
  return { id: user.id, organizationId: user.organizationId };
}

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "Evidence storage is not configured." }, { status: 500 });
  let body: HandleUploadBody; try { body = await request.json() as HandleUploadBody; } catch { return NextResponse.json({ error: "Invalid upload request." }, { status: 400 }); }
  try {
    return NextResponse.json(await handleUpload({ request, body, token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const [user, data] = await Promise.all([currentUser(), Promise.resolve(payload(clientPayload))]);
        const audit = await prisma.enterpriseAudit.findFirst({ where: { id: data.auditId, organizationId: user.organizationId }, select: { id: true } }); if (!audit) throw new Error("Audit not found.");
        if (data.findingId && !(await prisma.enterpriseAuditFinding.findFirst({ where: { id: data.findingId, auditId: audit.id, organizationId: user.organizationId }, select: { id: true } }))) throw new Error("Audit finding not found.");
        if (data.questionId && !(await prisma.enterpriseAuditQuestion.findFirst({ where: { id: data.questionId, auditId: audit.id }, select: { id: true } }))) throw new Error("Audit question not found.");
        const prefix = `audit-evidence/${audit.id}/`; if (!pathname.startsWith(prefix)) throw new Error("The evidence upload path is invalid.");
        return { allowedContentTypes: CONTENT_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true, tokenPayload: JSON.stringify({ ...data, organizationId: user.organizationId, userId: user.id }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const data = JSON.parse(tokenPayload || "null") as Payload & { organizationId: string; userId: string };
        const evidence = await prisma.enterpriseAuditEvidence.create({ data: { organizationId: data.organizationId, auditId: data.auditId, findingId: data.findingId, questionId: data.questionId, evidenceType: data.evidenceType, title: data.title, description: data.description || null, fileName: data.fileName, fileUrl: blob.url, mimeType: blob.contentType, fileSize: data.fileSize, capturedAt: new Date(), capturedById: data.userId, metadata: { pathname: blob.pathname } } });
        if (data.findingId) await prisma.$transaction([prisma.enterpriseAuditFindingEvidence.create({ data: { findingId: data.findingId, evidenceId: evidence.id, relationshipNote: data.description || null } }), prisma.enterpriseAuditFindingHistory.create({ data: { findingId: data.findingId, userId: data.userId, action: "EVIDENCE_ADDED", title: "Evidence file uploaded", description: data.title } })]);
        await prisma.enterpriseAuditHistory.create({ data: { organizationId: data.organizationId, auditId: data.auditId, userId: data.userId, action: "EVIDENCE_ADDED", entityType: "EnterpriseAuditEvidence", entityId: evidence.id, title: "Audit evidence uploaded", description: data.title } });
      },
    }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Evidence upload failed." }, { status: 400 }); }
}
