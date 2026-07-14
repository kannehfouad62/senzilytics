import { prisma } from "@/lib/prisma";
import {
  AuditResponseResult,
  AuditTeamRole,
  AuditType,
  RiskLevel,
  Status,
} from "@prisma/client";

export async function findTenantAuditById(
  auditId: string,
  organizationId: string
) {
  return prisma.audit.findFirst({
    where: {
      id: auditId,
      site: {
        organizationId,
      },
    },
    include: {
      site: true,
      leadAuditor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          jobTitle: true,
        },
      },
      teamMembers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              jobTitle: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      checklistTemplate: {
        select: {
          id: true,
          name: true,
          version: true,
          auditType: true,
        },
      },
      checklistItems: {
        include: {
          response: {
            include: {
              answeredBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              finding: {
                select: {
                  id: true,
                  title: true,
                  riskLevel: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: {
          sequence: "asc",
        },
      },
      responses: {
        select: {
          id: true,
          result: true,
          score: true,
        },
      },
      findings: {
        include: {
          response: {
            select: {
              id: true,
              checklistItemId: true,
            },
          },
          correctiveAction: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            riskLevel: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
      },
    },
  });
}

export async function findTenantAudits(
  organizationId: string
) {
  return prisma.audit.findMany({
    where: {
      site: {
        organizationId,
      },
    },
    include: {
      site: true,
      leadAuditor: {
        select: {
          id: true,
          name: true,
        },
      },
      checklistTemplate: {
        select: {
          id: true,
          name: true,
          version: true,
        },
      },
      teamMembers: {
        select: {
          id: true,
        },
      },
      checklistItems: {
        select: {
          id: true,
          response: {
            select: {
              result: true,
            },
          },
        },
      },
      findings: {
        select: {
          id: true,
          riskLevel: true,
          status: true,
        },
      },
    },
    orderBy: [
      {
        scheduledAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function createTenantAudit(input: {
  title: string;
  reference?: string | null;
  scope?: string | null;
  type: AuditType;
  siteId: string;
  scheduledAt?: Date | null;
  dueDate?: Date | null;
  leadAuditorId?: string | null;
  checklistTemplateId?: string | null;
}) {
  return prisma.audit.create({
    data: {
      title: input.title,
      reference: input.reference,
      scope: input.scope,
      type: input.type,
      status: Status.OPEN,
      siteId: input.siteId,
      scheduledAt: input.scheduledAt,
      dueDate: input.dueDate,
      leadAuditorId: input.leadAuditorId,
      checklistTemplateId:
        input.checklistTemplateId,
    },
  });
}

export async function createAuditChecklistSnapshot(input: {
  auditId: string;
  checklistTemplateId: string;
}) {
  const template =
    await prisma.auditChecklistTemplate.findUnique({
      where: {
        id: input.checklistTemplateId,
      },
      include: {
        sections: {
          include: {
            questions: {
              orderBy: {
                sequence: "asc",
              },
            },
          },
          orderBy: {
            sequence: "asc",
          },
        },
      },
    });

  if (!template) {
    throw new Error(
      "Audit checklist template not found."
    );
  }

  const checklistItems =
    template.sections.flatMap((section) =>
      section.questions.map((question) => ({
        templateQuestionId: question.id,
        sectionName: section.name,
        questionText: question.questionText,
        guidance: question.guidance,
        questionType: question.questionType,
        isRequired: question.isRequired,
        weight: question.weight,
      }))
    );

  if (checklistItems.length === 0) {
    return {
      count: 0,
    };
  }

  return prisma.auditChecklistItem.createMany({
    data: checklistItems.map(
      (item, index) => ({
        auditId: input.auditId,
        templateQuestionId:
          item.templateQuestionId,
        sectionName: item.sectionName,
        questionText: item.questionText,
        guidance: item.guidance,
        questionType: item.questionType,
        isRequired: item.isRequired,
        weight: item.weight,
        sequence: index + 1,
      })
    ),
  });
}

export async function updateTenantAuditStatus(input: {
  auditId: string;
  status: Status;
  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  return prisma.audit.update({
    where: {
      id: input.auditId,
    },
    data: {
      status: input.status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    },
  });
}

export async function addTenantAuditTeamMember(input: {
  auditId: string;
  userId: string;
  role: AuditTeamRole;
}) {
  return prisma.auditTeamMember.upsert({
    where: {
      auditId_userId: {
        auditId: input.auditId,
        userId: input.userId,
      },
    },
    update: {
      role: input.role,
    },
    create: {
      auditId: input.auditId,
      userId: input.userId,
      role: input.role,
    },
  });
}

export async function removeTenantAuditTeamMember(input: {
  auditId: string;
  userId: string;
}) {
  return prisma.auditTeamMember.deleteMany({
    where: {
      auditId: input.auditId,
      userId: input.userId,
    },
  });
}

export async function findTenantAuditChecklistItem(input: {
  auditId: string;
  checklistItemId: string;
  organizationId: string;
}) {
  return prisma.auditChecklistItem.findFirst({
    where: {
      id: input.checklistItemId,
      auditId: input.auditId,
      audit: {
        site: {
          organizationId:
            input.organizationId,
        },
      },
    },
    include: {
      response: {
        include: {
          finding: true,
        },
      },
      audit: {
        select: {
          id: true,
          title: true,
          status: true,
          startedAt: true,
        },
      },
    },
  });
}

export async function upsertTenantAuditResponse(input: {
  auditId: string;
  checklistItemId: string;
  answeredById: string;
  result: AuditResponseResult;
  responseText?: string | null;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  score?: number | null;
  comments?: string | null;
}) {
  return prisma.auditResponse.upsert({
    where: {
      checklistItemId:
        input.checklistItemId,
    },
    update: {
      answeredById:
        input.answeredById,
      result: input.result,
      responseText:
        input.responseText,
      numericValue:
        input.numericValue,
      booleanValue:
        input.booleanValue,
      score: input.score,
      comments: input.comments,
      answeredAt: new Date(),
    },
    create: {
      auditId: input.auditId,
      checklistItemId:
        input.checklistItemId,
      answeredById:
        input.answeredById,
      result: input.result,
      responseText:
        input.responseText,
      numericValue:
        input.numericValue,
      booleanValue:
        input.booleanValue,
      score: input.score,
      comments: input.comments,
      answeredAt: new Date(),
    },
  });
}

export async function createOrUpdateAuditFindingForResponse(input: {
  auditId: string;
  responseId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  dueDate?: Date | null;
}) {
  return prisma.auditFinding.upsert({
    where: {
      responseId: input.responseId,
    },
    update: {
      title: input.title,
      description: input.description,
      riskLevel: input.riskLevel,
      dueDate: input.dueDate,
    },
    create: {
      auditId: input.auditId,
      responseId: input.responseId,
      title: input.title,
      description: input.description,
      riskLevel: input.riskLevel,
      status: Status.OPEN,
      dueDate: input.dueDate,
    },
  });
}

export async function createTenantAuditFinding(input: {
  auditId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  dueDate?: Date | null;
  responseId?: string | null;
}) {
  return prisma.auditFinding.create({
    data: {
      auditId: input.auditId,
      title: input.title,
      description: input.description,
      riskLevel: input.riskLevel,
      status: Status.OPEN,
      dueDate: input.dueDate,
      responseId: input.responseId,
    },
  });
}

export async function findTenantAuditFinding(input: {
  findingId: string;
  auditId: string;
  organizationId: string;
}) {
  return prisma.auditFinding.findFirst({
    where: {
      id: input.findingId,
      audit: {
        id: input.auditId,
        site: {
          organizationId:
            input.organizationId,
        },
      },
    },
    include: {
      audit: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
              organizationId: true,
            },
          },
        },
      },
      correctiveAction: {
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

export async function updateTenantAuditFindingStatus(input: {
  findingId: string;
  status: Status;
}) {
  return prisma.auditFinding.update({
    where: {
      id: input.findingId,
    },
    data: {
      status: input.status,
    },
  });
}

export async function createCorrectiveActionFromAuditFinding(input: {
  auditFindingId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  assignedToId: string;
  dueDate: Date;
}) {
  return prisma.correctiveAction.create({
    data: {
      auditFindingId:
        input.auditFindingId,
      title: input.title,
      description:
        input.description,
      status: Status.OPEN,
      riskLevel:
        input.riskLevel,
      assignedToId:
        input.assignedToId,
      dueDate: input.dueDate,
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      auditFinding: {
        include: {
          audit: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });
}