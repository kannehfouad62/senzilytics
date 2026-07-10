import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");

    return NextResponse.json(
      {
        success: false,
        error: "Cron security is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const result = await processWorkflowSlaNotifications();

    console.log("Workflow SLA processor completed:", result);

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Workflow SLA processor failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Workflow SLA processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}