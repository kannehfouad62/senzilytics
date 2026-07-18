import { prisma } from "@/lib/prisma";
import {
  EnterpriseAuditFindingCategory,
  EnterpriseAuditFindingStatus,
  EnterpriseAuditFindingType,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditQuestionStatus,
  EnterpriseAuditResponseResult,
  EnterpriseAuditSectionStatus,
  EnterpriseAuditSeverity,
  Prisma,
} from "@prisma/client";

export type AuditExecutionDatabaseClient =
  | typeof prisma
  | Prisma.TransactionClient;

export type EnterpriseAuditResponseWriteInput = {
  auditId: string;
  questionId: string;
  answeredById: string | null;
  result: EnterpriseAuditResponseResult;
  responseText: string | null;
  numericValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
  selectedOptionValues: Prisma.InputJsonValue | null;
  comments: string | null;
  scoreAwarded: Prisma.Decimal | null;
  maximumScore: Prisma.Decimal | null;
  isCompliant: boolean | null;
  requiresFollowUp: boolean;
  answeredAt: Date | null;
};

export type EnterpriseAuditSectionProgressInput = {
  sectionId: string;
  status: EnterpriseAuditSectionStatus;
  answeredQuestionCount: number;
  failedQuestionCount: number;
  achievedScore: Prisma.Decimal | null;
  maximumPossibleScore: Prisma.Decimal | null;
  scorePercentage: Prisma.Decimal | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export type EnterpriseAuditFindingCreateInput = {
  organizationId: string;
  auditId: string;
  questionId?: string | null;
  responseId?: string | null;
  reference: string;
  title: string;
  findingType?: EnterpriseAuditFindingType;
  category?: EnterpriseAuditFindingCategory;
  severity?: EnterpriseAuditSeverity;
  status?: EnterpriseAuditFindingStatus;
  description?: string | null;
  objectiveEvidence?: string | null;
  standardClause?: string | null;
  regulatoryRef?: string | null;
  ownerId?: string | null;
  dueDate?: Date | null;
  requiresCapa?: boolean;
  requiresRiskReview?: boolean;
  capaSuggestedAt?: Date | null;
  riskSuggestedAt?: Date | null;
  createdById?: string | null;
  updatedById?: string | null;
};

export type EnterpriseAuditHistoryCreateInput = {
  organizationId: string;
  auditId: string;
  userId?: string | null;
  action: EnterpriseAuditHistoryAction;
  entityType: string;
  entityId?: string | null;
  title: string;
  description?: string | null;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
};

const enterpriseAuditExecutionQuestionSelect = {
  id: true,
  auditId: true,
  sectionId: true,
  questionText: true,
  description: true,
  guidance: true,
  standardClause: true,
  regulatoryRef: true,
  responseType: true,
  sequence: true,
  weight: true,
  isRequired: true,
  isActive: true,
  allowNotApplicable: true,
  requireComment: true,
  requireEvidence: true,
  requirePhoto: true,
  minimumNumericValue: true,
  maximumNumericValue: true,
  minimumPassingScore: true,
  maximumScore: true,
  findingTrigger: true,
  defaultSeverity: true,
  automaticallyCreateFinding: true,
  automaticallySuggestCapa: true,
  automaticallySuggestRisk: true,
  findingTitleTemplate: true,
  findingDescriptionTemplate: true,
  aiGuidance: true,
  status: true,
  options: {
    orderBy: {
      sequence: "asc" as const,
    },
    select: {
      id: true,
      label: true,
      value: true,
      description: true,
      sequence: true,
      scoreValue: true,
      isPassing: true,
      triggersFinding: true,
      findingSeverity: true,
    },
  },
  response: {
    select: {
      id: true,
      auditId: true,
      questionId: true,
      answeredById: true,
      result: true,
      responseText: true,
      numericValue: true,
      booleanValue: true,
      selectedOptionValues: true,
      comments: true,
      scoreAwarded: true,
      maximumScore: true,
      isCompliant: true,
      requiresFollowUp: true,
      answeredAt: true,
      reviewedAt: true,
      reviewedById: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          evidence: true,
          findings: true,
        },
      },
    },
  },
  _count: {
    select: {
      evidence: true,
      findings: true,
    },
  },
} satisfies Prisma.EnterpriseAuditQuestionSelect;

export async function findTenantEnterpriseAuditExecutionContext(
  input: {
    organizationId: string;
    auditId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAudit.findFirst({
    where: {
      id: input.auditId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      reference: true,
      title: true,
      status: true,
      siteId: true,
      departmentId: true,
      leadAuditorId: true,
      ownerId: true,
      totalQuestionCount: true,
      answeredQuestionCount: true,
      failedQuestionCount: true,
      maximumPossibleScore: true,
      achievedScore: true,
      scorePercentage: true,
      startedAt: true,
      completedAt: true,
      sections: {
        where: {
          isActive: true,
        },
        orderBy: {
          sequence: "asc",
        },
        select: {
          id: true,
          auditId: true,
          title: true,
          sequence: true,
          weight: true,
          status: true,
          isRequired: true,
          isActive: true,
          totalQuestionCount: true,
          answeredQuestionCount: true,
          failedQuestionCount: true,
          maximumPossibleScore: true,
          achievedScore: true,
          scorePercentage: true,
          startedAt: true,
          completedAt: true,
          questions: {
            where: {
              isActive: true,
            },
            orderBy: {
              sequence: "asc",
            },
            select: enterpriseAuditExecutionQuestionSelect,
          },
        },
      },
      teamMembers: {
        select: {
          id: true,
          userId: true,
          role: true,
          isRequired: true,
          canEdit: true,
          canReview: true,
        },
      },
    },
  });
}

export async function findTenantEnterpriseAuditQuestionForExecution(
  input: {
    organizationId: string;
    auditId: string;
    questionId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditQuestion.findFirst({
    where: {
      id: input.questionId,
      auditId: input.auditId,
      audit: {
        organizationId: input.organizationId,
      },
      isActive: true,
    },
    select: enterpriseAuditExecutionQuestionSelect,
  });
}

export async function findTenantEnterpriseAuditSectionForExecution(
  input: {
    organizationId: string;
    auditId: string;
    sectionId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditSection.findFirst({
    where: {
      id: input.sectionId,
      auditId: input.auditId,
      audit: {
        organizationId: input.organizationId,
      },
      isActive: true,
    },
    select: {
      id: true,
      auditId: true,
      title: true,
      sequence: true,
      weight: true,
      status: true,
      isRequired: true,
      totalQuestionCount: true,
      answeredQuestionCount: true,
      failedQuestionCount: true,
      maximumPossibleScore: true,
      achievedScore: true,
      scorePercentage: true,
      startedAt: true,
      completedAt: true,
      questions: {
        where: {
          isActive: true,
        },
        orderBy: {
          sequence: "asc",
        },
        select: enterpriseAuditExecutionQuestionSelect,
      },
    },
  });
}

export async function findEnterpriseAuditResponseByQuestion(
  input: {
    auditId: string;
    questionId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditResponse.findFirst({
    where: {
      auditId: input.auditId,
      questionId: input.questionId,
    },
    include: {
      evidence: true,
      findings: true,
    },
  });
}

export async function upsertEnterpriseAuditResponse(
  input: EnterpriseAuditResponseWriteInput,
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditResponse.upsert({
    where: {
      questionId: input.questionId,
    },
    create: {
      auditId: input.auditId,
      questionId: input.questionId,
      answeredById: input.answeredById,
      result: input.result,
      responseText: input.responseText,
      numericValue: input.numericValue,
      booleanValue: input.booleanValue,
      selectedOptionValues:
        input.selectedOptionValues === null
          ? Prisma.JsonNull
          : input.selectedOptionValues,
      comments: input.comments,
      scoreAwarded: input.scoreAwarded,
      maximumScore: input.maximumScore,
      isCompliant: input.isCompliant,
      requiresFollowUp: input.requiresFollowUp,
      answeredAt: input.answeredAt,
    },
    update: {
      answeredById: input.answeredById,
      result: input.result,
      responseText: input.responseText,
      numericValue: input.numericValue,
      booleanValue: input.booleanValue,
      selectedOptionValues:
        input.selectedOptionValues === null
          ? Prisma.JsonNull
          : input.selectedOptionValues,
      comments: input.comments,
      scoreAwarded: input.scoreAwarded,
      maximumScore: input.maximumScore,
      isCompliant: input.isCompliant,
      requiresFollowUp: input.requiresFollowUp,
      answeredAt: input.answeredAt,
    },
  });
}

export async function updateEnterpriseAuditQuestionStatus(
  input: {
    questionId: string;
    status: EnterpriseAuditQuestionStatus;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditQuestion.update({
    where: {
      id: input.questionId,
    },
    data: {
      status: input.status,
    },
  });
}

export async function countEnterpriseAuditQuestionEvidence(
  input: {
    auditId: string;
    questionId: string;
    responseId?: string | null;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditEvidence.count({
    where: {
      auditId: input.auditId,
      OR: [
        {
          questionId: input.questionId,
        },
        ...(input.responseId
          ? [
              {
                responseId: input.responseId,
              },
            ]
          : []),
      ],
    },
  });
}

export async function countEnterpriseAuditQuestionPhotos(
  input: {
    auditId: string;
    questionId: string;
    responseId?: string | null;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditEvidence.count({
    where: {
      auditId: input.auditId,
      evidenceType: "PHOTO",
      OR: [
        {
          questionId: input.questionId,
        },
        ...(input.responseId
          ? [
              {
                responseId: input.responseId,
              },
            ]
          : []),
      ],
    },
  });
}

export async function getEnterpriseAuditSectionResponseSummary(
  input: {
    auditId: string;
    sectionId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  const questions =
    await database.enterpriseAuditQuestion.findMany({
      where: {
        auditId: input.auditId,
        sectionId: input.sectionId,
        isActive: true,
      },
      orderBy: {
        sequence: "asc",
      },
      select: {
        id: true,
        isRequired: true,
        status: true,
        maximumScore: true,
        response: {
          select: {
            id: true,
            result: true,
            scoreAwarded: true,
            maximumScore: true,
            isCompliant: true,
            requiresFollowUp: true,
            answeredAt: true,
          },
        },
      },
    });

  return questions;
}

export async function updateEnterpriseAuditSectionProgress(
  input: EnterpriseAuditSectionProgressInput,
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditSection.update({
    where: {
      id: input.sectionId,
    },
    data: {
      status: input.status,
      answeredQuestionCount:
        input.answeredQuestionCount,
      failedQuestionCount:
        input.failedQuestionCount,
      achievedScore: input.achievedScore,
      maximumPossibleScore:
        input.maximumPossibleScore,
      scorePercentage: input.scorePercentage,
      ...(input.startedAt === undefined
        ? {}
        : {
            startedAt: input.startedAt,
          }),
      ...(input.completedAt === undefined
        ? {}
        : {
            completedAt: input.completedAt,
          }),
    },
  });
}

export async function getEnterpriseAuditResponseSummary(
  input: {
    auditId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditQuestion.findMany({
    where: {
      auditId: input.auditId,
      isActive: true,
    },
    orderBy: [
      {
        section: {
          sequence: "asc",
        },
      },
      {
        sequence: "asc",
      },
    ],
    select: {
      id: true,
      sectionId: true,
      isRequired: true,
      status: true,
      maximumScore: true,
      response: {
        select: {
          id: true,
          result: true,
          scoreAwarded: true,
          maximumScore: true,
          isCompliant: true,
          requiresFollowUp: true,
          answeredAt: true,
        },
      },
    },
  });
}

export async function updateEnterpriseAuditExecutionMetrics(
  input: {
    auditId: string;
    data: Prisma.EnterpriseAuditUpdateInput;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAudit.update({
    where: {
      id: input.auditId,
    },
    data: input.data,
  });
}

export async function findEnterpriseAuditFindingForResponse(
  input: {
    auditId: string;
    questionId: string;
    responseId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.findFirst({
    where: {
      auditId: input.auditId,
      questionId: input.questionId,
      responseId: input.responseId,
      status: {
        notIn: [
          EnterpriseAuditFindingStatus.REJECTED,
          EnterpriseAuditFindingStatus.CANCELLED,
        ],
      },
    },
  });
}

export async function createEnterpriseAuditFinding(
  input: EnterpriseAuditFindingCreateInput,
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.create({
    data: {
      organizationId: input.organizationId,
      auditId: input.auditId,
      questionId: input.questionId ?? null,
      responseId: input.responseId ?? null,
      reference: input.reference,
      title: input.title,
      findingType:
        input.findingType ??
        EnterpriseAuditFindingType.NONCONFORMITY,
      category:
        input.category ??
        EnterpriseAuditFindingCategory.OTHER,
      severity:
        input.severity ??
        EnterpriseAuditSeverity.MEDIUM,
      status:
        input.status ??
        EnterpriseAuditFindingStatus.DRAFT,
      description: input.description ?? null,
      objectiveEvidence:
        input.objectiveEvidence ?? null,
      standardClause:
        input.standardClause ?? null,
      regulatoryRef:
        input.regulatoryRef ?? null,
      ownerId: input.ownerId ?? null,
      dueDate: input.dueDate ?? null,
      requiresCapa: input.requiresCapa ?? false,
      requiresRiskReview:
        input.requiresRiskReview ?? false,
      capaSuggestedAt:
        input.capaSuggestedAt ?? null,
      riskSuggestedAt:
        input.riskSuggestedAt ?? null,
      createdById:
        input.createdById ?? null,
      updatedById:
        input.updatedById ?? null,
    },
  });
}

export async function updateEnterpriseAuditFinding(
  input: {
    findingId: string;
    data: Prisma.EnterpriseAuditFindingUpdateInput;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.update({
    where: {
      id: input.findingId,
    },
    data: input.data,
  });
}

export async function countEnterpriseAuditFindings(
  input: {
    auditId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.count({
    where: {
      auditId: input.auditId,
      status: {
        notIn: [
          EnterpriseAuditFindingStatus.REJECTED,
          EnterpriseAuditFindingStatus.CANCELLED,
        ],
      },
    },
  });
}

export async function getNextEnterpriseAuditFindingSequence(
  input: {
    organizationId: string;
    auditId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  const count =
    await database.enterpriseAuditFinding.count({
      where: {
        organizationId: input.organizationId,
        auditId: input.auditId,
      },
    });

  return count + 1;
}

export async function createEnterpriseAuditHistory(
  input: EnterpriseAuditHistoryCreateInput,
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditHistory.create({
    data: {
      organizationId: input.organizationId,
      auditId: input.auditId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      title: input.title,
      description: input.description ?? null,
      previousValue:
        input.previousValue === null ||
        input.previousValue === undefined
          ? Prisma.JsonNull
          : input.previousValue,
      newValue:
        input.newValue === null ||
        input.newValue === undefined
          ? Prisma.JsonNull
          : input.newValue,
      metadata:
        input.metadata === null ||
        input.metadata === undefined
          ? Prisma.JsonNull
          : input.metadata,
    },
  });
}

export async function createEnterpriseAuditFindingHistory(
  input: {
    findingId: string;
    userId?: string | null;
    action: EnterpriseAuditHistoryAction;
    title: string;
    description?: string | null;
    previousValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
    metadata?: Prisma.InputJsonValue | null;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAuditFindingHistory.create({
    data: {
      findingId: input.findingId,
      userId: input.userId ?? null,
      action: input.action,
      title: input.title,
      description: input.description ?? null,
      previousValue:
        input.previousValue === null ||
        input.previousValue === undefined
          ? Prisma.JsonNull
          : input.previousValue,
      newValue:
        input.newValue === null ||
        input.newValue === undefined
          ? Prisma.JsonNull
          : input.newValue,
      metadata:
        input.metadata === null ||
        input.metadata === undefined
          ? Prisma.JsonNull
          : input.metadata,
    },
  });
}

export async function findTenantEnterpriseAuditUserAccess(
  input: {
    organizationId: string;
    auditId: string;
    userId: string;
  },
  database: AuditExecutionDatabaseClient = prisma
) {
  return database.enterpriseAudit.findFirst({
    where: {
      id: input.auditId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      leadAuditorId: true,
      ownerId: true,
      teamMembers: {
        where: {
          userId: input.userId,
        },
        select: {
          id: true,
          role: true,
          canEdit: true,
          canReview: true,
        },
      },
    },
  });
}

export async function runAuditExecutionTransaction<T>(
  operation: (
    transaction: Prisma.TransactionClient
  ) => Promise<T>
) {
  return prisma.$transaction(operation);
}