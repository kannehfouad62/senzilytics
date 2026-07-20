import { processAuditSlaNotifications } from "@/core/notifications/audit-sla.service";
import { processCorrectiveActionSlaNotifications } from "@/core/notifications/corrective-action-sla.service";
import { processIncidentEscalations } from "@/core/notifications/incident-escalation.service";
import { processInspectionSlaNotifications } from "@/core/notifications/inspection-sla.service";
import { processInvestigationSlaNotifications } from "@/core/notifications/investigation-sla.service";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { cleanupExpiredDemoUsers } from "@/features/demo/cleanup.service";
import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: NextRequest
) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization")
    )
  ) {
    if (!process.env.CRON_SECRET?.trim()) {
      console.error(
        "SLA Cron configuration error: CRON_SECRET is missing."
      );
    }

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
      demoResult,
    ] = await Promise.all([
      processWorkflowSlaNotifications(),

      processCorrectiveActionSlaNotifications(),

      processIncidentEscalations(),

      processInvestigationSlaNotifications(),

      processAuditSlaNotifications(),

      processInspectionSlaNotifications(),

      cleanupExpiredDemoUsers(),

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

      demoCleanup:
        demoResult,

      totals: {
        checked:
          workflowResult.checked +
          correctiveActionResult.checked +
          incidentEscalationResult.checked +
          investigationResult.checked +
          auditResult.checked +
          inspectionResult.checked,

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
          inspectionResult.skipped,
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
