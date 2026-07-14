import { processCorrectiveActionSlaNotifications } from "@/core/notifications/corrective-action-sla.service";
import { processIncidentEscalations } from "@/core/notifications/incident-escalation.service";
import { processInvestigationSlaNotifications } from "@/core/notifications/investigation-sla.service";
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
      "SLA Cron configuration error: CRON_SECRET is missing."
    );

    return false;
  }

  const authorizationHeader =
    request.headers.get(
      "authorization"
    );

  return (
    authorizationHeader ===
    `Bearer ${cronSecret}`
  );
}

export async function GET(
  request: NextRequest
) {
  if (
    !isAuthorizedCronRequest(request)
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

  try {
    const [
      workflowResult,
      correctiveActionResult,
      incidentEscalationResult,
      investigationResult,
    ] = await Promise.all([
      processWorkflowSlaNotifications(),
      processCorrectiveActionSlaNotifications(),
      processIncidentEscalations(),
      processInvestigationSlaNotifications(),
    ]);

    return NextResponse.json({
      success: true,
      processedAt:
        new Date().toISOString(),

      workflows: workflowResult,

      correctiveActions:
        correctiveActionResult,

      incidentEscalations:
        incidentEscalationResult,

      investigations:
        investigationResult,

      totals: {
        checked:
          workflowResult.checked +
          correctiveActionResult.checked +
          incidentEscalationResult.checked +
          investigationResult.checked,

        remindersSent:
          workflowResult.remindersSent +
          correctiveActionResult.remindersSent +
          investigationResult.remindersSent,

        overdueAlertsSent:
          workflowResult.overdueAlertsSent +
          correctiveActionResult.overdueAlertsSent +
          investigationResult.overdueAlertsSent,

        incidentEscalationLevelsProcessed:
          incidentEscalationResult
            .escalationLevelsProcessed,

        incidentInAppNotificationsSent:
          incidentEscalationResult
            .inAppNotificationsSent,

        incidentEscalationEmailsSent:
          incidentEscalationResult
            .emailsSent,

        investigationInAppNotificationsSent:
          investigationResult
            .inAppNotificationsSent,

        investigationEmailsSent:
          investigationResult
            .emailsSent,

        skipped:
          workflowResult.skipped +
          correctiveActionResult.skipped +
          incidentEscalationResult.skipped +
          investigationResult.skipped,
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