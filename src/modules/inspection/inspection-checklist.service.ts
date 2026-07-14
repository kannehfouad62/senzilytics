import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  InspectionQuestionType,
  InspectionType,
} from "@prisma/client";

export async function createInspectionChecklistTemplateService(input: {
  organizationId: string;
  userId: string;
  name: string;
  description?: string | null;
  inspectionType: InspectionType;
}) {
  const latestTemplate =
    await prisma.inspectionChecklistTemplate.findFirst({
      where: {
        organizationId: input.organizationId,
        name: input.name,
      },
      orderBy: {
        version: "desc",
      },
      select: {
        version: true,
      },
    });

  const version =
    (latestTemplate?.version ?? 0) + 1;

  const template =
    await prisma.inspectionChecklistTemplate.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        inspectionType: input.inspectionType,
        version,
        isActive: true,
      },
    });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "InspectionChecklistTemplate",
    entityId: template.id,
    title: "Inspection checklist template created",
    description: `${template.name} version ${template.version}`,
    metadata: {
      inspectionType: template.inspectionType,
      version: template.version,
    },
  });

  return template;
}

export async function addInspectionChecklistSectionService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
  name: string;
  description?: string | null;
}) {
  const template =
    await prisma.inspectionChecklistTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: input.organizationId,
      },
      include: {
        sections: {
          select: {
            sequence: true,
          },
        },
      },
    });

  if (!template) {
    throw new Error(
      "Inspection checklist template not found."
    );
  }

  const nextSequence =
    template.sections.length === 0
      ? 1
      : Math.max(
          ...template.sections.map(
            (section) => section.sequence
          )
        ) + 1;

  const section =
    await prisma.inspectionChecklistSection.create({
      data: {
        templateId: template.id,
        name: input.name,
        description: input.description,
        sequence: nextSequence,
      },
    });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "InspectionChecklistSection",
    entityId: section.id,
    title: "Inspection checklist section created",
    description: section.name,
    metadata: {
      templateId: template.id,
      sequence: section.sequence,
    },
  });

  return section;
}

export async function addInspectionChecklistQuestionService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
  sectionId: string;
  questionText: string;
  guidance?: string | null;
  questionType: InspectionQuestionType;
  isRequired: boolean;
  weight: number;
}) {
  const section =
    await prisma.inspectionChecklistSection.findFirst({
      where: {
        id: input.sectionId,
        templateId: input.templateId,
        template: {
          organizationId: input.organizationId,
        },
      },
      include: {
        questions: {
          select: {
            sequence: true,
          },
        },
      },
    });

  if (!section) {
    throw new Error(
      "Inspection checklist section not found."
    );
  }

  const nextSequence =
    section.questions.length === 0
      ? 1
      : Math.max(
          ...section.questions.map(
            (question) => question.sequence
          )
        ) + 1;

  const question =
    await prisma.inspectionChecklistQuestion.create({
      data: {
        sectionId: section.id,
        questionText: input.questionText,
        guidance: input.guidance,
        questionType: input.questionType,
        isRequired: input.isRequired,
        weight: input.weight,
        sequence: nextSequence,
      },
    });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "InspectionChecklistQuestion",
    entityId: question.id,
    title: "Inspection checklist question created",
    description: question.questionText,
    metadata: {
      templateId: input.templateId,
      sectionId: section.id,
      questionType: question.questionType,
      isRequired: question.isRequired,
      weight: question.weight,
      sequence: question.sequence,
    },
  });

  return question;
}

export async function toggleInspectionChecklistTemplateService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
}) {
  const template =
    await prisma.inspectionChecklistTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: input.organizationId,
      },
    });

  if (!template) {
    throw new Error(
      "Inspection checklist template not found."
    );
  }

  const updatedTemplate =
    await prisma.inspectionChecklistTemplate.update({
      where: {
        id: template.id,
      },
      data: {
        isActive: !template.isActive,
      },
    });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "InspectionChecklistTemplate",
    entityId: updatedTemplate.id,
    title: updatedTemplate.isActive
      ? "Inspection checklist template activated"
      : "Inspection checklist template deactivated",
    description: updatedTemplate.name,
    metadata: {
      isActive: updatedTemplate.isActive,
      version: updatedTemplate.version,
    },
  });

  return updatedTemplate;
}

export async function deleteInspectionChecklistQuestionService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
  questionId: string;
}) {
  const question =
    await prisma.inspectionChecklistQuestion.findFirst({
      where: {
        id: input.questionId,
        section: {
          template: {
            id: input.templateId,
            organizationId: input.organizationId,
          },
        },
      },
      include: {
        checklistItems: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

  if (!question) {
    throw new Error(
      "Inspection checklist question not found."
    );
  }

  if (question.checklistItems.length > 0) {
    throw new Error(
      "This question has been used by an inspection and cannot be deleted."
    );
  }

  await prisma.inspectionChecklistQuestion.delete({
    where: {
      id: question.id,
    },
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.DELETE,
    entityType: "InspectionChecklistQuestion",
    entityId: question.id,
    title: "Inspection checklist question deleted",
    description: question.questionText,
    metadata: {
      templateId: input.templateId,
    },
  });
}