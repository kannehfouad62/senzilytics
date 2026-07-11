import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  ActivityAction,
  DocumentCategory,
  DocumentEntityType,
  DocumentStatus,
} from "@prisma/client";
import {
  archiveTenantDocument,
  createDocumentRecord,
  findDocumentVersionHistory,
  findLatestDocumentVersion,
  findTenantDocumentById,
  findTenantDocuments,
  restoreTenantDocument,
  softDeleteTenantDocument,
} from "./document.repository";
import { prisma } from "@/lib/prisma";

const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
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
]);

export function validateDocumentFile(input: {
  mimeType: string;
  sizeBytes: number;
}) {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error("This file type is not supported.");
  }

  if (input.sizeBytes <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("The maximum supported file size is 25 MB.");
  }
}

export async function registerDocument(input: {
  organizationId: string;
  userId: string;
  entityType: DocumentEntityType;
  entityId: string;
  category?: DocumentCategory;
  name: string;
  originalName: string;
  description?: string | null;
  storageKey: string;
  storageUrl: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string | null;
}) {
  validateDocumentFile({
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const document = await createDocumentRecord({
    organizationId: input.organizationId,
    uploadedById: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    category: input.category,
    name: input.name,
    originalName: input.originalName,
    description: input.description,
    storageKey: input.storageKey,
    storageUrl: input.storageUrl,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    checksum: input.checksum,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "Document",
    entityId: document.id,
    title: "Document uploaded",
    description: document.name,
    metadata: {
      relatedEntityType: input.entityType,
      relatedEntityId: input.entityId,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
    },
  });

  return document;
}

export function getDocumentsForEntity(input: {
  organizationId: string;
  entityType: DocumentEntityType;
  entityId: string;
}) {
  return findTenantDocuments(input);
}

export async function archiveDocument(input: {
  organizationId: string;
  userId: string;
  documentId: string;
}) {
  const document = await findTenantDocumentById({
    organizationId: input.organizationId,
    documentId: input.documentId,
  });

  if (!document) {
    throw new Error("Document not found.");
  }

  await archiveTenantDocument({
    organizationId: input.organizationId,
    documentId: input.documentId,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "Document",
    entityId: document.id,
    title: "Document archived",
    description: document.name,
  });
}

export async function deleteDocument(input: {
  organizationId: string;
  userId: string;
  documentId: string;
}) {
  const document = await findTenantDocumentById({
    organizationId: input.organizationId,
    documentId: input.documentId,
  });

  if (!document) {
    throw new Error("Document not found.");
  }

  await softDeleteTenantDocument({
    organizationId: input.organizationId,
    documentId: input.documentId,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.DELETE,
    entityType: "Document",
    entityId: document.id,
    title: "Document deleted",
    description: document.name,
  });
}

export async function restoreDocument(input: {
  organizationId: string;
  userId: string;
  documentId: string;
}) {
  const document = await findTenantDocumentById({
    organizationId: input.organizationId,
    documentId: input.documentId,
  });

  if (!document) {
    throw new Error("Document not found.");
  }

  if (document.status !== "ARCHIVED") {
    throw new Error("Only archived documents can be restored.");
  }

  const result = await restoreTenantDocument({
    organizationId: input.organizationId,
    documentId: input.documentId,
  });

  if (result.count === 0) {
    throw new Error("The document could not be restored.");
  }

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "Document",
    entityId: document.id,
    title: "Document restored",
    description: document.name,
    metadata: {
      relatedEntityType: document.entityType,
      relatedEntityId: document.entityId,
    },
  });
}

export async function registerDocumentVersion(input: {
  organizationId: string;
  userId: string;
  replacedDocumentId: string;
  name: string;
  originalName: string;
  description?: string | null;
  storageKey: string;
  storageUrl: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}) {
  validateDocumentFile({
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const previousDocument = await findLatestDocumentVersion({
    organizationId: input.organizationId,
    documentId: input.replacedDocumentId,
  });

  if (!previousDocument) {
    throw new Error("The document being replaced was not found.");
  }

  if (!previousDocument.isLatest) {
    throw new Error(
      "Only the latest document version can be replaced."
    );
  }

  if (previousDocument.checksum === input.checksum) {
    throw new Error(
      "The replacement file is identical to the current version."
    );
  }

  const nextVersion = previousDocument.version + 1;

  const document = await prisma.$transaction(async (transaction) => {
    await transaction.document.update({
      where: {
        id: previousDocument.id,
      },
      data: {
        isLatest: false,
      },
    });

    return transaction.document.create({
      data: {
        organizationId: previousDocument.organizationId,
        uploadedById: input.userId,
        entityType: previousDocument.entityType,
        entityId: previousDocument.entityId,
        category: previousDocument.category,
        status: DocumentStatus.ACTIVE,
        name: input.name,
        originalName: input.originalName,
        description:
          input.description ?? previousDocument.description,
        storageKey: input.storageKey,
        storageUrl: input.storageUrl,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
        version: nextVersion,
        versionGroupId: previousDocument.versionGroupId,
        isLatest: true,
      },
    });
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "Document",
    entityId: document.id,
    title: "Document version uploaded",
    description: `${document.name} version ${document.version}`,
    metadata: {
      previousDocumentId: previousDocument.id,
      versionGroupId: document.versionGroupId,
      previousVersion: previousDocument.version,
      newVersion: document.version,
      relatedEntityType: document.entityType,
      relatedEntityId: document.entityId,
    },
  });

  return document;
}

export function getDocumentVersionHistory(input: {
  organizationId: string;
  versionGroupId: string;
}) {
  return findDocumentVersionHistory(input);
}