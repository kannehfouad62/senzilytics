import { prisma } from "@/lib/prisma";
import {
  DocumentCategory,
  DocumentEntityType,
  DocumentStatus,
} from "@prisma/client";

export type CreateDocumentRecordInput = {
  organizationId: string;
  uploadedById?: string | null;
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
};

export function createDocumentRecord(input: CreateDocumentRecordInput) {
  return prisma.document.create({
    data: {
      organizationId: input.organizationId,
      uploadedById: input.uploadedById,
      entityType: input.entityType,
      entityId: input.entityId,
      category: input.category ?? DocumentCategory.OTHER,
      status: DocumentStatus.ACTIVE,
      name: input.name,
      originalName: input.originalName,
      description: input.description,
      storageKey: input.storageKey,
      storageUrl: input.storageUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
    },
  });
}

export function findTenantDocuments(input: {
  organizationId: string;
  entityType: DocumentEntityType;
  entityId: string;
}) {
  return prisma.document.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: {
        not: DocumentStatus.DELETED,
      },
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export function findTenantDocumentById(input: {
  organizationId: string;
  documentId: string;
}) {
  return prisma.document.findFirst({
    where: {
      id: input.documentId,
      organizationId: input.organizationId,
      status: {
        not: DocumentStatus.DELETED,
      },
    },
    include: {
      uploadedBy: true,
    },
  });
}

export function archiveTenantDocument(input: {
  organizationId: string;
  documentId: string;
}) {
  return prisma.document.updateMany({
    where: {
      id: input.documentId,
      organizationId: input.organizationId,
      status: DocumentStatus.ACTIVE,
    },
    data: {
      status: DocumentStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });
}

export function softDeleteTenantDocument(input: {
  organizationId: string;
  documentId: string;
}) {
  return prisma.document.updateMany({
    where: {
      id: input.documentId,
      organizationId: input.organizationId,
      status: {
        not: DocumentStatus.DELETED,
      },
    },
    data: {
      status: DocumentStatus.DELETED,
      deletedAt: new Date(),
    },
  });
}