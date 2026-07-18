import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  deleteTenantAuditEvidence,
  findTenantAuditEvidence,
} from "@/modules/audit-v2/audit-evidence.repository";
import {
  EnterpriseAuditHistoryAction,
  PermissionKey,
} from "@prisma/client";
import {
  del,
  get,
} from "@vercel/blob";
import {
  NextRequest,
  NextResponse,
} from "next/server";

function blobPathname(fileUrl: string) {
  return new URL(fileUrl).pathname.replace(
    /^\/+/,
    ""
  );
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      evidenceId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const { evidenceId } =
    await context.params;

  const evidence =
    await findTenantAuditEvidence({
      organizationId,
      evidenceId,
    });

  if (!evidence?.fileUrl) {
    return new NextResponse(
      "Evidence not found.",
      {
        status: 404,
      }
    );
  }

  const result = await get(
    blobPathname(evidence.fileUrl),
    {
      access: "private",
      ifNoneMatch:
        request.headers.get(
          "if-none-match"
        ) ?? undefined,
    }
  );

  if (!result) {
    return new NextResponse(
      "Evidence file not found.",
      {
        status: 404,
      }
    );
  }

  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        "Cache-Control":
          "private, no-cache",
      },
    });
  }

  return new NextResponse(
    result.stream,
    {
      status: 200,
      headers: {
        "Content-Type":
          evidence.mimeType ||
          "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          evidence.fileName ||
            "audit-evidence"
        )}"`,
        "Content-Length": String(
          evidence.fileSize ??
            result.blob.size
        ),
        ETag: result.blob.etag,
        "Cache-Control":
          "private, no-cache",
      },
    }
  );
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      evidenceId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const { evidenceId } =
    await context.params;

  const evidence =
    await findTenantAuditEvidence({
      organizationId,
      evidenceId,
    });

  if (!evidence) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The audit evidence was not found.",
      },
      {
        status: 404,
      }
    );
  }

  await prisma.$transaction(
    async (transaction) => {
      await deleteTenantAuditEvidence(
        evidence.id,
        transaction
      );

      await transaction.enterpriseAuditHistory.create({
        data: {
          organizationId,
          auditId: evidence.auditId,
          userId: user.id,
          action:
            EnterpriseAuditHistoryAction.OTHER,
          entityType:
            "EnterpriseAuditEvidence",
          entityId: evidence.id,
          title:
            "Question evidence deleted",
          description:
            `${evidence.fileName || "Audit evidence"} was removed.`,
          previousValue: {
            evidenceId:
              evidence.id,
            questionId:
              evidence.questionId,
            fileName:
              evidence.fileName,
            mimeType:
              evidence.mimeType,
            fileSize:
              evidence.fileSize,
          },
          metadata: {
            operation:
              "EVIDENCE_DELETED",
          },
        },
      });
    }
  );

  if (evidence.fileUrl) {
    await del(evidence.fileUrl).catch(
      (error) => {
        console.error(
          "The audit evidence record was removed, but Blob cleanup failed:",
          error
        );
      }
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "Audit evidence deleted.",
  });
}
