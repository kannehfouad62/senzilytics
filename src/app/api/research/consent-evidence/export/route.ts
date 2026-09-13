import { NextRequest, NextResponse } from "next/server";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { buildResearchConsentEvidenceCsv } from "@/modules/research/research-governance-monitor.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId } = await getCurrentUserTenant();
  const panelId = request.nextUrl.searchParams.get("panelId")?.slice(0, 100) || null;
  const csv = await buildResearchConsentEvidenceCsv(organizationId, panelId);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="research-consent-evidence-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
