import { registerDocument } from "@/core/documents/document.service";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DocumentCategory,
  DocumentEntityType,
} from "@prisma/client";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "text/plain",
  "text/csv",
];

type UploadPayload = {
  organizationId: string;
  userId: string;
  entityType: DocumentEntityType;
  entityId: string;
  category: DocumentCategory;
  displayName: string;
  originalName: string;
  description: string | null;
  sizeBytes: number;
};

function isDocumentEntityType(
  value: unknown
): value is DocumentEntityType {
  return (
    typeof value === "string" &&
    Object.values(DocumentEntityType).includes(
      value as DocumentEntityType
    )
  );
}

function isDocumentCategory(
  value: unknown
): value is DocumentCategory {
  return (
    typeof value === "string" &&
    Object.values(DocumentCategory).includes(
      value as DocumentCategory
    )
  );
}

function parseUploadPayload(
  value: string | null | undefined
): UploadPayload {
  if (!value) {
    throw new Error("Upload information is missing.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Upload information is invalid.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("Upload information is invalid.");
  }

  const payload = parsed as Partial<UploadPayload>;

  if (
    typeof payload.organizationId !== "string" ||
    !payload.organizationId.trim() ||
    typeof payload.userId !== "string" ||
    !payload.userId.trim() ||
    !isDocumentEntityType(payload.entityType) ||
    typeof payload.entityId !== "string" ||
    !payload.entityId.trim() ||
    !isDocumentCategory(payload.category) ||
    typeof payload.displayName !== "string" ||
    !payload.displayName.trim() ||
    typeof payload.originalName !== "string" ||
    !payload.originalName.trim() ||
    typeof payload.sizeBytes !== "number" ||
    !Number.isFinite(payload.sizeBytes)
  ) {
    throw new Error("Upload information is incomplete.");
  }

  return {
    organizationId: payload.organizationId.trim(),
    userId: payload.userId.trim(),
    entityType: payload.entityType,
    entityId: payload.entityId.trim(),
    category: payload.category,
    displayName: payload.displayName.trim(),
    originalName: payload.originalName.trim(),
    description:
      typeof payload.description === "string" &&
      payload.description.trim()
        ? payload.description.trim()
        : null,
    sizeBytes: payload.sizeBytes,
  };
}

async function validateRelatedEntity(input: {
  organizationId: string;
  entityType: DocumentEntityType;
  entityId: string;
}) {
  switch (input.entityType) {
    case DocumentEntityType.INCIDENT: {
      const record = await prisma.incident.findFirst({
        where: {
          id: input.entityId,
          site: {
            organizationId: input.organizationId,
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.INVESTIGATION: {
      const record = await prisma.investigation.findFirst({
        where: {
          id: input.entityId,
          incident: {
            site: {
              organizationId: input.organizationId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.CORRECTIVE_ACTION: {
      const record = await prisma.correctiveAction.findFirst({
        where: {
          id: input.entityId,
          incident: {
            site: {
              organizationId: input.organizationId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.AUDIT: {
      const record = await prisma.audit.findFirst({
        where: {
          id: input.entityId,
          site: {
            organizationId: input.organizationId,
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.AUDIT_FINDING: {
      const record = await prisma.auditFinding.findFirst({
        where: {
          id: input.entityId,
          audit: {
            site: {
              organizationId: input.organizationId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.INSPECTION: {
      const record = await prisma.inspection.findFirst({
        where: {
          id: input.entityId,
          site: {
            organizationId: input.organizationId,
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.INSPECTION_FINDING: {
      const record = await prisma.inspectionFinding.findFirst({
        where: {
          id: input.entityId,
          inspection: {
            site: {
              organizationId: input.organizationId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.COMPLIANCE: {
      const record = await prisma.complianceItem.findFirst({
        where: {
          id: input.entityId,
          site: {
            organizationId: input.organizationId,
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.TRAINING: {
      const record = await prisma.trainingRecord.findFirst({
        where: {
          id: input.entityId,
          user: {
            organizationId: input.organizationId,
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.WORKFLOW: {
      const record = await prisma.workflowInstance.findFirst({
        where: {
          id: input.entityId,
          organizationId: input.organizationId,
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.ORGANIZATION:
      return input.entityId === input.organizationId;

    case DocumentEntityType.SITE: {
      const record = await prisma.site.findFirst({
        where: {
          id: input.entityId,
          organizationId: input.organizationId,
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.USER: {
      const record = await prisma.user.findFirst({
        where: {
          id: input.entityId,
          organizationId: input.organizationId,
        },
        select: {
          id: true,
        },
      });

      return Boolean(record);
    }

    case DocumentEntityType.OTHER:
      return true;

    default:
      return false;
  }
}

export async function POST(
  request: Request
): Promise<NextResponse> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobToken) {
    console.error(
      "BLOB_READ_WRITE_TOKEN is missing from the deployment environment."
    );

    return NextResponse.json(
      {
        error:
          "Document storage is not configured. BLOB_READ_WRITE_TOKEN is missing.",
      },
      {
        status: 500,
      }
    );
  }

  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid upload request body.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const response = await handleUpload({
      request,
      body,
      token: blobToken,

      onBeforeGenerateToken: async (
        pathname,
        clientPayload
      ) => {
        const session = await auth();

        if (!session?.user?.email) {
          throw new Error(
            "You must be logged in to upload documents."
          );
        }

        const currentUser = await prisma.user.findUnique({
          where: {
            email: session.user.email,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

        if (!currentUser?.organizationId) {
          throw new Error(
            "Your account is not assigned to an organization."
          );
        }

        const payload = parseUploadPayload(clientPayload);

        if (payload.userId !== currentUser.id) {
          throw new Error("The upload user is invalid.");
        }

        if (
          payload.organizationId !==
          currentUser.organizationId
        ) {
          throw new Error(
            "The upload organization is invalid."
          );
        }

        if (
          payload.sizeBytes <= 0 ||
          payload.sizeBytes > MAX_FILE_SIZE_BYTES
        ) {
          throw new Error(
            "The file must be between 1 byte and 25 MB."
          );
        }

        const entityExists = await validateRelatedEntity({
          organizationId: currentUser.organizationId,
          entityType: payload.entityType,
          entityId: payload.entityId,
        });

        if (!entityExists) {
          throw new Error(
            "The related record was not found in your organization."
          );
        }

        const duplicateDocument = await prisma.document.findFirst({
          where: {
            organizationId: currentUser.organizationId,
            entityType: payload.entityType,
            entityId: payload.entityId,
            originalName: payload.originalName,
            sizeBytes: payload.sizeBytes,
            status: {
              not: "DELETED",
            },
          },
          select: {
            id: true,
          },
        });
        
        if (duplicateDocument) {
          throw new Error(
            "A document with the same filename and file size already exists for this record."
          );
        }

        const requiredPathPrefix =
          `${currentUser.organizationId}/`.toLowerCase();

        if (
          !pathname
            .toLowerCase()
            .startsWith(requiredPathPrefix)
        ) {
          throw new Error(
            "The upload path is outside your organization."
          );
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },

      onUploadCompleted: async ({
        blob,
        tokenPayload,
      }) => {
        const payload = parseUploadPayload(tokenPayload);

        const existingDocument =
          await prisma.document.findFirst({
            where: {
              organizationId: payload.organizationId,
              storageKey: blob.pathname,
            },
            select: {
              id: true,
            },
          });

        if (existingDocument) {
          return;
        }

        await registerDocument({
          organizationId: payload.organizationId,
          userId: payload.userId,
          entityType: payload.entityType,
          entityId: payload.entityId,
          category: payload.category,
          name: payload.displayName,
          originalName: payload.originalName,
          description: payload.description,
          storageKey: blob.pathname,
          storageUrl: blob.url,
          mimeType:
            blob.contentType ||
            "application/octet-stream",
          sizeBytes: payload.sizeBytes,
          checksum: blob.etag,
        });
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Document upload failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Document upload failed.",
      },
      {
        status: 400,
      }
    );
  }
}