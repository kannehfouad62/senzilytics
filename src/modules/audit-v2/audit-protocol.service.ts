import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  archiveTenantAuditProtocol,
  createAuditProtocolQuestion,
  createAuditProtocolSection,
  createTenantAuditProtocol,
  deleteAuditProtocolQuestion,
  deleteAuditProtocolSection,
  findTenantAuditProtocol,
  findTenantAuditProtocolByNameAndVersion,
  getLatestAuditProtocolVersion,
  listTenantAuditProtocols,
  replaceAuditQuestionOptions,
  updateAuditProtocolQuestion,
  updateAuditProtocolSection,
  updateTenantAuditProtocol,
} from "@/modules/audit-v2/audit-protocol.repository";
import {
  ActivityAction,
  EnterpriseAuditFindingTrigger,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditQuestionResponseType,
  EnterpriseAuditSeverity,
  Prisma,
} from "@prisma/client";

type AuditProtocolInput = {
  organizationId: string;
  userId: string;

  name: string;
  description?: string | null;
  code?: string | null;

  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;

  version: number;

  status: EnterpriseAuditProtocolStatus;
  isActive: boolean;

  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;

  previousVersionId?: string | null;
};

type AuditProtocolSectionInput = {
  organizationId: string;
  userId: string;

  protocolId: string;

  title: string;
  description?: string | null;
  guidance?: string | null;
  standardRef?: string | null;

  sequence: number;
  weight: number;

  isRequired: boolean;
  isActive: boolean;
};

type AuditProtocolQuestionInput = {
  organizationId: string;
  userId: string;

  sectionId: string;

  questionText: string;
  description?: string | null;
  guidance?: string | null;

  standardClause?: string | null;
  regulatoryRef?: string | null;

  responseType: EnterpriseAuditQuestionResponseType;

  sequence: number;
  weight: number;

  isRequired: boolean;
  isActive: boolean;

  allowNotApplicable: boolean;
  requireComment: boolean;
  requireEvidence: boolean;
  requirePhoto: boolean;

  minimumNumericValue?: Prisma.Decimal | number | null;
  maximumNumericValue?: Prisma.Decimal | number | null;

  minimumPassingScore?: Prisma.Decimal | number | null;
  maximumScore?: Prisma.Decimal | number | null;

  findingTrigger: EnterpriseAuditFindingTrigger;
  defaultSeverity?: EnterpriseAuditSeverity | null;

  automaticallyCreateFinding: boolean;
  automaticallySuggestCapa: boolean;
  automaticallySuggestRisk: boolean;

  findingTitleTemplate?: string | null;
  findingDescriptionTemplate?: string | null;

  aiGuidance?: string | null;
};

type AuditQuestionOptionInput = {
  label: string;
  value: string;
  description?: string | null;

  sequence: number;

  scoreValue?: Prisma.Decimal | number | null;

  isPassing?: boolean | null;

  triggersFinding: boolean;
  findingSeverity?: EnterpriseAuditSeverity | null;

  isActive: boolean;
};

function normalizeOptionalText(
  value?: string | null
) {
  return value?.trim() || null;
}

function normalizeCode(
  value?: string | null
) {
  const normalized =
    value
      ?.trim()
      .toUpperCase() || null;

  return normalized;
}

function validateDateRange(
  effectiveFrom?: Date | null,
  effectiveTo?: Date | null
) {
  if (
    effectiveFrom &&
    Number.isNaN(
      effectiveFrom.getTime()
    )
  ) {
    throw new Error(
      "The protocol effective start date is invalid."
    );
  }

  if (
    effectiveTo &&
    Number.isNaN(
      effectiveTo.getTime()
    )
  ) {
    throw new Error(
      "The protocol effective end date is invalid."
    );
  }

  if (
    effectiveFrom &&
    effectiveTo &&
    effectiveTo < effectiveFrom
  ) {
    throw new Error(
      "The protocol effective end date cannot be earlier than its start date."
    );
  }
}

function validatePositiveInteger(
  value: number,
  fieldName: string
) {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `${fieldName} must be a positive whole number.`
    );
  }
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : value.toNumber();

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    throw new Error(
      "One or more numeric protocol values are invalid."
    );
  }

  return numericValue;
}

async function getProtocolRecord(
  input: {
    organizationId: string;
    protocolId: string;
  }
) {
  const protocol =
    await prisma.auditProtocol.findFirst({
      where: {
        id:
          input.protocolId,

        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
        name: true,
        code: true,
        version: true,
        status: true,
        isActive: true,

        _count: {
          select: {
            enterpriseAudits:
              true,

            schedules:
              true,

            defaultForPrograms:
              true,
          },
        },
      },
    });

  if (!protocol) {
    throw new Error(
      "Audit protocol not found in this organization."
    );
  }

  return protocol;
}

async function assertProtocolStructureEditable(
  input: {
    organizationId: string;
    protocolId: string;
  }
) {
  const protocol =
    await getProtocolRecord(
      input
    );

  if (
    protocol.status ===
    EnterpriseAuditProtocolStatus.ARCHIVED
  ) {
    throw new Error(
      "Archived protocols cannot be edited."
    );
  }

  if (
    protocol._count
      .enterpriseAudits > 0
  ) {
    throw new Error(
      "This protocol has already been used by an audit. Create a new protocol version before changing its sections, questions, scoring, or answer options."
    );
  }

  return protocol;
}

async function validateProtocolIdentity(
  input: {
    organizationId: string;

    name: string;
    code?: string | null;
    version: number;

    excludeProtocolId?:
      | string
      | null;
  }
) {
  const duplicateNameVersion =
    await findTenantAuditProtocolByNameAndVersion({
      organizationId:
        input.organizationId,

      name:
        input.name,

      version:
        input.version,

      excludeProtocolId:
        input.excludeProtocolId,
    });

  if (duplicateNameVersion) {
    throw new Error(
      "An audit protocol with this name and version already exists."
    );
  }

  const code =
    normalizeCode(
      input.code
    );

  if (!code) {
    return;
  }

  const duplicateCode =
    await prisma.auditProtocol.findFirst({
      where: {
        organizationId:
          input.organizationId,

        code: {
          equals:
            code,

          mode:
            "insensitive",
        },

        version:
          input.version,

        ...(input.excludeProtocolId
          ? {
              id: {
                not:
                  input.excludeProtocolId,
              },
            }
          : {}),
      },

      select: {
        id: true,
      },
    });

  if (duplicateCode) {
    throw new Error(
      "An audit protocol with this code and version already exists."
    );
  }
}

async function validatePreviousVersion(
  input: {
    organizationId: string;

    previousVersionId?:
      | string
      | null;

    protocolName: string;
    version: number;
  }
) {
  if (
    !input.previousVersionId
  ) {
    return;
  }

  const previousVersion =
    await prisma.auditProtocol.findFirst({
      where: {
        id:
          input.previousVersionId,

        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
        name: true,
        version: true,
      },
    });

  if (!previousVersion) {
    throw new Error(
      "The selected previous protocol version does not belong to this organization."
    );
  }

  if (
    previousVersion.name
      .trim()
      .toLowerCase() !==
    input.protocolName
      .trim()
      .toLowerCase()
  ) {
    throw new Error(
      "The previous protocol version must have the same protocol name."
    );
  }

  if (
    previousVersion.version >=
    input.version
  ) {
    throw new Error(
      "The new protocol version must be greater than the preceding version."
    );
  }
}

async function validateProtocolInput(
  input: AuditProtocolInput & {
    excludeProtocolId?:
      | string
      | null;
  }
) {
  const name =
    input.name.trim();

  if (!name) {
    throw new Error(
      "Protocol name is required."
    );
  }

  if (name.length > 200) {
    throw new Error(
      "Protocol name cannot exceed 200 characters."
    );
  }

  validatePositiveInteger(
    input.version,
    "Protocol version"
  );

  const code =
    normalizeCode(
      input.code
    );

  if (
    code &&
    code.length > 50
  ) {
    throw new Error(
      "Protocol code cannot exceed 50 characters."
    );
  }

  validateDateRange(
    input.effectiveFrom,
    input.effectiveTo
  );

  if (
    input.status ===
      EnterpriseAuditProtocolStatus.ACTIVE &&
    !input.isActive
  ) {
    throw new Error(
      "An active protocol must have its active setting enabled."
    );
  }

  if (
    input.status ===
      EnterpriseAuditProtocolStatus.ARCHIVED &&
    input.isActive
  ) {
    throw new Error(
      "An archived protocol cannot remain active."
    );
  }

  await validateProtocolIdentity({
    organizationId:
      input.organizationId,

    name,

    code,

    version:
      input.version,

    excludeProtocolId:
      input.excludeProtocolId,
  });

  await validatePreviousVersion({
    organizationId:
      input.organizationId,

    previousVersionId:
      input.previousVersionId,

    protocolName:
      name,

    version:
      input.version,
  });

  return {
    name,
    code,
  };
}

async function validateProtocolReadyForActivation(
  input: {
    organizationId: string;
    protocolId: string;
  }
) {
  const protocol =
    await findTenantAuditProtocol(
      input
    );

  if (!protocol) {
    throw new Error(
      "Audit protocol not found in this organization."
    );
  }

  const activeSections =
    protocol.sections.filter(
      (section) =>
        section.isActive
    );

  if (
    activeSections.length === 0
  ) {
    throw new Error(
      "A protocol must contain at least one active section before it can be activated."
    );
  }

  const activeQuestions =
    activeSections.flatMap(
      (section) =>
        section.questions.filter(
          (question) =>
            question.isActive
        )
    );

  if (
    activeQuestions.length === 0
  ) {
    throw new Error(
      "A protocol must contain at least one active question before it can be activated."
    );
  }

  for (
    const section
    of activeSections
  ) {
    const sectionQuestions =
      section.questions.filter(
        (question) =>
          question.isActive
      );

    if (
      section.isRequired &&
      sectionQuestions.length ===
        0
    ) {
      throw new Error(
        `Required section "${section.title}" has no active questions.`
      );
    }
  }

  for (
    const question
    of activeQuestions
  ) {
    if (
      question.responseType ===
        EnterpriseAuditQuestionResponseType.MULTIPLE_CHOICE &&
      question.options.filter(
        (option) =>
          option.isActive
      ).length === 0
    ) {
      throw new Error(
        `Multiple-choice question "${question.questionText}" requires at least one active answer option.`
      );
    }

    if (
      question.automaticallyCreateFinding &&
      !question.defaultSeverity
    ) {
      throw new Error(
        `Question "${question.questionText}" requires a default finding severity because automatic finding creation is enabled.`
      );
    }

    if (
      question.automaticallyCreateFinding &&
      question.findingTrigger ===
        EnterpriseAuditFindingTrigger.NEVER
    ) {
      throw new Error(
        `Question "${question.questionText}" cannot automatically create a finding while its finding trigger is set to Never.`
      );
    }
  }

  return protocol;
}

async function getSectionRecord(
  input: {
    organizationId: string;
    sectionId: string;
  }
) {
  const section =
    await prisma.auditProtocolSection.findFirst({
      where: {
        id:
          input.sectionId,

        protocol: {
          organizationId:
            input.organizationId,
        },
      },

      select: {
        id: true,
        title: true,
        sequence: true,
        protocolId: true,

        protocol: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
      },
    });

  if (!section) {
    throw new Error(
      "Audit protocol section not found in this organization."
    );
  }

  return section;
}

async function getQuestionRecord(
  input: {
    organizationId: string;
    questionId: string;
  }
) {
  const question =
    await prisma.auditProtocolQuestion.findFirst({
      where: {
        id:
          input.questionId,

        section: {
          protocol: {
            organizationId:
              input.organizationId,
          },
        },
      },

      select: {
        id: true,
        questionText: true,
        sequence: true,
        responseType: true,
        sectionId: true,

        section: {
          select: {
            id: true,
            title: true,
            protocolId: true,

            protocol: {
              select: {
                id: true,
                name: true,
                version: true,
              },
            },
          },
        },
      },
    });

  if (!question) {
    throw new Error(
      "Audit protocol question not found in this organization."
    );
  }

  return question;
}

async function validateSectionSequence(
  input: {
    protocolId: string;
    sequence: number;
    excludeSectionId?:
      | string
      | null;
  }
) {
  validatePositiveInteger(
    input.sequence,
    "Section sequence"
  );

  const duplicate =
    await prisma.auditProtocolSection.findFirst({
      where: {
        protocolId:
          input.protocolId,

        sequence:
          input.sequence,

        ...(input.excludeSectionId
          ? {
              id: {
                not:
                  input.excludeSectionId,
              },
            }
          : {}),
      },

      select: {
        id: true,
      },
    });

  if (duplicate) {
    throw new Error(
      "Another section already uses this sequence number."
    );
  }
}

async function validateQuestionSequence(
  input: {
    sectionId: string;
    sequence: number;
    excludeQuestionId?:
      | string
      | null;
  }
) {
  validatePositiveInteger(
    input.sequence,
    "Question sequence"
  );

  const duplicate =
    await prisma.auditProtocolQuestion.findFirst({
      where: {
        sectionId:
          input.sectionId,

        sequence:
          input.sequence,

        ...(input.excludeQuestionId
          ? {
              id: {
                not:
                  input.excludeQuestionId,
              },
            }
          : {}),
      },

      select: {
        id: true,
      },
    });

  if (duplicate) {
    throw new Error(
      "Another question already uses this sequence number in this section."
    );
  }
}

function validateQuestionInput(
  input: AuditProtocolQuestionInput
) {
  const questionText =
    input.questionText.trim();

  if (!questionText) {
    throw new Error(
      "Question text is required."
    );
  }

  if (
    questionText.length >
    2000
  ) {
    throw new Error(
      "Question text cannot exceed 2,000 characters."
    );
  }

  validatePositiveInteger(
    input.sequence,
    "Question sequence"
  );

  validatePositiveInteger(
    input.weight,
    "Question weight"
  );

  const minimumNumericValue =
    decimalToNumber(
      input.minimumNumericValue
    );

  const maximumNumericValue =
    decimalToNumber(
      input.maximumNumericValue
    );

  if (
    minimumNumericValue !==
      null &&
    maximumNumericValue !==
      null &&
    maximumNumericValue <
      minimumNumericValue
  ) {
    throw new Error(
      "The maximum numeric value cannot be lower than the minimum numeric value."
    );
  }

  const minimumPassingScore =
    decimalToNumber(
      input.minimumPassingScore
    );

  const maximumScore =
    decimalToNumber(
      input.maximumScore
    );

  if (
    minimumPassingScore !==
      null &&
    maximumScore !== null &&
    minimumPassingScore >
      maximumScore
  ) {
    throw new Error(
      "The minimum passing score cannot exceed the maximum score."
    );
  }

  if (
    maximumScore !== null &&
    maximumScore < 0
  ) {
    throw new Error(
      "Maximum score cannot be negative."
    );
  }

  if (
    minimumPassingScore !==
      null &&
    minimumPassingScore < 0
  ) {
    throw new Error(
      "Minimum passing score cannot be negative."
    );
  }

  if (
    input.responseType !==
      EnterpriseAuditQuestionResponseType.NUMERIC &&
    (minimumNumericValue !==
      null ||
      maximumNumericValue !==
        null)
  ) {
    throw new Error(
      "Numeric minimum and maximum values can only be used with numeric response questions."
    );
  }

  if (
    input.findingTrigger ===
      EnterpriseAuditFindingTrigger.BELOW_THRESHOLD &&
    minimumPassingScore ===
      null
  ) {
    throw new Error(
      "A below-threshold finding trigger requires a minimum passing score."
    );
  }

  if (
    input.findingTrigger ===
      EnterpriseAuditFindingTrigger.ABOVE_THRESHOLD &&
    maximumNumericValue ===
      null
  ) {
    throw new Error(
      "An above-threshold finding trigger requires a maximum numeric value."
    );
  }

  if (
    input.findingTrigger ===
      EnterpriseAuditFindingTrigger.SELECTED_OPTIONS &&
    input.responseType !==
      EnterpriseAuditQuestionResponseType.MULTIPLE_CHOICE
  ) {
    throw new Error(
      "Selected-option finding triggers can only be used with multiple-choice questions."
    );
  }

  if (
    input.automaticallyCreateFinding &&
    input.findingTrigger ===
      EnterpriseAuditFindingTrigger.NEVER
  ) {
    throw new Error(
      "Automatic finding creation requires a finding trigger."
    );
  }

  if (
    input.automaticallyCreateFinding &&
    !input.defaultSeverity
  ) {
    throw new Error(
      "Automatic finding creation requires a default finding severity."
    );
  }

  return {
    questionText,

    requireEvidence:
      input.requireEvidence ||
      input.requirePhoto,
  };
}

function validateQuestionOptions(
  input: {
    responseType:
      EnterpriseAuditQuestionResponseType;

    options:
      AuditQuestionOptionInput[];
  }
) {
  if (
    input.responseType !==
      EnterpriseAuditQuestionResponseType.MULTIPLE_CHOICE &&
    input.responseType !==
      EnterpriseAuditQuestionResponseType.RATING &&
    input.options.length > 0
  ) {
    throw new Error(
      "Answer options may only be configured for multiple-choice or rating questions."
    );
  }

  const values =
    new Set<string>();

  const sequences =
    new Set<number>();

  for (
    const option
    of input.options
  ) {
    const label =
      option.label.trim();

    const value =
      option.value.trim();

    if (!label) {
      throw new Error(
        "Every answer option requires a label."
      );
    }

    if (!value) {
      throw new Error(
        "Every answer option requires a value."
      );
    }

    validatePositiveInteger(
      option.sequence,
      "Option sequence"
    );

    const normalizedValue =
      value.toLowerCase();

    if (
      values.has(
        normalizedValue
      )
    ) {
      throw new Error(
        "Answer-option values must be unique within a question."
      );
    }

    if (
      sequences.has(
        option.sequence
      )
    ) {
      throw new Error(
        "Answer-option sequence numbers must be unique within a question."
      );
    }

    if (
      option.triggersFinding &&
      !option.findingSeverity
    ) {
      throw new Error(
        `Option "${label}" requires a finding severity because it triggers a finding.`
      );
    }

    const scoreValue =
      decimalToNumber(
        option.scoreValue
      );

    if (
      scoreValue !== null &&
      scoreValue < 0
    ) {
      throw new Error(
        `Option "${label}" cannot have a negative score.`
      );
    }

    values.add(
      normalizedValue
    );

    sequences.add(
      option.sequence
    );
  }
}

export async function listAuditProtocolsService(
  input: {
    organizationId: string;

    search?: string | null;

    status?:
      | EnterpriseAuditProtocolStatus
      | null;

    isActive?: boolean | null;
  }
) {
  return listTenantAuditProtocols(
    input
  );
}

export async function getAuditProtocolService(
  input: {
    organizationId: string;
    protocolId: string;
  }
) {
  const protocol =
    await findTenantAuditProtocol(
      input
    );

  if (!protocol) {
    throw new Error(
      "Audit protocol not found in this organization."
    );
  }

  return protocol;
}

export async function createAuditProtocolService(
  input: AuditProtocolInput
) {
  const validated =
    await validateProtocolInput(
      input
    );

  if (
    input.status ===
    EnterpriseAuditProtocolStatus.ACTIVE
  ) {
    throw new Error(
      "Create the protocol as a draft, add its sections and questions, and then activate it."
    );
  }

  const protocol =
    await createTenantAuditProtocol({
      organizationId:
        input.organizationId,

      name:
        validated.name,

      description:
        normalizeOptionalText(
          input.description
        ),

      code:
        validated.code,

      standardName:
        normalizeOptionalText(
          input.standardName
        ),

      standardVersion:
        normalizeOptionalText(
          input.standardVersion
        ),

      framework:
        normalizeOptionalText(
          input.framework
        ),

      version:
        input.version,

      status:
        input.status,

      isActive:
        input.isActive,

      effectiveFrom:
        input.effectiveFrom ||
        null,

      effectiveTo:
        input.effectiveTo ||
        null,

      previousVersionId:
        input.previousVersionId ||
        null,

      createdById:
        input.userId,

      updatedById:
        input.userId,
    });

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.CREATE,

    entityType:
      "AuditProtocol",

    entityId:
      protocol.id,

    title:
      "Audit protocol created",

    description:
      `${protocol.name} version ${protocol.version} was created.`,

    metadata: {
      protocolId:
        protocol.id,

      protocolName:
        protocol.name,

      protocolCode:
        protocol.code,

      version:
        protocol.version,

      status:
        protocol.status,

      previousVersionId:
        protocol.previousVersionId,

      createdAt:
        new Date().toISOString(),
    },
  });

  return protocol;
}

export async function updateAuditProtocolService(
  input: Omit<
    AuditProtocolInput,
    "version" |
      "previousVersionId"
  > & {
    protocolId: string;
  }
) {
  const existing =
    await getProtocolRecord({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,
    });

  const validated =
    await validateProtocolInput({
      ...input,

      version:
        existing.version,

      previousVersionId:
        null,

      excludeProtocolId:
        input.protocolId,
    });

  if (
    existing._count
      .enterpriseAudits > 0
  ) {
    const identityChanged =
      existing.name
        .trim()
        .toLowerCase() !==
        validated.name
          .toLowerCase() ||
      normalizeCode(
        existing.code
      ) !== validated.code;

    if (identityChanged) {
      throw new Error(
        "This protocol has execution history. Create a new version before changing its name or code."
      );
    }
  }

  if (
    input.status ===
    EnterpriseAuditProtocolStatus.ACTIVE
  ) {
    await validateProtocolReadyForActivation({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,
    });
  }

  const protocol =
    await updateTenantAuditProtocol({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,

      name:
        validated.name,

      description:
        normalizeOptionalText(
          input.description
        ),

      code:
        validated.code,

      standardName:
        normalizeOptionalText(
          input.standardName
        ),

      standardVersion:
        normalizeOptionalText(
          input.standardVersion
        ),

      framework:
        normalizeOptionalText(
          input.framework
        ),

      status:
        input.status,

      isActive:
        input.isActive,

      effectiveFrom:
        input.effectiveFrom ||
        null,

      effectiveTo:
        input.effectiveTo ||
        null,

      updatedById:
        input.userId,
    });

  if (!protocol) {
    throw new Error(
      "The audit protocol could not be updated."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocol",

    entityId:
      protocol.id,

    title:
      "Audit protocol updated",

    description:
      `${protocol.name} version ${protocol.version} was updated.`,

    metadata: {
      protocolId:
        protocol.id,

      previousStatus:
        existing.status,

      currentStatus:
        protocol.status,

      previousIsActive:
        existing.isActive,

      currentIsActive:
        protocol.isActive,

      updatedAt:
        new Date().toISOString(),
    },
  });

  return protocol;
}

export async function activateAuditProtocolService(
  input: {
    organizationId: string;
    userId: string;
    protocolId: string;
  }
) {
  const protocol =
    await validateProtocolReadyForActivation({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,
    });

  if (
    protocol.status ===
      EnterpriseAuditProtocolStatus.ARCHIVED
  ) {
    throw new Error(
      "An archived protocol cannot be activated."
    );
  }

  const updated =
    await updateTenantAuditProtocol({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,

      name:
        protocol.name,

      description:
        protocol.description,

      code:
        protocol.code,

      standardName:
        protocol.standardName,

      standardVersion:
        protocol.standardVersion,

      framework:
        protocol.framework,

      status:
        EnterpriseAuditProtocolStatus.ACTIVE,

      isActive:
        true,

      effectiveFrom:
        protocol.effectiveFrom,

      effectiveTo:
        protocol.effectiveTo,

      updatedById:
        input.userId,
    });

  if (!updated) {
    throw new Error(
      "The audit protocol could not be activated."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocol",

    entityId:
      updated.id,

    title:
      "Audit protocol activated",

    description:
      `${updated.name} version ${updated.version} was activated for audit planning and execution.`,

    metadata: {
      protocolId:
        updated.id,

      version:
        updated.version,

      sectionCount:
        protocol.sections.length,

      questionCount:
        protocol.sections.reduce(
          (
            total,
            section
          ) =>
            total +
            section.questions.length,
          0
        ),

      activatedAt:
        new Date().toISOString(),
    },
  });

  return updated;
}

export async function createAuditProtocolVersionService(
  input: {
    organizationId: string;
    userId: string;
    protocolId: string;
  }
) {
  const source =
    await findTenantAuditProtocol({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,
    });

  if (!source) {
    throw new Error(
      "Source audit protocol not found in this organization."
    );
  }

  if (
    source.status ===
    EnterpriseAuditProtocolStatus.ARCHIVED
  ) {
    throw new Error(
      "An archived protocol cannot be used to create a new version."
    );
  }

  const latestVersion =
    await getLatestAuditProtocolVersion({
      organizationId:
        input.organizationId,

      name:
        source.name,
    });

  const nextVersion =
    Math.max(
      latestVersion?.version ??
        source.version,
      source.version
    ) + 1;

  const created =
    await prisma.$transaction(
      async (
        transaction
      ) => {
        const protocol =
          await transaction.auditProtocol.create({
            data: {
              organizationId:
                input.organizationId,

              name:
                source.name,

              description:
                source.description,

              code:
                source.code,

              standardName:
                source.standardName,

              standardVersion:
                source.standardVersion,

              framework:
                source.framework,

              version:
                nextVersion,

              status:
                EnterpriseAuditProtocolStatus.DRAFT,

              isActive:
                false,

              effectiveFrom:
                null,

              effectiveTo:
                null,

              previousVersionId:
                source.id,

              createdById:
                input.userId,

              updatedById:
                input.userId,
            },
          });

        for (
          const sourceSection
          of source.sections
        ) {
          const section =
            await transaction.auditProtocolSection.create({
              data: {
                protocolId:
                  protocol.id,

                title:
                  sourceSection.title,

                description:
                  sourceSection.description,

                guidance:
                  sourceSection.guidance,

                standardRef:
                  sourceSection.standardRef,

                sequence:
                  sourceSection.sequence,

                weight:
                  sourceSection.weight,

                isRequired:
                  sourceSection.isRequired,

                isActive:
                  sourceSection.isActive,
              },
            });

          for (
            const sourceQuestion
            of sourceSection.questions
          ) {
            const question =
              await transaction.auditProtocolQuestion.create({
                data: {
                  sectionId:
                    section.id,

                  questionText:
                    sourceQuestion.questionText,

                  description:
                    sourceQuestion.description,

                  guidance:
                    sourceQuestion.guidance,

                  standardClause:
                    sourceQuestion.standardClause,

                  regulatoryRef:
                    sourceQuestion.regulatoryRef,

                  responseType:
                    sourceQuestion.responseType,

                  sequence:
                    sourceQuestion.sequence,

                  weight:
                    sourceQuestion.weight,

                  isRequired:
                    sourceQuestion.isRequired,

                  isActive:
                    sourceQuestion.isActive,

                  allowNotApplicable:
                    sourceQuestion.allowNotApplicable,

                  requireComment:
                    sourceQuestion.requireComment,

                  requireEvidence:
                    sourceQuestion.requireEvidence,

                  requirePhoto:
                    sourceQuestion.requirePhoto,

                  minimumNumericValue:
                    sourceQuestion.minimumNumericValue,

                  maximumNumericValue:
                    sourceQuestion.maximumNumericValue,

                  minimumPassingScore:
                    sourceQuestion.minimumPassingScore,

                  maximumScore:
                    sourceQuestion.maximumScore,

                  findingTrigger:
                    sourceQuestion.findingTrigger,

                  defaultSeverity:
                    sourceQuestion.defaultSeverity,

                  automaticallyCreateFinding:
                    sourceQuestion.automaticallyCreateFinding,

                  automaticallySuggestCapa:
                    sourceQuestion.automaticallySuggestCapa,

                  automaticallySuggestRisk:
                    sourceQuestion.automaticallySuggestRisk,

                  findingTitleTemplate:
                    sourceQuestion.findingTitleTemplate,

                  findingDescriptionTemplate:
                    sourceQuestion.findingDescriptionTemplate,

                  aiGuidance:
                    sourceQuestion.aiGuidance,
                },
              });

            if (
              sourceQuestion.options
                .length > 0
            ) {
              await transaction.auditQuestionOption.createMany({
                data:
                  sourceQuestion.options.map(
                    (option) => ({
                      questionId:
                        question.id,

                      label:
                        option.label,

                      value:
                        option.value,

                      description:
                        option.description,

                      sequence:
                        option.sequence,

                      scoreValue:
                        option.scoreValue,

                      isPassing:
                        option.isPassing,

                      triggersFinding:
                        option.triggersFinding,

                      findingSeverity:
                        option.findingSeverity,

                      isActive:
                        option.isActive,
                    })
                  ),
              });
            }
          }
        }

        return protocol;
      }
    );

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.CREATE,

    entityType:
      "AuditProtocol",

    entityId:
      created.id,

    title:
      "New audit protocol version created",

    description:
      `${source.name} version ${nextVersion} was created from version ${source.version}.`,

    metadata: {
      protocolId:
        created.id,

      previousProtocolId:
        source.id,

      previousVersion:
        source.version,

      newVersion:
        nextVersion,

      sectionCount:
        source.sections.length,

      questionCount:
        source.sections.reduce(
          (
            total,
            section
          ) =>
            total +
            section.questions.length,
          0
        ),

      createdAt:
        new Date().toISOString(),
    },
  });

  return findTenantAuditProtocol({
    organizationId:
      input.organizationId,

    protocolId:
      created.id,
  });
}

export async function createAuditProtocolSectionService(
  input: AuditProtocolSectionInput
) {
  const protocol =
    await assertProtocolStructureEditable({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,
    });

  const title =
    input.title.trim();

  if (!title) {
    throw new Error(
      "Section title is required."
    );
  }

  validatePositiveInteger(
    input.weight,
    "Section weight"
  );

  await validateSectionSequence({
    protocolId:
      input.protocolId,

    sequence:
      input.sequence,
  });

  const section =
    await createAuditProtocolSection({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,

      title,

      description:
        normalizeOptionalText(
          input.description
        ),

      guidance:
        normalizeOptionalText(
          input.guidance
        ),

      standardRef:
        normalizeOptionalText(
          input.standardRef
        ),

      sequence:
        input.sequence,

      weight:
        input.weight,

      isRequired:
        input.isRequired,

      isActive:
        input.isActive,
    });

  if (!section) {
    throw new Error(
      "The protocol section could not be created."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.CREATE,

    entityType:
      "AuditProtocolSection",

    entityId:
      section.id,

    title:
      "Audit protocol section created",

    description:
      `${section.title} was added to ${protocol.name} version ${protocol.version}.`,

    metadata: {
      protocolId:
        protocol.id,

      sectionId:
        section.id,

      sequence:
        section.sequence,

      weight:
        section.weight,

      createdAt:
        new Date().toISOString(),
    },
  });

  return section;
}

export async function updateAuditProtocolSectionService(
  input: Omit<
    AuditProtocolSectionInput,
    "protocolId"
  > & {
    sectionId: string;
  }
) {
  const existing =
    await getSectionRecord({
      organizationId:
        input.organizationId,

      sectionId:
        input.sectionId,
    });

  await assertProtocolStructureEditable({
    organizationId:
      input.organizationId,

    protocolId:
      existing.protocolId,
  });

  const title =
    input.title.trim();

  if (!title) {
    throw new Error(
      "Section title is required."
    );
  }

  validatePositiveInteger(
    input.weight,
    "Section weight"
  );

  await validateSectionSequence({
    protocolId:
      existing.protocolId,

    sequence:
      input.sequence,

    excludeSectionId:
      input.sectionId,
  });

  const section =
    await updateAuditProtocolSection({
      organizationId:
        input.organizationId,

      sectionId:
        input.sectionId,

      title,

      description:
        normalizeOptionalText(
          input.description
        ),

      guidance:
        normalizeOptionalText(
          input.guidance
        ),

      standardRef:
        normalizeOptionalText(
          input.standardRef
        ),

      sequence:
        input.sequence,

      weight:
        input.weight,

      isRequired:
        input.isRequired,

      isActive:
        input.isActive,
    });

  if (!section) {
    throw new Error(
      "The protocol section could not be updated."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocolSection",

    entityId:
      section.id,

    title:
      "Audit protocol section updated",

    description:
      `${section.title} was updated in ${existing.protocol.name} version ${existing.protocol.version}.`,

    metadata: {
      protocolId:
        existing.protocolId,

      sectionId:
        section.id,

      previousSequence:
        existing.sequence,

      currentSequence:
        section.sequence,

      updatedAt:
        new Date().toISOString(),
    },
  });

  return section;
}

export async function deleteAuditProtocolSectionService(
  input: {
    organizationId: string;
    userId: string;
    sectionId: string;
  }
) {
  const section =
    await getSectionRecord({
      organizationId:
        input.organizationId,

      sectionId:
        input.sectionId,
    });

  await assertProtocolStructureEditable({
    organizationId:
      input.organizationId,

    protocolId:
      section.protocolId,
  });

  const result =
    await deleteAuditProtocolSection({
      organizationId:
        input.organizationId,

      sectionId:
        input.sectionId,
    });

  if (!result.deleted) {
    if (
      result.reason ===
      "HAS_EXECUTION_HISTORY"
    ) {
      throw new Error(
        "This protocol section has execution history and cannot be deleted. Create a new protocol version instead."
      );
    }

    throw new Error(
      "The protocol section could not be deleted."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocolSection",

    entityId:
      section.id,

    title:
      "Audit protocol section deleted",

    description:
      `${section.title} was removed from ${section.protocol.name} version ${section.protocol.version}.`,

    metadata: {
      protocolId:
        section.protocolId,

      sectionId:
        section.id,

      deletedAt:
        new Date().toISOString(),
    },
  });

  return result;
}

export async function createAuditProtocolQuestionService(
  input: AuditProtocolQuestionInput
) {
  const section =
    await getSectionRecord({
      organizationId:
        input.organizationId,

      sectionId:
        input.sectionId,
    });

  await assertProtocolStructureEditable({
    organizationId:
      input.organizationId,

    protocolId:
      section.protocolId,
  });

  const validated =
    validateQuestionInput(
      input
    );

  await validateQuestionSequence({
    sectionId:
      input.sectionId,

    sequence:
      input.sequence,
  });

  const question =
    await createAuditProtocolQuestion({
      ...input,

      questionText:
        validated.questionText,

      description:
        normalizeOptionalText(
          input.description
        ),

      guidance:
        normalizeOptionalText(
          input.guidance
        ),

      standardClause:
        normalizeOptionalText(
          input.standardClause
        ),

      regulatoryRef:
        normalizeOptionalText(
          input.regulatoryRef
        ),

      requireEvidence:
        validated.requireEvidence,

      findingTitleTemplate:
        normalizeOptionalText(
          input.findingTitleTemplate
        ),

      findingDescriptionTemplate:
        normalizeOptionalText(
          input.findingDescriptionTemplate
        ),

      aiGuidance:
        normalizeOptionalText(
          input.aiGuidance
        ),
    });

  if (!question) {
    throw new Error(
      "The protocol question could not be created."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.CREATE,

    entityType:
      "AuditProtocolQuestion",

    entityId:
      question.id,

    title:
      "Audit protocol question created",

    description:
      `A question was added to ${section.protocol.name} version ${section.protocol.version}.`,

    metadata: {
      protocolId:
        section.protocolId,

      sectionId:
        section.id,

      questionId:
        question.id,

      responseType:
        question.responseType,

      findingTrigger:
        question.findingTrigger,

      createdAt:
        new Date().toISOString(),
    },
  });

  return question;
}

export async function updateAuditProtocolQuestionService(
  input: Omit<
    AuditProtocolQuestionInput,
    "sectionId"
  > & {
    questionId: string;
  }
) {
  const existing =
    await getQuestionRecord({
      organizationId:
        input.organizationId,

      questionId:
        input.questionId,
    });

  await assertProtocolStructureEditable({
    organizationId:
      input.organizationId,

    protocolId:
      existing.section
        .protocolId,
  });

  const validated =
    validateQuestionInput({
      ...input,

      sectionId:
        existing.sectionId,
    });

  await validateQuestionSequence({
    sectionId:
      existing.sectionId,

    sequence:
      input.sequence,

    excludeQuestionId:
      input.questionId,
  });

  const question =
    await updateAuditProtocolQuestion({
      ...input,

      questionText:
        validated.questionText,

      description:
        normalizeOptionalText(
          input.description
        ),

      guidance:
        normalizeOptionalText(
          input.guidance
        ),

      standardClause:
        normalizeOptionalText(
          input.standardClause
        ),

      regulatoryRef:
        normalizeOptionalText(
          input.regulatoryRef
        ),

      requireEvidence:
        validated.requireEvidence,

      findingTitleTemplate:
        normalizeOptionalText(
          input.findingTitleTemplate
        ),

      findingDescriptionTemplate:
        normalizeOptionalText(
          input.findingDescriptionTemplate
        ),

      aiGuidance:
        normalizeOptionalText(
          input.aiGuidance
        ),
    });

  if (!question) {
    throw new Error(
      "The protocol question could not be updated."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocolQuestion",

    entityId:
      question.id,

    title:
      "Audit protocol question updated",

    description:
      `A question was updated in ${existing.section.protocol.name} version ${existing.section.protocol.version}.`,

    metadata: {
      protocolId:
        existing.section
          .protocolId,

      sectionId:
        existing.sectionId,

      questionId:
        question.id,

      previousResponseType:
        existing.responseType,

      currentResponseType:
        question.responseType,

      updatedAt:
        new Date().toISOString(),
    },
  });

  return question;
}

export async function deleteAuditProtocolQuestionService(
  input: {
    organizationId: string;
    userId: string;
    questionId: string;
  }
) {
  const question =
    await getQuestionRecord({
      organizationId:
        input.organizationId,

      questionId:
        input.questionId,
    });

  await assertProtocolStructureEditable({
    organizationId:
      input.organizationId,

    protocolId:
      question.section
        .protocolId,
  });

  const result =
    await deleteAuditProtocolQuestion({
      organizationId:
        input.organizationId,

      questionId:
        input.questionId,
    });

  if (!result.deleted) {
    if (
      result.reason ===
      "HAS_EXECUTION_HISTORY"
    ) {
      throw new Error(
        "This question has execution history and cannot be deleted. Create a new protocol version instead."
      );
    }

    throw new Error(
      "The protocol question could not be deleted."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocolQuestion",

    entityId:
      question.id,

    title:
      "Audit protocol question deleted",

    description:
      `A question was removed from ${question.section.protocol.name} version ${question.section.protocol.version}.`,

    metadata: {
      protocolId:
        question.section
          .protocolId,

      sectionId:
        question.sectionId,

      questionId:
        question.id,

      deletedAt:
        new Date().toISOString(),
    },
  });

  return result;
}

export async function replaceAuditQuestionOptionsService(
  input: {
    organizationId: string;
    userId: string;
    questionId: string;

    options:
      AuditQuestionOptionInput[];
  }
) {
  const question =
    await getQuestionRecord({
      organizationId:
        input.organizationId,

      questionId:
        input.questionId,
    });

  await assertProtocolStructureEditable({
    organizationId:
      input.organizationId,

    protocolId:
      question.section
        .protocolId,
  });

  validateQuestionOptions({
    responseType:
      question.responseType,

    options:
      input.options,
  });

  const updated =
    await replaceAuditQuestionOptions({
      organizationId:
        input.organizationId,

      questionId:
        input.questionId,

      options:
        input.options.map(
          (option) => ({
            label:
              option.label.trim(),

            value:
              option.value.trim(),

            description:
              normalizeOptionalText(
                option.description
              ),

            sequence:
              option.sequence,

            scoreValue:
              option.scoreValue ??
              null,

            isPassing:
              option.isPassing ??
              null,

            triggersFinding:
              option.triggersFinding,

            findingSeverity:
              option.findingSeverity ||
              null,

            isActive:
              option.isActive,
          })
        ),
    });

  if (!updated) {
    throw new Error(
      "The audit question options could not be updated."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocolQuestion",

    entityId:
      question.id,

    title:
      "Audit question options updated",

    description:
      `Answer options were updated for a question in ${question.section.protocol.name} version ${question.section.protocol.version}.`,

    metadata: {
      protocolId:
        question.section
          .protocolId,

      sectionId:
        question.sectionId,

      questionId:
        question.id,

      optionCount:
        input.options.length,

      findingTriggerOptionCount:
        input.options.filter(
          (option) =>
            option.triggersFinding
        ).length,

      updatedAt:
        new Date().toISOString(),
    },
  });

  return updated;
}

export async function archiveAuditProtocolService(
  input: {
    organizationId: string;
    userId: string;
    protocolId: string;
  }
) {
  const protocol =
    await getProtocolRecord({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,
    });

  if (
    protocol.status ===
      EnterpriseAuditProtocolStatus.ARCHIVED
  ) {
    throw new Error(
      "This protocol is already archived."
    );
  }

  const [
    activeSchedules,
    activeDefaultPrograms,
  ] = await Promise.all([
    prisma.auditSchedule.count({
      where: {
        protocolId:
          input.protocolId,

        autoGenerate:
          true,

        status:
          "ACTIVE",
      },
    }),

    prisma.auditProgram.count({
      where: {
        defaultProtocolId:
          input.protocolId,

        isActive:
          true,

        status: {
          not:
            "ARCHIVED",
        },
      },
    }),
  ]);

  if (
    activeSchedules > 0
  ) {
    throw new Error(
      "Remove or replace this protocol on all active automatic schedules before archiving it."
    );
  }

  if (
    activeDefaultPrograms > 0
  ) {
    throw new Error(
      "Remove or replace this protocol as the default for all active audit programs before archiving it."
    );
  }

  const archived =
    await archiveTenantAuditProtocol({
      organizationId:
        input.organizationId,

      protocolId:
        input.protocolId,

      updatedById:
        input.userId,
    });

  if (!archived) {
    throw new Error(
      "The audit protocol could not be archived."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProtocol",

    entityId:
      archived.id,

    title:
      "Audit protocol archived",

    description:
      `${archived.name} version ${archived.version} was archived.`,

    metadata: {
      protocolId:
        archived.id,

      previousStatus:
        protocol.status,

      currentStatus:
        archived.status,

      executionCount:
        protocol._count
          .enterpriseAudits,

      archivedAt:
        new Date().toISOString(),
    },
  });

  return archived;
}