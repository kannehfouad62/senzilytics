import { prisma } from "@/lib/prisma";
import {
  InspectionTeamRole,
  InspectionType,
  RiskLevel,
  Status,
  Prisma,
} from "@prisma/client";

type InspectionWriteDb=Pick<Prisma.TransactionClient,"inspection"|"inspectionChecklistTemplate"|"inspectionChecklistItem"|"inspectionTeamMember">;

export async function findTenantInspections(
  organizationId: string
) {
  return prisma.inspection.findMany({
    where: {
      site: {
        organizationId,
      },
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
        },
      },
      leadInspector: {
        select: {
          id: true,
          name: true,
          jobTitle: true,
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

export async function findTenantInspectionById(
  inspectionId: string,
  organizationId: string
) {
  return prisma.inspection.findFirst({
    where: {
      id: inspectionId,
      site: {
        organizationId,
      },
    },
    include: {
      site: true,
      leadInspector: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          jobTitle: true,
        },
      },
      checklistTemplate: {
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          inspectionType: true,
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
                  description: true,
                  riskLevel: true,
                  status: true,
                  dueDate: true,
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

export async function createTenantInspection(input: {
  title: string;
  reference?: string | null;
  description?: string | null;
  area?: string | null;
  type: InspectionType;
  siteId: string;
  scheduledAt?: Date | null;
  dueDate?: Date | null;
  leadInspectorId?: string | null;
  checklistTemplateId?: string | null;
},db:InspectionWriteDb=prisma) {
  return db.inspection.create({
    data: {
      title: input.title,
      reference: input.reference,
      description: input.description,
      area: input.area,
      type: input.type,
      status: Status.OPEN,
      siteId: input.siteId,
      scheduledAt: input.scheduledAt,
      dueDate: input.dueDate,
      leadInspectorId:
        input.leadInspectorId,
      checklistTemplateId:
        input.checklistTemplateId,
    },
  });
}

export async function createInspectionChecklistSnapshot(input: {
  inspectionId: string;
  checklistTemplateId: string;
},db:InspectionWriteDb=prisma) {
  const template =
    await db.inspectionChecklistTemplate.findUnique({
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
      "Inspection checklist template not found."
    );
  }

  const checklistItems =
    template.sections.flatMap(
      (section) =>
        section.questions.map(
          (question) => ({
            templateQuestionId:
              question.id,
            sectionName:
              section.name,
            questionText:
              question.questionText,
            guidance:
              question.guidance,
            questionType:
              question.questionType,
            isRequired:
              question.isRequired,
            weight:
              question.weight,
          })
        )
    );

  if (checklistItems.length === 0) {
    return {
      count: 0,
    };
  }

  return db.inspectionChecklistItem.createMany({
    data: checklistItems.map(
      (item, index) => ({
        inspectionId:
          input.inspectionId,
        templateQuestionId:
          item.templateQuestionId,
        sectionName:
          item.sectionName,
        questionText:
          item.questionText,
        guidance:
          item.guidance,
        questionType:
          item.questionType,
        isRequired:
          item.isRequired,
        weight:
          item.weight,
        sequence: index + 1,
      })
    ),
  });
}

export async function addTenantInspectionTeamMember(input: {
  inspectionId: string;
  userId: string;
  role: InspectionTeamRole;
},db:InspectionWriteDb=prisma) {
  return db.inspectionTeamMember.upsert({
    where: {
      inspectionId_userId: {
        inspectionId:
          input.inspectionId,
        userId: input.userId,
      },
    },
    update: {
      role: input.role,
    },
    create: {
      inspectionId:
        input.inspectionId,
      userId: input.userId,
      role: input.role,
    },
  });
}

export async function removeTenantInspectionTeamMember(input: {
  inspectionId: string;
  userId: string;
}) {
  return prisma.inspectionTeamMember.deleteMany({
    where: {
      inspectionId:
        input.inspectionId,
      userId: input.userId,
    },
  });
}

export async function updateTenantInspectionStatus(input: {
  inspectionId: string;
  status: Status;
  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  return prisma.inspection.update({
    where: {
      id: input.inspectionId,
    },
    data: {
      status: input.status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    },
  });
}

export async function createTenantInspectionFinding(input: {
  inspectionId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
  dueDate?: Date | null;
  responseId?: string | null;
}) {
  return prisma.inspectionFinding.create({
    data: {
      inspectionId:
        input.inspectionId,
      title: input.title,
      description:
        input.description,
      riskLevel:
        input.riskLevel,
      status: Status.OPEN,
      dueDate: input.dueDate,
      responseId:
        input.responseId,
    },
  });
}

export async function findTenantInspectionFinding(input: {
  inspectionId: string;
  findingId: string;
  organizationId: string;
}) {
  return prisma.inspectionFinding.findFirst({
    where: {
      id: input.findingId,
      inspection: {
        id: input.inspectionId,
        site: {
          organizationId:
            input.organizationId,
        },
      },
    },
    include: {
      inspection: {
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

export async function updateTenantInspectionFindingStatus(input: {
  findingId: string;
  status: Status;
}) {
  return prisma.inspectionFinding.update({
    where: {
      id: input.findingId,
    },
    data: {
      status: input.status,
    },
  });
}
