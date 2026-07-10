import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerDocument } from "@/core/documents/document.service";
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

function parsePayload(
    value: string | null | undefined
  ): UploadPayload {
  if (!value) {
    throw new Error("Upload information is missing.");
  }

  const payload = JSON.parse(value) as Partial<UploadPayload>;

  if (
    !payload.organizationId ||
    !payload.userId ||
    !payload.entityType ||
    !payload.entityId ||
    !payload.category ||
    !payload.displayName ||
    !payload.originalName ||
    typeof payload.sizeBytes !== "number"
  ) {
    throw new Error("Upload information is incomplete.");
  }

  return payload as UploadPayload;
}

async function validateRelatedEntity(input: {
  organizationId: string;
  entityType: DocumentEntityType;
  entityId: string;
}) {
  switch (input.entityType) {
    case DocumentEntityType.INCIDENT: {
      const incident = await prisma.incident.findFirst({
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

      return Boolean(incident);
    }

    case DocumentEntityType.CORRECTIVE_ACTION: {
      const action = await prisma.correctiveAction.findFirst({
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

      return Boolean(action);
    }

    case DocumentEntityType.AUDIT: {
      const audit = await prisma.audit.findFirst({
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

      return Boolean(audit);
    }

    case DocumentEntityType.INSPECTION: {
      const inspection = await prisma.inspection.findFirst({
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

      return Boolean(inspection);
    }

    default:
      return true;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const response = await handleUpload({
      request,
      body,

      onBeforeGenerateToken: async (
        pathname,
        clientPayload
      ) => {
        const session = await auth();

        if (!session?.user?.email) {
          throw new Error("You must be logged in to upload documents.");
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
          throw new Error("Your account is not assigned to an organization.");
        }

        const payload = parsePayload(clientPayload);

        if (
          payload.userId !== currentUser.id ||
          payload.organizationId !== currentUser.organizationId
        ) {
          throw new Error("Invalid document ownership information.");
        }

        if (
          payload.sizeBytes <= 0 ||
          payload.sizeBytes > MAX_FILE_SIZE_BYTES
        ) {
          throw new Error("The file must be between 1 byte and 25 MB.");
        }

        const relatedEntityExists = await validateRelatedEntity({
          organizationId: currentUser.organizationId,
          entityType: payload.entityType,
          entityId: payload.entityId,
        });

        if (!relatedEntityExists) {
          throw new Error(
            "The related record does not exist in your organization."
          );
        }

        return {
          access: "private",
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(payload),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parsePayload(tokenPayload);

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
          mimeType: blob.contentType,
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