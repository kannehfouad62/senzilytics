import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { NextResponse } from "next/server";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_AUDITS); const [{ id }, { organizationId }] = await Promise.all([params, getCurrentUserTenant()]);
  const evidence = await prisma.enterpriseAuditEvidence.findFirst({ where: { id, organizationId }, select: { fileUrl: true, fileName: true, mimeType: true } });
  if (!evidence?.fileUrl) return NextResponse.json({ error: "Evidence file not found." }, { status: 404 });
  const result = await get(evidence.fileUrl, { access: "private" }); if (!result || result.statusCode !== 200) return NextResponse.json({ error: "Evidence file is unavailable." }, { status: 404 });
  return new Response(result.stream, { headers: { "Content-Type": evidence.mimeType || result.blob.contentType || "application/octet-stream", "Content-Disposition": `inline; filename="${(evidence.fileName || "audit-evidence").replaceAll('"', "")}"`, "Cache-Control": "private, no-store" } });
}
