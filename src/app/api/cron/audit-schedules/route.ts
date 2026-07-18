import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { processAuditSchedules } from "@/modules/audit/audit-schedule-processor.service";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    if (!process.env.CRON_SECRET?.trim()) {
      console.error("Audit schedule cron configuration error: CRON_SECRET is missing.");
    }

    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const processedAt = new Date().toISOString();

  try {
    const result = await processAuditSchedules();

    return NextResponse.json({
      success: true,
      processedAt,
      auditSchedules: result,
    });
  } catch (error) {
    console.error("Audit schedule processing failed:", error);

    return NextResponse.json(
      {
        success: false,
        processedAt,
        error:
          error instanceof Error
            ? error.message
            : "Audit schedule processing failed.",
      },
      { status: 500 }
    );
  }
}
