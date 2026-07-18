import { prisma } from "@/lib/prisma";
import {
  EnterpriseAuditEvidenceType,
  Prisma,
} from "@prisma/client";

export type AuditEvidenceDatabaseClient =
  | typeof prisma
  | Prisma.TransactionClient;

export async function findTenantAuditQuestionEvidenceContext(
  input: {
    organizationId: string;
    auditId: string;
    questionId: string;
  },
  database: AuditEvidenceDatabaseClient = prisma
) {
  return database.enterpriseAuditQuestion.findFirst({
    where: {
      id: input.questionId,
      auditId: input.auditId,
      audit: {
        organizationId: input.organizationId,
      },
    },
    select: {
      id: true,
      auditId: true,
      requireEvidence: true,
      requirePhoto: true,
      response: {
        select: {
          id: true,
        },
      },
      audit: {
        select: {
          id: true,
          organizationId: true,
          status: true,
        },
      },
    },
  });
}

export async function listTenantAuditQuestionEvidence(
  input: {
    organizationId: string;
    auditId: string;
    questionId: string;
  },
  database: AuditEvidenceDatabaseClient = prisma
) {
  return database.enterpriseAuditEvidence.findMany({
    where: {
      organizationId: input.organizationId,
      auditId: input.auditId,
      questionId: input.questionId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      evidenceType: true,
      title: true,
      description: true,
      fileName: true,
      fileUrl: true,
      mimeType: true,
      fileSize: true,
      capturedAt: true,
      createdAt: true,
      capturedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function createTenantAuditQuestionEvidence(
  input: {
    organizationId: string;
    auditId: string;
    questionId: string;
    responseId: string | null;
    capturedById: string;
    evidenceType: EnterpriseAuditEvidenceType;
    title: string;
    description: string | null;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    metadata?: Prisma.InputJsonValue;
  },
  database: AuditEvidenceDatabaseClient = prisma
) {
  return database.enterpriseAuditEvidence.create({
    data: {
      organizationId: input.organizationId,
      auditId: input.auditId,
      questionId: input.questionId,
      responseId: input.responseId,
      capturedById: input.capturedById,
      capturedAt: new Date(),
      evidenceType: input.evidenceType,
      title: input.title,
      description: input.description,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      metadata: input.metadata,
    },
    select: {
      id: true,
      evidenceType: true,
      title: true,
      description: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      capturedAt: true,
      createdAt: true,
      capturedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function findTenantAuditEvidence(
  input: {
    organizationId: string;
    evidenceId: string;
  },
  database: AuditEvidenceDatabaseClient = prisma
) {
  return database.enterpriseAuditEvidence.findFirst({
    where: {
      id: input.evidenceId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      auditId: true,
      questionId: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
    },
  });
}

export async function deleteTenantAuditEvidence(
  evidenceId: string,
  database: AuditEvidenceDatabaseClient = prisma
) {
  return database.enterpriseAuditEvidence.delete({
    where: {
      id: evidenceId,
    },
  });
}
