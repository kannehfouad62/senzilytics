import { processCorrectiveActionSlaNotifications } from "@/core/notifications/corrective-action-sla.service";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { NextRequest, NextResponse } from "next/server";

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
      "SLA Cron configuration error: CRON_SECRET is missing."
    );

    return false;
  }

  const authorizationHeader =
    request.headers.get("authorization");

  return (
    authorizationHeader ===
    `Bearer ${cronSecret}`
  );
}

export async function GET(
  request: NextRequest
) {
  if (!isAuthorizedCronRequest(request)) {
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
    const [
      workflowResult,
      correctiveActionResult,
    ] = await Promise.all([
      processWorkflowSlaNotifications(),
      processCorrectiveActionSlaNotifications(),
    ]);

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),

      workflows: workflowResult,

      correctiveActions:
        correctiveActionResult,

      totals: {
        checked:
          workflowResult.checked +
          correctiveActionResult.checked,

        remindersSent:
          workflowResult.remindersSent +
          correctiveActionResult.remindersSent,

        overdueAlertsSent:
          workflowResult.overdueAlertsSent +
          correctiveActionResult.overdueAlertsSent,

        skipped:
          workflowResult.skipped +
          correctiveActionResult.skipped,
      },
    });
  } catch (error) {
    console.error(
      "Scheduled SLA processing failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled SLA processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}