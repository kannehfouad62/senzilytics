import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import type { FormSubmissionSearchParams } from "@/modules/forms/form-submission-report";
import { exportFormSubmissionsCsv } from "@/modules/forms/form-submission.service";
import { PermissionKey } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId } = await getCurrentUserTenant();
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(
    url.searchParams.entries(),
  ) as FormSubmissionSearchParams;

  try {
    const csv = await exportFormSubmissionsCsv({
      organizationId,
      searchParams,
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="form-submissions-${date}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    const message =
      cause instanceof Error &&
      cause.message.startsWith("This export exceeds 5,000")
        ? cause.message
        : "The form-submission export could not be generated.";
    return new Response(message, {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
