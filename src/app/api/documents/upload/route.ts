import {
  registerDocument,
  registerDocumentVersion,
} from "@/core/documents/document.service";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUserPermissions } from "@/lib/permissions";
import {
  ConfigurableFormModule,
  DocumentCategory,
  DocumentEntityType,
  DocumentStatus,
  PermissionKey,
} from "@prisma/client";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSubscriptionFeature } from "@/lib/subscription";
import {
  configurableFormModuleForDocumentEntity,
  isRuntimeFieldVisible,
  runtimeRequiredFileIds,
} from "@/modules/forms/runtime-form.service";

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
  checksum: string;
  replacedDocumentId: string | null;
  configurableSubmissionId: string | null;
  configurableFieldId: string | null;
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

function isSha256Checksum(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{64}$/i.test(value)
  );
}

function parseUploadPayload(
  value: string | null | undefined
): UploadPayload {
  if (!value) {
    throw new Error("Upload information is missing.");
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error("Upload information is not valid JSON.");
  }

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error("Upload information is invalid.");
  }

  const payload = parsedValue as Partial<UploadPayload>;

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
    !Number.isFinite(payload.sizeBytes) ||
    !isSha256Checksum(payload.checksum)
  ) {
    throw new Error("Upload information is incomplete or invalid.");
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
    checksum: payload.checksum.toLowerCase(),
    replacedDocumentId:
      typeof payload.replacedDocumentId === "string" &&
      payload.replacedDocumentId.trim()
        ? payload.replacedDocumentId.trim()
        : null,
    configurableSubmissionId:
      typeof payload.configurableSubmissionId === "string" && payload.configurableSubmissionId.trim()
        ? payload.configurableSubmissionId.trim()
        : null,
    configurableFieldId:
      typeof payload.configurableFieldId === "string" && payload.configurableFieldId.trim()
        ? payload.configurableFieldId.trim()
        : null,
  };
}

async function validateRelatedEntity(input: {
  organizationId: string;
  entityType: DocumentEntityType;
  entityId: string;
}) {
  switch (input.entityType) {
    case DocumentEntityType.SAFETY_OBSERVATION: {
      const record = await prisma.safetyObservation.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }
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
          assignedTo: {
            organizationId:
              input.organizationId,
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

    case DocumentEntityType.PERMIT: {
      const record = await prisma.permit.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.CHEMICAL: {
      const record = await prisma.chemical.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.ENVIRONMENTAL: {
      const record = await prisma.environmentalDataPoint.findFirst({ where: { id: input.entityId, metric: { organizationId: input.organizationId } }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.ESG: {
      const record = await prisma.esgDisclosurePeriod.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.CONTRACTOR: {
      const record = await prisma.contractor.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.PERMIT_TO_WORK: {
      const record = await prisma.permitToWork.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.INDUSTRIAL_HYGIENE: {
      const record = await prisma.exposureAssessment.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.SIF_ASSURANCE: {
      const record = await prisma.criticalControlVerification.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.CERTIFICATION_READINESS: {
      const record = await prisma.certificationManagementReview.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } });
      return Boolean(record);
    }

    case DocumentEntityType.ASSET_SAFETY: {
      const [asset, inspection, maintenance, defect] = await Promise.all([
        prisma.asset.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } }),
        prisma.assetInspection.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } }),
        prisma.assetMaintenanceRecord.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } }),
        prisma.assetDefect.findFirst({ where: { id: input.entityId, organizationId: input.organizationId }, select: { id: true } }),
      ]);
      return Boolean(asset || inspection || maintenance || defect);
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

    case DocumentEntityType.RISK: {
      const record =
        await prisma.risk.findFirst({
          where: {
            id: input.entityId,
            organizationId:
              input.organizationId,
          },
          select: {
            id: true,
          },
        });

      return Boolean(record);
    }

    case DocumentEntityType.MOC: {
      const record =
        await prisma.managementOfChange.findFirst(
          {
            where: {
              id: input.entityId,
              organizationId:
                input.organizationId,
            },
            select: {
              id: true,
            },
          }
        );

      return Boolean(record);
    }

    case DocumentEntityType.OTHER:
      return true;

    default:
      return false;
  }
}

async function validateCustomFormFileTarget(payload: UploadPayload) {
  if (
    !payload.configurableSubmissionId &&
    !payload.configurableFieldId
  ) {
    return;
  }

  const formModule =
    configurableFormModuleForDocumentEntity(
      payload.entityType
    );

  if (
    !payload.configurableSubmissionId ||
    !payload.configurableFieldId ||
    !formModule
  ) {
    throw new Error(
      "Custom-form file information is incomplete."
    );
  }

  const submission =
    await prisma.configurableFormSubmission.findFirst(
      {
        where: {
          id: payload.configurableSubmissionId,
          organizationId:
            payload.organizationId,
          entityType: formModule,
          entityId: payload.entityId,
          version: {
            fields: {
              some: {
                id: payload.configurableFieldId,
                fieldType: "FILE",
              },
            },
          },
        },
        include: {
          version: {
            include: {
              fields: {
                where: {
                  id: payload.configurableFieldId,
                },
              },
            },
          },
          answers: {
            include: {
              field: true,
            },
          },
          fileAnswers: {
            where: {
              fieldId:
                payload.configurableFieldId,
            },
            select: {
              id: true,
            },
          },
        },
      }
    );

  if (!submission) {
    throw new Error(
      "The custom-form attachment field is not valid for this record."
    );
  }

  const targetField =
    submission.version.fields[0];
  const values = new Map(
    submission.answers.map(
      (answer) => [
        answer.field.key,
        answer.value,
      ]
    )
  );

  if (
    !targetField ||
    !isRuntimeFieldVisible(
      targetField.visibilityRule,
      values
    )
  ) {
    throw new Error(
      "This custom-form attachment field is not applicable to the submitted answers."
    );
  }

  if (
    submission.fileAnswers.length
  ) {
    throw new Error(
      "This custom-form attachment field already has a file."
    );
  }
}

async function requireDocumentUploadPermission(
  payload: UploadPayload
) {
  const hasCustomFormTarget =
    Boolean(
      payload.configurableSubmissionId ||
        payload.configurableFieldId
    );

  const permissions =
    await getCurrentUserPermissions();

  if (!hasCustomFormTarget) {
    if (
      !permissions.includes(
        PermissionKey.MANAGE_DOCUMENTS
      )
    ) {
      throw new Error(
        "You do not have permission to upload documents."
      );
    }

    return;
  }

  const formModule =
    configurableFormModuleForDocumentEntity(
      payload.entityType
    );

  let allowed = false;

  switch (formModule) {
    case ConfigurableFormModule.OBSERVATION:
      allowed =
        permissions.includes(
          PermissionKey.CREATE_OBSERVATION
        ) ||
        permissions.includes(
          PermissionKey.MANAGE_OBSERVATIONS
        );
      break;
    case ConfigurableFormModule.INCIDENT:
      allowed =
        permissions.includes(
          PermissionKey.CREATE_INCIDENT
        ) ||
        permissions.includes(
          PermissionKey.UPDATE_INCIDENT
        );
      break;
    case ConfigurableFormModule.INSPECTION:
      allowed = permissions.includes(
        PermissionKey.MANAGE_INSPECTIONS
      );
      break;
    case ConfigurableFormModule.RISK:
      allowed = permissions.includes(
        PermissionKey.MANAGE_RISKS
      );
      break;
    case ConfigurableFormModule.MOC:
      allowed = permissions.includes(
        PermissionKey.MANAGE_MOC
      );
      break;
    case ConfigurableFormModule.CAPA:
      allowed =
        permissions.includes(
          PermissionKey.CREATE_CAPA
        ) ||
        permissions.includes(
          PermissionKey.UPDATE_CAPA
        );
      break;
    case ConfigurableFormModule.COMPLIANCE:
      allowed = permissions.includes(
        PermissionKey.MANAGE_COMPLIANCE
      );
      break;
    case ConfigurableFormModule.TRAINING:
      allowed = permissions.includes(
        PermissionKey.MANAGE_TRAINING
      );
      break;
    case ConfigurableFormModule.CHEMICAL:
      allowed = permissions.includes(
        PermissionKey.MANAGE_CHEMICALS
      );
      break;
    case ConfigurableFormModule.ENVIRONMENTAL:
      allowed = permissions.includes(
        PermissionKey.MANAGE_ENVIRONMENTAL
      );
      break;
    case ConfigurableFormModule.ESG:
      allowed = permissions.includes(
        PermissionKey.MANAGE_ESG
      );
      break;
    case ConfigurableFormModule.CONTRACTOR:
      allowed = permissions.includes(
        PermissionKey.MANAGE_CONTRACTORS
      );
      break;
    case ConfigurableFormModule.PERMIT_TO_WORK:
      allowed = permissions.includes(
        PermissionKey.MANAGE_PERMITS_TO_WORK
      );
      break;
    case ConfigurableFormModule.INDUSTRIAL_HYGIENE:
      allowed = permissions.includes(
        PermissionKey.MANAGE_INDUSTRIAL_HYGIENE
      );
      break;
    case ConfigurableFormModule.SIF_ASSURANCE:
      allowed = permissions.includes(
        PermissionKey.MANAGE_CRITICAL_CONTROLS
      );
      break;
    case ConfigurableFormModule.CERTIFICATION_READINESS:
      allowed = permissions.includes(
        PermissionKey.MANAGE_CERTIFICATION_READINESS
      );
      break;
    case ConfigurableFormModule.ASSET_SAFETY:
      allowed = permissions.includes(
        PermissionKey.MANAGE_ASSETS
      );
      break;
  }

  if (!allowed) {
    throw new Error(
      "You do not have permission to upload this custom-form attachment."
    );
  }
}

async function completeCustomFormFileTarget(payload: UploadPayload, documentId: string) {
  if (!payload.configurableSubmissionId || !payload.configurableFieldId) return;
  await prisma.$transaction(async tx => {
    await tx.configurableFormFileAnswer.upsert({ where: { submissionId_fieldId: { submissionId: payload.configurableSubmissionId!, fieldId: payload.configurableFieldId! } }, update: { documentId }, create: { submissionId: payload.configurableSubmissionId!, fieldId: payload.configurableFieldId!, documentId } });
    const submission = await tx.configurableFormSubmission.findUnique({ where: { id: payload.configurableSubmissionId! }, include: { version: { include: { fields: true } }, answers: { include: { field: true } }, fileAnswers: { select: { fieldId: true } } } });
    if (!submission) throw new Error("The custom-form submission was not found.");
    const linked = new Set(submission.fileAnswers.map(answer => answer.fieldId));
    const values=new Map(submission.answers.map(answer=>[answer.field.key,answer.value]));
    if (runtimeRequiredFileIds(submission.version.fields,values).every(fieldId => linked.has(fieldId))) await tx.configurableFormSubmission.update({ where: { id: submission.id }, data: { status: "SUBMITTED" } });
  });
}

export async function POST(request: Request) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobToken) {
    console.error(
      "Document upload configuration error: BLOB_READ_WRITE_TOKEN is missing."
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
        error: "The upload request body is invalid.",
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

        const payload = parseUploadPayload(clientPayload);
        await requireDocumentUploadPermission(
          payload
        );

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

        await requireSubscriptionFeature(currentUser.organizationId, "DOCUMENT_UPLOAD");

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

        const relatedEntityExists =
          await validateRelatedEntity({
            organizationId: currentUser.organizationId,
            entityType: payload.entityType,
            entityId: payload.entityId,
          });

        if (!relatedEntityExists) {
          throw new Error(
            "The related record does not exist in your organization."
          );
        }

        await validateCustomFormFileTarget(payload);

        if (payload.replacedDocumentId) {
          const documentBeingReplaced =
            await prisma.document.findFirst({
              where: {
                id: payload.replacedDocumentId,
                organizationId: currentUser.organizationId,
                status: {
                  not: DocumentStatus.DELETED,
                },
              },
              select: {
                id: true,
                checksum: true,
                isLatest: true,
                entityType: true,
                entityId: true,
              },
            });

          if (!documentBeingReplaced) {
            throw new Error(
              "The document being replaced was not found."
            );
          }

          if (!documentBeingReplaced.isLatest) {
            throw new Error(
              "Only the latest document version can be replaced."
            );
          }

          if (
            documentBeingReplaced.entityType !==
              payload.entityType ||
            documentBeingReplaced.entityId !== payload.entityId
          ) {
            throw new Error(
              "The replacement file does not belong to the same record."
            );
          }

          if (
            documentBeingReplaced.checksum === payload.checksum
          ) {
            throw new Error(
              "The replacement file is identical to the current version."
            );
          }
        }

        const duplicateDocument =
          await prisma.document.findFirst({
            where: {
              organizationId: currentUser.organizationId,
              entityType: payload.entityType,
              entityId: payload.entityId,
              checksum: payload.checksum,
              status: {
                not: DocumentStatus.DELETED,
              },
              ...(payload.replacedDocumentId
                ? {
                    id: {
                      not: payload.replacedDocumentId,
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              name: true,
            },
          });

        if (duplicateDocument) {
          throw new Error(
            `This exact file already exists as "${duplicateDocument.name}".`
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
            "The upload path does not belong to your organization."
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

      onUploadCompleted: async ({
        blob,
        tokenPayload,
      }) => {
        const payload = parseUploadPayload(tokenPayload);

        const existingBlobDocument =
          await prisma.document.findFirst({
            where: {
              organizationId: payload.organizationId,
              storageKey: blob.pathname,
            },
            select: {
              id: true,
            },
          });

        if (existingBlobDocument) {
          await completeCustomFormFileTarget(payload, existingBlobDocument.id);
          return;
        }

        if (payload.replacedDocumentId) {
          await registerDocumentVersion({
            organizationId: payload.organizationId,
            userId: payload.userId,
            replacedDocumentId: payload.replacedDocumentId,
            name: payload.displayName,
            originalName: payload.originalName,
            description: payload.description,
            storageKey: blob.pathname,
            storageUrl: blob.url,
            mimeType:
              blob.contentType ||
              "application/octet-stream",
            sizeBytes: payload.sizeBytes,
            checksum: payload.checksum,
          });

          return;
        }

        const document = await registerDocument({
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
          checksum: payload.checksum,
        });
        await completeCustomFormFileTarget(payload, document.id);
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
