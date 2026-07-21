import { processMocSlaNotifications } from "@/core/notifications/moc-sla.service";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { processIntegrationWebhookDeliveries } from "@/modules/integrations/webhook-delivery.service";
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
      console.error("CRON_SECRET is missing.");
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

  const processedAt =
    new Date().toISOString();

  try {
    const [
      workflowResult,
      mocResult,
      integrationResult,
    ] = await Promise.all([
      processWorkflowSlaNotifications(),
      processMocSlaNotifications(),
      processIntegrationWebhookDeliveries(),
    ]);

    return NextResponse.json({
      success: true,
      processedAt,

      workflow:
        workflowResult,

      moc:
        mocResult,

      integrations:
        integrationResult,
    });
  } catch (error) {
    console.error(
      "Workflow, MOC, and integration processing failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        processedAt,

        error:
          error instanceof Error
            ? error.message
            : "Scheduled processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}
