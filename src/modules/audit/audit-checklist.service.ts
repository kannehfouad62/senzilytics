import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  AuditQuestionType,
  AuditType,
} from "@prisma/client";

export async function createAuditChecklistTemplateService(input: {
  organizationId: string;
  userId: string;
  name: string;
  description?: string | null;
  auditType: AuditType;
}) {
  const latestTemplate =
    await prisma.auditChecklistTemplate.findFirst({
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
    await prisma.auditChecklistTemplate.create({
      data: {
        organizationId:
          input.organizationId,
        name: input.name,
        description: input.description,
        auditType: input.auditType,
        version,
        isActive: true,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType:
      "AuditChecklistTemplate",
    entityId: template.id,
    title:
      "Audit checklist template created",
    description:
      `${template.name} version ${template.version}`,
    metadata: {
      auditType: template.auditType,
      version: template.version,
    },
  });

  return template;
}

export async function addAuditChecklistSectionService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
  name: string;
  description?: string | null;
}) {
  const template =
    await prisma.auditChecklistTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId:
          input.organizationId,
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
      "Audit checklist template not found."
    );
  }

  const nextSequence =
    template.sections.length === 0
      ? 1
      : Math.max(
          ...template.sections.map(
            (section) =>
              section.sequence
          )
        ) + 1;

  const section =
    await prisma.auditChecklistSection.create({
      data: {
        templateId: template.id,
        name: input.name,
        description:
          input.description,
        sequence: nextSequence,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType:
      "AuditChecklistSection",
    entityId: section.id,
    title:
      "Audit checklist section created",
    description: section.name,
    metadata: {
      templateId: template.id,
      sequence:
        section.sequence,
    },
  });

  return section;
}

export async function addAuditChecklistQuestionService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
  sectionId: string;
  questionText: string;
  guidance?: string | null;
  questionType: AuditQuestionType;
  isRequired: boolean;
  weight: number;
}) {
  const section =
    await prisma.auditChecklistSection.findFirst({
      where: {
        id: input.sectionId,
        templateId:
          input.templateId,
        template: {
          organizationId:
            input.organizationId,
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
      "Audit checklist section not found."
    );
  }

  const nextSequence =
    section.questions.length === 0
      ? 1
      : Math.max(
          ...section.questions.map(
            (question) =>
              question.sequence
          )
        ) + 1;

  const question =
    await prisma.auditChecklistQuestion.create({
      data: {
        sectionId: section.id,
        questionText:
          input.questionText,
        guidance: input.guidance,
        questionType:
          input.questionType,
        isRequired:
          input.isRequired,
        weight: input.weight,
        sequence: nextSequence,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType:
      "AuditChecklistQuestion",
    entityId: question.id,
    title:
      "Audit checklist question created",
    description:
      question.questionText,
    metadata: {
      templateId:
        input.templateId,
      sectionId:
        section.id,
      questionType:
        question.questionType,
      isRequired:
        question.isRequired,
      weight:
        question.weight,
      sequence:
        question.sequence,
    },
  });

  return question;
}

export async function toggleAuditChecklistTemplateService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
}) {
  const template =
    await prisma.auditChecklistTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId:
          input.organizationId,
      },
    });

  if (!template) {
    throw new Error(
      "Audit checklist template not found."
    );
  }

  const updatedTemplate =
    await prisma.auditChecklistTemplate.update({
      where: {
        id: template.id,
      },
      data: {
        isActive:
          !template.isActive,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.STATUS_CHANGE,
    entityType:
      "AuditChecklistTemplate",
    entityId:
      updatedTemplate.id,
    title:
      updatedTemplate.isActive
        ? "Audit checklist template activated"
        : "Audit checklist template deactivated",
    description:
      updatedTemplate.name,
    metadata: {
      isActive:
        updatedTemplate.isActive,
      version:
        updatedTemplate.version,
    },
  });

  return updatedTemplate;
}

export async function deleteAuditChecklistQuestionService(input: {
  organizationId: string;
  userId: string;
  templateId: string;
  questionId: string;
}) {
  const question =
    await prisma.auditChecklistQuestion.findFirst({
      where: {
        id: input.questionId,
        section: {
          template: {
            id: input.templateId,
            organizationId:
              input.organizationId,
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
      "Audit checklist question not found."
    );
  }

  if (
    question.checklistItems.length >
    0
  ) {
    throw new Error(
      "This question has been used by an audit and cannot be deleted."
    );
  }

  await prisma.auditChecklistQuestion.delete({
    where: {
      id: question.id,
    },
  });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action: ActivityAction.DELETE,
    entityType:
      "AuditChecklistQuestion",
    entityId: question.id,
    title:
      "Audit checklist question deleted",
    description:
      question.questionText,
    metadata: {
      templateId:
        input.templateId,
    },
  });
}