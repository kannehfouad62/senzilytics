import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  createTenantAuditQuestionEvidence,
  findTenantAuditQuestionEvidenceContext,
  listTenantAuditQuestionEvidence,
} from "@/modules/audit-v2/audit-evidence.repository";
import {
  EnterpriseAuditEvidenceType,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditStatus,
  PermissionKey,
} from "@prisma/client";
import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_SERVER_UPLOAD_BYTES = 4 * 1024 * 1024;

const LOCKED_AUDIT_STATUSES =
  new Set<EnterpriseAuditStatus>([
    EnterpriseAuditStatus.COMPLETED,
    EnterpriseAuditStatus.CANCELLED,
    EnterpriseAuditStatus.CLOSED,
  ]);

function cleanFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function evidenceTypeFor(file: File) {
  if (file.type.startsWith("image/")) {
    return EnterpriseAuditEvidenceType.PHOTO;
  }

  if (file.type.startsWith("video/")) {
    return EnterpriseAuditEvidenceType.VIDEO;
  }

  if (file.type.startsWith("audio/")) {
    return EnterpriseAuditEvidenceType.AUDIO;
  }

  return EnterpriseAuditEvidenceType.DOCUMENT;
}

function serializeEvidence(
  evidence: Awaited<
    ReturnType<
      typeof listTenantAuditQuestionEvidence
    >
  >[number]
) {
  return {
    ...evidence,
    capturedAt:
      evidence.capturedAt?.toISOString() ??
      null,
    createdAt:
      evidence.createdAt.toISOString(),
    downloadUrl: `/api/audit-management/audit-evidence/${evidence.id}`,
  };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      auditId: string;
      questionId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const { auditId, questionId } =
    await context.params;

  const question =
    await findTenantAuditQuestionEvidenceContext({
      organizationId,
      auditId,
      questionId,
    });

  if (!question) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The audit question was not found.",
      },
      {
        status: 404,
      }
    );
  }

  const evidence =
    await listTenantAuditQuestionEvidence({
      organizationId,
      auditId,
      questionId,
    });

  return NextResponse.json({
    success: true,
    evidence: evidence.map(
      serializeEvidence
    ),
  });
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      auditId: string;
      questionId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const { auditId, questionId } =
    await context.params;

  const question =
    await findTenantAuditQuestionEvidenceContext({
      organizationId,
      auditId,
      questionId,
    });

  if (!question) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The audit question was not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    LOCKED_AUDIT_STATUSES.has(
      question.audit.status
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Evidence cannot be changed after the audit is locked.",
      },
      {
        status: 409,
      }
    );
  }

  const formData =
    await request.formData();

  const fileValue =
    formData.get("file");

  if (!(fileValue instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Select an evidence file.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    fileValue.size <= 0 ||
    fileValue.size >
      MAX_SERVER_UPLOAD_BYTES
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The file must be larger than 0 bytes and no more than 4 MB.",
      },
      {
        status: 413,
      }
    );
  }

  if (
    question.requirePhoto &&
    !fileValue.type.startsWith("image/")
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "This question requires photographic evidence.",
      },
      {
        status: 400,
      }
    );
  }

  const title =
    String(
      formData.get("title") ??
        fileValue.name
    ).trim() || fileValue.name;

  const description =
    String(
      formData.get("description") ?? ""
    ).trim() || null;

  const pathname = [
    "enterprise-audits",
    organizationId,
    auditId,
    questionId,
    `${Date.now()}-${cleanFileName(
      fileValue.name
    )}`,
  ].join("/");

  const blob = await put(
    pathname,
    fileValue,
    {
      access: "private",
      addRandomSuffix: true,
      contentType:
        fileValue.type ||
        "application/octet-stream",
    }
  );

  try {
    const evidence =
      await createTenantAuditQuestionEvidence({
        organizationId,
        auditId,
        questionId,
        responseId:
          question.response?.id ?? null,
        capturedById: user.id,
        evidenceType:
          evidenceTypeFor(fileValue),
        title,
        description,
        fileName: fileValue.name,
        fileUrl: blob.url,
        mimeType:
          fileValue.type ||
          "application/octet-stream",
        fileSize: fileValue.size,
        metadata: {
          blobPathname: blob.pathname,
          blobContentDisposition:
            blob.contentDisposition,
        },
      });

    await prisma.enterpriseAuditHistory.create({
      data: {
        organizationId,
        auditId,
        userId: user.id,
        action:
          EnterpriseAuditHistoryAction.EVIDENCE_ADDED,
        entityType:
          "EnterpriseAuditEvidence",
        entityId: evidence.id,
        title:
          "Question evidence added",
        description:
          `${fileValue.name} was attached to an audit question.`,
        newValue: {
          evidenceId: evidence.id,
          questionId,
          responseId:
            question.response?.id ?? null,
          evidenceType:
            evidence.evidenceType,
          fileName:
            evidence.fileName,
          mimeType:
            evidence.mimeType,
          fileSize:
            evidence.fileSize,
        },
        metadata: {
          blobPathname:
            blob.pathname,
          requiredEvidence:
            question.requireEvidence,
          requiredPhoto:
            question.requirePhoto,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Audit evidence uploaded.",
        evidence: {
          ...evidence,
          capturedAt:
            evidence.capturedAt?.toISOString() ??
            null,
          createdAt:
            evidence.createdAt.toISOString(),
          downloadUrl: `/api/audit-management/audit-evidence/${evidence.id}`,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    await del(blob.url).catch(
      (cleanupError) => {
        console.error(
          "Unable to remove orphaned audit evidence blob:",
          cleanupError
        );
      }
    );

    throw error;
  }
}
