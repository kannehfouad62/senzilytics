import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  ActivityAction,
  DocumentCategory,
  DocumentEntityType,
} from "@prisma/client";
import {
  archiveTenantDocument,
  createDocumentRecord,
  findTenantDocumentById,
  findTenantDocuments,
  restoreTenantDocument,
  softDeleteTenantDocument,
} from "./document.repository";

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