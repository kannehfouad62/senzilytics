import { processAuditSlaNotifications } from "@/core/notifications/audit-sla.service";
import { processCorrectiveActionSlaNotifications } from "@/core/notifications/corrective-action-sla.service";
import { processIncidentEscalations } from "@/core/notifications/incident-escalation.service";
import { processInspectionSlaNotifications } from "@/core/notifications/inspection-sla.service";
import { processInvestigationSlaNotifications } from "@/core/notifications/investigation-sla.service";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { processWorkflowAutomationEvents } from "@/core/workflow/workflow-automation-event.service";
import { processWorkflowOutcomeExecutions } from "@/core/workflow/workflow-outcome.service";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { cleanupExpiredDemoUsers } from "@/features/demo/cleanup.service";
import { processIntegrationWebhookDeliveries } from "@/modules/integrations/webhook-delivery.service";
import { processMobilePushDeliveries } from "@/modules/mobile/mobile-push.service";
import { runTrackedScheduledJob } from "@/modules/platform/scheduled-job-monitor.service";
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
    return await runTrackedScheduledJob("workflow-sla", async () => {
      const workflowAutomationResult =
        await processWorkflowAutomationEvents();
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
    const workflowOutcomeResult =
      await processWorkflowOutcomeExecutions();
    const [integrationResult, mobilePushResult] = await Promise.all([
      processIntegrationWebhookDeliveries(),
      processMobilePushDeliveries(),
    ]);

      return NextResponse.json({
      success: true,

      processedAt:
        new Date().toISOString(),

      workflows:
        workflowResult,

      workflowAutomation:
        workflowAutomationResult,

      workflowOutcomes:
        workflowOutcomeResult,

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

      integrations:
        integrationResult,

      mobilePush:
        mobilePushResult,

      totals: {
        checked:
          workflowAutomationResult.checked +
          workflowResult.checked +
          workflowOutcomeResult.checked +
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
          workflowAutomationResult.skipped +
          workflowResult.skipped +
          workflowOutcomeResult.skipped +
          correctiveActionResult.skipped +
          incidentEscalationResult.skipped +
          investigationResult.skipped +
          auditResult.skipped +
          inspectionResult.skipped,

        automationEventsProcessed:
          workflowAutomationResult.processed,

        workflowsStarted:
          workflowAutomationResult.workflowsStarted,

        automationEventsFailed:
          workflowAutomationResult.failed,

        workflowOutcomesCompleted:
          workflowOutcomeResult.completed,

        workflowOutcomesFailed:
          workflowOutcomeResult.failed,

        workflowOutcomeApprovalRequests:
          workflowOutcomeResult.approvalRequestsSent,
      },
      });
    }, (response) => ({ httpStatus: response.status }));
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
