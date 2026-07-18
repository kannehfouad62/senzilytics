import { processAuditSlaNotifications } from "@/core/notifications/audit-sla.service";
import { processCorrectiveActionSlaNotifications } from "@/core/notifications/corrective-action-sla.service";
import { processIncidentEscalations } from "@/core/notifications/incident-escalation.service";
import { processInspectionSlaNotifications } from "@/core/notifications/inspection-sla.service";
import { processInvestigationSlaNotifications } from "@/core/notifications/investigation-sla.service";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { processAuditSchedules } from "@/modules/audit/audit-schedule-processor.service";
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

  try {
    const [
      workflowResult,
      correctiveActionResult,
      incidentEscalationResult,
      investigationResult,
      auditResult,
      inspectionResult,
      auditScheduleResult,
    ] = await Promise.all([
      processWorkflowSlaNotifications(),

      processCorrectiveActionSlaNotifications(),

      processIncidentEscalations(),

      processInvestigationSlaNotifications(),

      processAuditSlaNotifications(),

      processInspectionSlaNotifications(),

      processAuditSchedules(),
    ]);

    return NextResponse.json({
      success: true,

      processedAt:
        new Date().toISOString(),

      workflows:
        workflowResult,

      correctiveActions:
        correctiveActionResult,

      incidentEscalations:
        incidentEscalationResult,

      investigations:
        investigationResult,

      audits:
        auditResult,

      inspections:
        inspectionResult,

      auditSchedules:
        auditScheduleResult,

      totals: {
        checked:
          workflowResult.checked +
          correctiveActionResult.checked +
          incidentEscalationResult.checked +
          investigationResult.checked +
          auditResult.checked +
          inspectionResult.checked +
          auditScheduleResult.checked,

        remindersSent:
          workflowResult.remindersSent +
          correctiveActionResult.remindersSent +
          investigationResult.remindersSent +
          auditResult.auditRemindersSent +
          auditResult.findingRemindersSent +
          inspectionResult.inspectionRemindersSent +
          inspectionResult.findingRemindersSent,

        overdueAlertsSent:
          workflowResult.overdueAlertsSent +
          correctiveActionResult.overdueAlertsSent +
          investigationResult.overdueAlertsSent +
          auditResult.auditOverdueAlertsSent +
          auditResult.findingOverdueAlertsSent +
          inspectionResult.inspectionOverdueAlertsSent +
          inspectionResult.findingOverdueAlertsSent,

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

        auditInAppNotificationsSent:
          auditResult
            .inAppNotificationsSent,

        auditEmailsSent:
          auditResult
            .emailsSent,

        inspectionInAppNotificationsSent:
          inspectionResult
            .inAppNotificationsSent,

        inspectionEmailsSent:
          inspectionResult
            .emailsSent,

        skipped:
          workflowResult.skipped +
          correctiveActionResult.skipped +
          incidentEscalationResult.skipped +
          investigationResult.skipped +
          auditResult.skipped +
          inspectionResult.skipped +
          auditScheduleResult.skipped +
          auditScheduleResult.failed,
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
