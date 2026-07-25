import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import {
  DocumentCategory,
  DocumentEntityType,
  OrganizationStatus,
  PermissionKey,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  registerDocument,
  validateDocumentFile,
} from "@/core/documents/document.service";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionFeature } from "@/lib/subscription";
import {
  authenticateMobileRequest,
  MobileAuthError,
} from "@/modules/mobile/mobile-auth.service";
import {
  MAX_MOBILE_EVIDENCE_BYTES,
  MOBILE_EVIDENCE_CONTENT_TYPES,
} from "@/modules/mobile/mobile-evidence.service";
import { getMobileAssignedPermissions } from "@/modules/mobile/mobile-executive.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes = new Set<string>(MOBILE_EVIDENCE_CONTENT_TYPES);
const uploadPayloadSchema = z.object({
  localDocumentId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).optional(),
  category: z.nativeEnum(DocumentCategory),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
      "Document filename is invalid."
    ),
  mimeType: z
    .string()
    .refine(
      (value) => contentTypes.has(value),
      "Document file type is not supported."
    ),
  sizeBytes: z.number().int().min(1).max(MAX_MOBILE_EVIDENCE_BYTES),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

type UploadTokenPayload = z.infer<typeof uploadPayloadSchema> & {
  organizationId: string;
  userId: string;
};

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: "storage_unavailable",
        errorDescription: "Document storage is not configured.",
      },
      { status: 500 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      {
        error: "invalid_request",
        errorDescription: "Document upload request is invalid.",
      },
      { status: 400 }
    );
  }

  try {
    const response = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const [{ user, organization }, payload] = await Promise.all([
          authenticateMobileRequest(request),
          Promise.resolve(parseUploadPayload(clientPayload)),
        ]);
        const permissions = await getMobileAssignedPermissions(user.role);

        if (!permissions.includes(PermissionKey.MANAGE_DOCUMENTS)) {
          throw new Error("Your role cannot upload controlled documents.");
        }
        await requireSubscriptionFeature(
          organization.id,
          "DOCUMENT_UPLOAD"
        );
        validateDocumentFile({
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
        });

        const expectedPath = `mobile-documents/${organization.id}/${payload.localDocumentId}/${payload.fileName}`;
        if (pathname !== expectedPath) {
          throw new Error("Document upload path is invalid.");
        }

        return {
          allowedContentTypes: [...MOBILE_EVIDENCE_CONTENT_TYPES],
          maximumSizeInBytes: MAX_MOBILE_EVIDENCE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({
            ...payload,
            organizationId: organization.id,
            userId: user.id,
          } satisfies UploadTokenPayload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(
          tokenPayload || "null"
        ) as UploadTokenPayload;
        await completeUpload(payload, {
          url: blob.url,
          pathname: blob.pathname,
          contentType: blob.contentType,
        });
      },
    });

    return NextResponse.json(response, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof MobileAuthError)) {
      console.error("Mobile controlled-document upload failed:", error);
    }
    return NextResponse.json(
      {
        error:
          error instanceof MobileAuthError
            ? error.code
            : "document_upload_failed",
        errorDescription:
          error instanceof Error
            ? error.message
            : "Document upload failed.",
      },
      {
        status: error instanceof MobileAuthError ? error.status : 400,
        headers: { "cache-control": "no-store" },
      }
    );
  }
}

function parseUploadPayload(value: string | null | undefined) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value || "null");
  } catch {
    throw new Error("Document upload details are invalid.");
  }
  const parsed = uploadPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ||
        "Document upload details are invalid."
    );
  }
  return parsed.data;
}

async function completeUpload(
  payload: UploadTokenPayload,
  blob: { url: string; pathname: string; contentType: string }
) {
  const expectedPath = `mobile-documents/${payload.organizationId}/${payload.localDocumentId}/${payload.fileName}`;
  if (blob.pathname !== expectedPath) {
    throw new Error("Completed document upload path is invalid.");
  }

  const [user, existing] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: payload.userId,
        organizationId: payload.organizationId,
        isActive: true,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: {
        id: true,
        role: true,
        organization: { select: { subscriptionPlan: true } },
      },
    }),
    prisma.document.findFirst({
      where: {
        organizationId: payload.organizationId,
        storageKey: blob.pathname,
      },
      select: { id: true },
    }),
  ]);

  if (existing) return existing;
  if (!user) {
    throw new Error("The document uploader is no longer authorized.");
  }
  const permissions = await getMobileAssignedPermissions(user.role);
  if (!permissions.includes(PermissionKey.MANAGE_DOCUMENTS)) {
    throw new Error("The document uploader is no longer authorized.");
  }
  await requireSubscriptionFeature(
    payload.organizationId,
    "DOCUMENT_UPLOAD"
  );

  return registerDocument({
    organizationId: payload.organizationId,
    userId: payload.userId,
    entityType: DocumentEntityType.ORGANIZATION,
    entityId: payload.organizationId,
    category: payload.category,
    name: payload.name,
    originalName: payload.fileName,
    description: payload.description || null,
    storageKey: blob.pathname,
    storageUrl: blob.url,
    mimeType: blob.contentType || payload.mimeType,
    sizeBytes: payload.sizeBytes,
    checksum: payload.checksum,
  });
}
