import { processMocSlaNotifications } from "@/core/notifications/moc-sla.service";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorizedCronRequest(
  request: NextRequest
) {
  const cronSecret =
    process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is missing."
    );

    return false;
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  return (
    authorization ===
    `Bearer ${cronSecret}`
  );
}

export async function GET(
  request: NextRequest
) {
  if (
    !isAuthorizedCronRequest(
      request
    )
  ) {
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

  const processedAt =
    new Date().toISOString();

  try {
    const [
      workflowResult,
      mocResult,
    ] = await Promise.all([
      processWorkflowSlaNotifications(),
      processMocSlaNotifications(),
    ]);

    return NextResponse.json({
      success: true,
      processedAt,

      workflow:
        workflowResult,

      moc:
        mocResult,
    });
  } catch (error) {
    console.error(
      "Workflow and MOC SLA cron failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        processedAt,

        error:
          error instanceof Error
            ? error.message
            : "SLA processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}