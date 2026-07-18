import {
    createEnterpriseAuditFinding,
    createEnterpriseAuditFindingHistory,
    createEnterpriseAuditHistory,
    findEnterpriseAuditFindingForResponse,
    findTenantEnterpriseAuditExecutionContext,
    findTenantEnterpriseAuditQuestionForExecution,
    getEnterpriseAuditResponseSummary,
    getEnterpriseAuditSectionResponseSummary,
    getNextEnterpriseAuditFindingSequence,
    runAuditExecutionTransaction,
    updateEnterpriseAuditExecutionMetrics,
    updateEnterpriseAuditQuestionStatus,
    updateEnterpriseAuditSectionProgress,
    upsertEnterpriseAuditResponse,
  } from "@/modules/audit-v2/audit-execution.repository";
  import {
    EnterpriseAuditFindingCategory,
    EnterpriseAuditFindingStatus,
    EnterpriseAuditFindingTrigger,
    EnterpriseAuditFindingType,
    EnterpriseAuditHistoryAction,
    EnterpriseAuditQuestionStatus,
    EnterpriseAuditResponseResult,
    EnterpriseAuditSectionStatus,
    EnterpriseAuditSeverity,
    EnterpriseAuditStatus,
    Prisma,
  } from "@prisma/client";
  
  const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

const TERMINAL_AUDIT_STATUSES: ReadonlySet<EnterpriseAuditStatus> =
  new Set([
    EnterpriseAuditStatus.COMPLETED,
    EnterpriseAuditStatus.CANCELLED,
    EnterpriseAuditStatus.CLOSED,
  ]);

export type SaveEnterpriseAuditResponseInput = {
  organizationId: string;
  auditId: string;
  questionId: string;
  userId: string;
  result: EnterpriseAuditResponseResult;
  responseText?: string | null;
  numericValue?: number | string | Prisma.Decimal | null;
  booleanValue?: boolean | null;
  selectedOptionValues?: string[] | null;
  comments?: string | null;
};
  
  export type SaveEnterpriseAuditResponseResult = {
    responseId: string;
    auditId: string;
    questionId: string;
    sectionId: string;
    result: EnterpriseAuditResponseResult;
    scoreAwarded: Prisma.Decimal | null;
    maximumScore: Prisma.Decimal | null;
    isCompliant: boolean | null;
    requiresFollowUp: boolean;
    automaticFindingId: string | null;
    sectionProgress: {
      status: EnterpriseAuditSectionStatus;
      answeredQuestionCount: number;
      failedQuestionCount: number;
      achievedScore: Prisma.Decimal | null;
      maximumPossibleScore: Prisma.Decimal | null;
      scorePercentage: Prisma.Decimal | null;
    };
    auditProgress: {
      status: EnterpriseAuditStatus;
      answeredQuestionCount: number;
      failedQuestionCount: number;
      achievedScore: Prisma.Decimal | null;
      maximumPossibleScore: Prisma.Decimal | null;
      scorePercentage: Prisma.Decimal | null;
    };
  };
  
  type ExecutionQuestion =
    NonNullable<
      Awaited<
        ReturnType<
          typeof findTenantEnterpriseAuditQuestionForExecution
        >
      >
    >;
  
  type ResponseEvaluation = {
    scoreAwarded: Prisma.Decimal | null;
    maximumScore: Prisma.Decimal | null;
    isCompliant: boolean | null;
    requiresFollowUp: boolean;
    triggersFinding: boolean;
    findingSeverity: EnterpriseAuditSeverity | null;
  };
  
  function normalizeOptionalText(
    value: string | null | undefined
  ) {
    const normalized = value?.trim();
  
    return normalized || null;
  }
  
  function toDecimal(
    value:
      | number
      | string
      | Prisma.Decimal
      | null
      | undefined,
    fieldName: string
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }
  
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new Error(
        `${fieldName} must contain a valid number.`
      );
    }
  }
  
  function normalizeSelectedOptionValues(
    values: string[] | null | undefined
  ) {
    if (!values) {
      return [];
    }
  
    return Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
  }
  
  function isAnsweredResult(
    result: EnterpriseAuditResponseResult
  ) {
    return (
      result !==
      EnterpriseAuditResponseResult.NOT_ASSESSED
    );
  }
  
  function isNotApplicableResult(
    result: EnterpriseAuditResponseResult
  ) {
    return (
      result ===
      EnterpriseAuditResponseResult.NOT_APPLICABLE
    );
  }
  
  function isFailureResult(
    result: EnterpriseAuditResponseResult
  ) {
    const failureResults: ReadonlySet<EnterpriseAuditResponseResult> =
      new Set([
        EnterpriseAuditResponseResult.FAIL,
        EnterpriseAuditResponseResult.NO,
        EnterpriseAuditResponseResult.NON_COMPLIANT,
        EnterpriseAuditResponseResult.PARTIALLY_COMPLIANT,
      ]);
  
    return failureResults.has(result);
  }
  
  function isPassingResult(
    result: EnterpriseAuditResponseResult
  ) {
    const passingResults: ReadonlySet<EnterpriseAuditResponseResult> =
      new Set([
        EnterpriseAuditResponseResult.PASS,
        EnterpriseAuditResponseResult.YES,
        EnterpriseAuditResponseResult.COMPLIANT,
      ]);
  
    return passingResults.has(result);
  }
  
  function resultCompliance(
    result: EnterpriseAuditResponseResult
  ): boolean | null {
    if (isPassingResult(result)) {
      return true;
    }
  
    if (isFailureResult(result)) {
      return false;
    }
  
    return null;
  }
  
  function validateResponseInput(
    question: ExecutionQuestion,
    input: SaveEnterpriseAuditResponseInput,
    numericValue: Prisma.Decimal | null,
    selectedOptionValues: string[],
    comments: string | null
  ) {
    if (
      isNotApplicableResult(input.result) &&
      !question.allowNotApplicable
    ) {
      throw new Error(
        "This audit question does not allow a not-applicable response."
      );
    }
  
    if (
      question.requireComment &&
      isAnsweredResult(input.result) &&
      !comments
    ) {
      throw new Error(
        "A comment is required for this audit question."
      );
    }
  
    if (
      numericValue !== null &&
      question.minimumNumericValue !== null &&
      numericValue.lessThan(
        question.minimumNumericValue
      )
    ) {
      throw new Error(
        `The numeric response must be at least ${question.minimumNumericValue.toString()}.`
      );
    }
  
    if (
      numericValue !== null &&
      question.maximumNumericValue !== null &&
      numericValue.greaterThan(
        question.maximumNumericValue
      )
    ) {
      throw new Error(
        `The numeric response must not exceed ${question.maximumNumericValue.toString()}.`
      );
    }
  
    if (selectedOptionValues.length > 0) {
      const validOptionValues = new Set(
        question.options.map(
          (option) => option.value
        )
      );
  
      const invalidOption = selectedOptionValues.find(
        (value) => !validOptionValues.has(value)
      );
  
      if (invalidOption) {
        throw new Error(
          `The selected audit response option "${invalidOption}" is invalid.`
        );
      }
    }
  }
  
  function evaluateOptionResponse(
    question: ExecutionQuestion,
    selectedOptionValues: string[]
  ) {
    const selectedOptions =
      question.options.filter((option) =>
        selectedOptionValues.includes(
          option.value
        )
      );
  
    if (selectedOptions.length === 0) {
      return {
        scoreAwarded: null,
        isCompliant: null,
        triggersFinding: false,
        findingSeverity: null,
      };
    }
  
    const scoredOptions = selectedOptions.filter(
      (option) => option.scoreValue !== null
    );
  
    const scoreAwarded =
      scoredOptions.length > 0
        ? scoredOptions.reduce(
            (total, option) =>
              total.add(
                option.scoreValue ?? ZERO
              ),
            ZERO
          )
        : null;
  
    const passingFlags = selectedOptions
      .map((option) => option.isPassing)
      .filter(
        (
          value
        ): value is boolean =>
          value !== null
      );
  
    const isCompliant =
      passingFlags.length === 0
        ? null
        : passingFlags.every(Boolean);
  
    const triggeringOptions =
      selectedOptions.filter(
        (option) => option.triggersFinding
      );
  
    const severityOrder: Record<
      EnterpriseAuditSeverity,
      number
    > = {
      OBSERVATION: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };
  
    const findingSeverity =
      triggeringOptions
        .map((option) => option.findingSeverity)
        .filter(
          (
            severity
          ): severity is EnterpriseAuditSeverity =>
            severity !== null
        )
        .sort(
          (left, right) =>
            severityOrder[right] -
            severityOrder[left]
        )[0] ?? null;
  
    return {
      scoreAwarded,
      isCompliant,
      triggersFinding:
        triggeringOptions.length > 0,
      findingSeverity,
    };
  }
  
  function evaluateResponse(
    question: ExecutionQuestion,
    input: SaveEnterpriseAuditResponseInput,
    numericValue: Prisma.Decimal | null,
    selectedOptionValues: string[]
  ): ResponseEvaluation {
    const maximumScore =
      question.maximumScore ??
      new Prisma.Decimal(question.weight);
  
    if (!isAnsweredResult(input.result)) {
      return {
        scoreAwarded: null,
        maximumScore,
        isCompliant: null,
        requiresFollowUp: false,
        triggersFinding: false,
        findingSeverity: null,
      };
    }
  
    if (isNotApplicableResult(input.result)) {
      return {
        scoreAwarded: null,
        maximumScore: null,
        isCompliant: null,
        requiresFollowUp: false,
        triggersFinding: false,
        findingSeverity: null,
      };
    }
  
    const optionEvaluation =
      evaluateOptionResponse(
        question,
        selectedOptionValues
      );
  
    let isCompliant =
      optionEvaluation.isCompliant ??
      resultCompliance(input.result);
  
    let scoreAwarded =
      optionEvaluation.scoreAwarded;
  
    if (
      scoreAwarded === null &&
      numericValue !== null
    ) {
      scoreAwarded = numericValue;
  
      if (
        question.minimumPassingScore !== null
      ) {
        isCompliant =
          numericValue.greaterThanOrEqualTo(
            question.minimumPassingScore
          );
      }
    }
  
    if (
      scoreAwarded === null &&
      isCompliant !== null
    ) {
      scoreAwarded = isCompliant
        ? maximumScore
        : ZERO;
    }
  
    if (
      scoreAwarded !== null &&
      scoreAwarded.lessThan(ZERO)
    ) {
      scoreAwarded = ZERO;
    }
  
    if (
      scoreAwarded !== null &&
      maximumScore !== null &&
      scoreAwarded.greaterThan(maximumScore)
    ) {
      scoreAwarded = maximumScore;
    }
  
    const trigger = question.findingTrigger;
  
    const triggersFinding =
      trigger ===
        EnterpriseAuditFindingTrigger.ON_FAIL
        ? input.result ===
          EnterpriseAuditResponseResult.FAIL
        : trigger ===
            EnterpriseAuditFindingTrigger.ON_NO
          ? input.result ===
            EnterpriseAuditResponseResult.NO
          : trigger ===
              EnterpriseAuditFindingTrigger.BELOW_THRESHOLD
            ? numericValue !== null &&
              question.minimumPassingScore !==
                null &&
              numericValue.lessThan(
                question.minimumPassingScore
              )
            : trigger ===
                EnterpriseAuditFindingTrigger.ABOVE_THRESHOLD
              ? numericValue !== null &&
                question.maximumNumericValue !==
                  null &&
                numericValue.greaterThan(
                  question.maximumNumericValue
                )
              : trigger ===
                  EnterpriseAuditFindingTrigger.SELECTED_OPTIONS
                ? optionEvaluation.triggersFinding
                : trigger ===
                    EnterpriseAuditFindingTrigger.NEVER
                  ? false
                  : isCompliant === false;
  
    const requiresFollowUp =
      isCompliant === false ||
      triggersFinding ||
      input.result ===
        EnterpriseAuditResponseResult.OBSERVATION;
  
    return {
      scoreAwarded,
      maximumScore,
      isCompliant,
      requiresFollowUp,
      triggersFinding,
      findingSeverity:
        optionEvaluation.findingSeverity ??
        question.defaultSeverity ??
        null,
    };
  }
  
  function calculatePercentage(
    achievedScore: Prisma.Decimal,
    maximumScore: Prisma.Decimal
  ) {
    if (
      maximumScore.lessThanOrEqualTo(ZERO)
    ) {
      return null;
    }
  
    return achievedScore
      .dividedBy(maximumScore)
      .times(ONE_HUNDRED)
      .toDecimalPlaces(2);
  }
  
  function isQuestionAnswered(
    question: {
      status: EnterpriseAuditQuestionStatus;
      response: {
        result: EnterpriseAuditResponseResult;
        answeredAt: Date | null;
      } | null;
    }
  ) {
    return Boolean(
      question.response &&
        question.response.answeredAt &&
        question.response.result !==
          EnterpriseAuditResponseResult.NOT_ASSESSED
    );
  }
  
  function isQuestionFailed(
    question: {
      response: {
        isCompliant: boolean | null;
        requiresFollowUp: boolean;
      } | null;
    }
  ) {
    return Boolean(
      question.response &&
        (question.response.isCompliant ===
          false ||
          question.response.requiresFollowUp)
    );
  }
  
  function calculateProgress(
    questions: Awaited<
      ReturnType<
        typeof getEnterpriseAuditSectionResponseSummary
      >
    >
  ) {
    let answeredQuestionCount = 0;
    let failedQuestionCount = 0;
    let achievedScore = ZERO;
    let maximumPossibleScore = ZERO;
  
    for (const question of questions) {
      const answered =
        isQuestionAnswered(question);
  
      if (answered) {
        answeredQuestionCount += 1;
      }
  
      if (isQuestionFailed(question)) {
        failedQuestionCount += 1;
      }
  
      if (
        answered &&
        question.response?.scoreAwarded !==
          null &&
        question.response?.scoreAwarded !==
          undefined
      ) {
        achievedScore = achievedScore.add(
          question.response.scoreAwarded
        );
      }
  
      if (
        answered &&
        question.response?.maximumScore !==
          null &&
        question.response?.maximumScore !==
          undefined
      ) {
        maximumPossibleScore =
          maximumPossibleScore.add(
            question.response.maximumScore
          );
      }
    }
  
    return {
      answeredQuestionCount,
      failedQuestionCount,
      achievedScore:
        answeredQuestionCount > 0
          ? achievedScore
          : null,
      maximumPossibleScore:
        maximumPossibleScore.greaterThan(ZERO)
          ? maximumPossibleScore
          : null,
      scorePercentage:
        maximumPossibleScore.greaterThan(ZERO)
          ? calculatePercentage(
              achievedScore,
              maximumPossibleScore
            )
          : null,
    };
  }
  
  function calculateSectionStatus(
    questions: Awaited<
      ReturnType<
        typeof getEnterpriseAuditSectionResponseSummary
      >
    >,
    answeredQuestionCount: number
  ) {
    if (questions.length === 0) {
      return EnterpriseAuditSectionStatus.NOT_APPLICABLE;
    }
  
    const requiredQuestions =
      questions.filter(
        (question) => question.isRequired
      );
  
    const requiredAnsweredCount =
      requiredQuestions.filter(
        isQuestionAnswered
      ).length;
  
    if (
      requiredQuestions.length > 0 &&
      requiredAnsweredCount ===
        requiredQuestions.length
    ) {
      return EnterpriseAuditSectionStatus.COMPLETED;
    }
  
    if (
      requiredQuestions.length === 0 &&
      answeredQuestionCount ===
        questions.length
    ) {
      return EnterpriseAuditSectionStatus.COMPLETED;
    }
  
    if (answeredQuestionCount > 0) {
      return EnterpriseAuditSectionStatus.IN_PROGRESS;
    }
  
    return EnterpriseAuditSectionStatus.NOT_STARTED;
  }
  
  function calculateAuditStatus(
    audit: NonNullable<
      Awaited<
        ReturnType<
          typeof findTenantEnterpriseAuditExecutionContext
        >
      >
    >,
    questions: Awaited<
      ReturnType<
        typeof getEnterpriseAuditResponseSummary
      >
    >,
    answeredQuestionCount: number
  ) {
    if (
      audit.status ===
        EnterpriseAuditStatus.CANCELLED ||
      audit.status ===
        EnterpriseAuditStatus.CLOSED
    ) {
      return audit.status;
    }
  
    const requiredQuestions =
      questions.filter(
        (question) => question.isRequired
      );
  
    const allRequiredAnswered =
      requiredQuestions.every(
        isQuestionAnswered
      );
  
    if (
      requiredQuestions.length > 0 &&
      allRequiredAnswered
    ) {
      return EnterpriseAuditStatus.PENDING_REVIEW;
    }
  
    if (
      requiredQuestions.length === 0 &&
      answeredQuestionCount ===
        questions.length &&
      questions.length > 0
    ) {
      return EnterpriseAuditStatus.PENDING_REVIEW;
    }
  
    if (answeredQuestionCount > 0) {
      return EnterpriseAuditStatus.IN_PROGRESS;
    }
  
    return audit.status ===
      EnterpriseAuditStatus.DRAFT
      ? EnterpriseAuditStatus.DRAFT
      : EnterpriseAuditStatus.SCHEDULED;
  }
  
  function questionStatusForResult(
    result: EnterpriseAuditResponseResult
  ) {
    if (
      result ===
      EnterpriseAuditResponseResult.NOT_ASSESSED
    ) {
      return EnterpriseAuditQuestionStatus.NOT_ASSESSED;
    }
  
    if (
      result ===
      EnterpriseAuditResponseResult.NOT_APPLICABLE
    ) {
      return EnterpriseAuditQuestionStatus.NOT_APPLICABLE;
    }
  
    return EnterpriseAuditQuestionStatus.ANSWERED;
  }
  
  function buildFindingReference(
    auditReference: string,
    sequence: number
  ) {
    return `${auditReference}-F${String(
      sequence
    ).padStart(3, "0")}`;
  }
  
  function buildFindingTitle(
    question: ExecutionQuestion
  ) {
    return (
      normalizeOptionalText(
        question.findingTitleTemplate
      ) ||
      `Finding: ${question.questionText}`
    );
  }
  
  function buildFindingDescription(
    question: ExecutionQuestion,
    input: SaveEnterpriseAuditResponseInput
  ) {
    return (
      normalizeOptionalText(
        question.findingDescriptionTemplate
      ) ||
      normalizeOptionalText(input.comments) ||
      normalizeOptionalText(
        input.responseText
      ) ||
      `The recorded response to "${question.questionText}" requires follow-up.`
    );
  }
  
  async function createAutomaticFindingIfRequired(
    input: {
      organizationId: string;
      userId: string;
      audit: {
        id: string;
        reference: string;
        ownerId: string | null;
        leadAuditorId: string | null;
      };
      question: ExecutionQuestion;
      response: {
        id: string;
      };
      responseInput: SaveEnterpriseAuditResponseInput;
      evaluation: ResponseEvaluation;
    },
    transaction: Prisma.TransactionClient
  ) {
    if (
      !input.question
        .automaticallyCreateFinding ||
      !input.evaluation.triggersFinding
    ) {
      return null;
    }
  
    const existingFinding =
      await findEnterpriseAuditFindingForResponse(
        {
          auditId: input.audit.id,
          questionId: input.question.id,
          responseId: input.response.id,
        },
        transaction
      );
  
    if (existingFinding) {
      return existingFinding;
    }
  
    const sequence =
      await getNextEnterpriseAuditFindingSequence(
        {
          organizationId:
            input.organizationId,
          auditId: input.audit.id,
        },
        transaction
      );
  
    const now = new Date();
  
    const finding =
      await createEnterpriseAuditFinding(
        {
          organizationId:
            input.organizationId,
          auditId: input.audit.id,
          questionId: input.question.id,
          responseId: input.response.id,
          reference: buildFindingReference(
            input.audit.reference,
            sequence
          ),
          title: buildFindingTitle(
            input.question
          ),
          findingType:
            EnterpriseAuditFindingType.NONCONFORMITY,
          category:
            EnterpriseAuditFindingCategory.OTHER,
          severity:
            input.evaluation
              .findingSeverity ??
            EnterpriseAuditSeverity.MEDIUM,
          status:
            EnterpriseAuditFindingStatus.OPEN,
          description:
            buildFindingDescription(
              input.question,
              input.responseInput
            ),
          objectiveEvidence:
            normalizeOptionalText(
              input.responseInput.comments
            ) ??
            normalizeOptionalText(
              input.responseInput.responseText
            ),
          standardClause:
            input.question.standardClause,
          regulatoryRef:
            input.question.regulatoryRef,
          ownerId:
            input.audit.ownerId ??
            input.audit.leadAuditorId,
          requiresCapa:
            input.question
              .automaticallySuggestCapa,
          requiresRiskReview:
            input.question
              .automaticallySuggestRisk,
          capaSuggestedAt:
            input.question
              .automaticallySuggestCapa
              ? now
              : null,
          riskSuggestedAt:
            input.question
              .automaticallySuggestRisk
              ? now
              : null,
          createdById: input.userId,
          updatedById: input.userId,
        },
        transaction
      );
  
    await createEnterpriseAuditFindingHistory(
      {
        findingId: finding.id,
        userId: input.userId,
        action:
          EnterpriseAuditHistoryAction.FINDING_CREATED,
        title:
          "Audit finding created automatically",
        description:
          `${finding.reference} was created from an audit response.`,
        metadata: {
          auditId: input.audit.id,
          questionId: input.question.id,
          responseId: input.response.id,
          severity: finding.severity,
          requiresCapa:
            finding.requiresCapa,
          requiresRiskReview:
            finding.requiresRiskReview,
        },
      },
      transaction
    );
  
    await createEnterpriseAuditHistory(
      {
        organizationId:
          input.organizationId,
        auditId: input.audit.id,
        userId: input.userId,
        action:
          EnterpriseAuditHistoryAction.FINDING_CREATED,
        entityType:
          "EnterpriseAuditFinding",
        entityId: finding.id,
        title:
          "Automatic audit finding created",
        description:
          `${finding.reference}: ${finding.title}`,
        metadata: {
          questionId: input.question.id,
          responseId: input.response.id,
          severity: finding.severity,
        },
      },
      transaction
    );
  
    return finding;
  }
  
  export async function saveEnterpriseAuditResponseService(
    input: SaveEnterpriseAuditResponseInput
  ): Promise<SaveEnterpriseAuditResponseResult> {
    const responseText =
      normalizeOptionalText(
        input.responseText
      );
  
    const comments =
      normalizeOptionalText(
        input.comments
      );
  
    const numericValue = toDecimal(
      input.numericValue,
      "Numeric response"
    );
  
    const selectedOptionValues =
      normalizeSelectedOptionValues(
        input.selectedOptionValues
      );
  
    return runAuditExecutionTransaction(
      async (transaction) => {
        const [audit, question] =
          await Promise.all([
            findTenantEnterpriseAuditExecutionContext(
              {
                organizationId:
                  input.organizationId,
                auditId: input.auditId,
              },
              transaction
            ),
  
            findTenantEnterpriseAuditQuestionForExecution(
              {
                organizationId:
                  input.organizationId,
                auditId: input.auditId,
                questionId:
                  input.questionId,
              },
              transaction
            ),
          ]);
  
        if (!audit) {
          throw new Error(
            "Enterprise audit not found in this organization."
          );
        }
  
        if (!question) {
          throw new Error(
            "Enterprise audit question not found."
          );
        }
  
        if (TERMINAL_AUDIT_STATUSES.has(audit.status)) {
            throw new Error(
              "Responses cannot be changed after this audit has been completed, cancelled, or closed."
            );
          }
  
        validateResponseInput(
          question,
          input,
          numericValue,
          selectedOptionValues,
          comments
        );
  
        const evaluation =
          evaluateResponse(
            question,
            input,
            numericValue,
            selectedOptionValues
          );
  
        const answeredAt =
          isAnsweredResult(input.result)
            ? new Date()
            : null;
  
        const previousResponse =
          question.response;
  
        const response =
          await upsertEnterpriseAuditResponse(
            {
              auditId: audit.id,
              questionId: question.id,
              answeredById:
                isAnsweredResult(input.result)
                  ? input.userId
                  : null,
              result: input.result,
              responseText,
              numericValue,
              booleanValue:
                input.booleanValue ?? null,
              selectedOptionValues:
                selectedOptionValues.length > 0
                  ? selectedOptionValues
                  : null,
              comments,
              scoreAwarded:
                evaluation.scoreAwarded,
              maximumScore:
                evaluation.maximumScore,
              isCompliant:
                evaluation.isCompliant,
              requiresFollowUp:
                evaluation.requiresFollowUp,
              answeredAt,
            },
            transaction
          );
  
        await updateEnterpriseAuditQuestionStatus(
          {
            questionId: question.id,
            status:
              questionStatusForResult(
                input.result
              ),
          },
          transaction
        );
  
        const automaticFinding =
          await createAutomaticFindingIfRequired(
            {
              organizationId:
                input.organizationId,
              userId: input.userId,
              audit,
              question,
              response,
              responseInput: input,
              evaluation,
            },
            transaction
          );
  
        const sectionQuestions =
          await getEnterpriseAuditSectionResponseSummary(
            {
              auditId: audit.id,
              sectionId: question.sectionId,
            },
            transaction
          );
  
        const sectionProgress =
          calculateProgress(
            sectionQuestions
          );
  
        const sectionStatus =
          calculateSectionStatus(
            sectionQuestions,
            sectionProgress
              .answeredQuestionCount
          );
  
        const existingSection =
          audit.sections.find(
            (section) =>
              section.id ===
              question.sectionId
          );
  
        await updateEnterpriseAuditSectionProgress(
          {
            sectionId: question.sectionId,
            status: sectionStatus,
            answeredQuestionCount:
              sectionProgress
                .answeredQuestionCount,
            failedQuestionCount:
              sectionProgress
                .failedQuestionCount,
            achievedScore:
              sectionProgress
                .achievedScore,
            maximumPossibleScore:
              sectionProgress
                .maximumPossibleScore,
            scorePercentage:
              sectionProgress
                .scorePercentage,
            startedAt:
              sectionProgress
                  .answeredQuestionCount >
                0
                ? existingSection
                    ?.startedAt ??
                  new Date()
                : null,
            completedAt:
              sectionStatus ===
              EnterpriseAuditSectionStatus.COMPLETED
                ? existingSection
                    ?.completedAt ??
                  new Date()
                : null,
          },
          transaction
        );
  
        const auditQuestions =
          await getEnterpriseAuditResponseSummary(
            {
              auditId: audit.id,
            },
            transaction
          );
  
        const auditProgress =
          calculateProgress(
            auditQuestions
          );
  
        const auditStatus =
          calculateAuditStatus(
            audit,
            auditQuestions,
            auditProgress
              .answeredQuestionCount
          );
  
          await updateEnterpriseAuditExecutionMetrics(
            {
              auditId: audit.id,
              data: {
                status: auditStatus,
                answeredQuestionCount:
                  auditProgress.answeredQuestionCount,
                failedQuestionCount:
                  auditProgress.failedQuestionCount,
                achievedScore:
                  auditProgress.achievedScore,
                maximumPossibleScore:
                  auditProgress.maximumPossibleScore,
                scorePercentage:
                  auditProgress.scorePercentage,
                startedAt:
                  auditProgress.answeredQuestionCount > 0
                    ? audit.startedAt ?? new Date()
                    : audit.startedAt,
                updatedBy: {
                  connect: {
                    id: input.userId,
                  },
                },
              },
            },
            transaction
          );
  
        await createEnterpriseAuditHistory(
          {
            organizationId:
              input.organizationId,
            auditId: audit.id,
            userId: input.userId,
            action:
              EnterpriseAuditHistoryAction.RESPONSE_RECORDED,
            entityType:
              "EnterpriseAuditResponse",
            entityId: response.id,
            title:
              previousResponse
                ? "Audit response updated"
                : "Audit response recorded",
            description:
              question.questionText,
            previousValue:
              previousResponse
                ? {
                    result:
                      previousResponse.result,
                    responseText:
                      previousResponse.responseText,
                    numericValue:
                      previousResponse.numericValue?.toString() ??
                      null,
                    booleanValue:
                      previousResponse.booleanValue,
                    selectedOptionValues:
                      previousResponse.selectedOptionValues,
                    comments:
                      previousResponse.comments,
                    scoreAwarded:
                      previousResponse.scoreAwarded?.toString() ??
                      null,
                    isCompliant:
                      previousResponse.isCompliant,
                    requiresFollowUp:
                      previousResponse.requiresFollowUp,
                  }
                : null,
            newValue: {
              result: response.result,
              responseText:
                response.responseText,
              numericValue:
                response.numericValue?.toString() ??
                null,
              booleanValue:
                response.booleanValue,
              selectedOptionValues:
                response.selectedOptionValues,
              comments: response.comments,
              scoreAwarded:
                response.scoreAwarded?.toString() ??
                null,
              isCompliant:
                response.isCompliant,
              requiresFollowUp:
                response.requiresFollowUp,
            },
            metadata: {
              questionId: question.id,
              sectionId:
                question.sectionId,
              sectionStatus,
              auditStatus,
              automaticFindingId:
                automaticFinding?.id ??
                null,
            },
          },
          transaction
        );
  
        return {
          responseId: response.id,
          auditId: audit.id,
          questionId: question.id,
          sectionId: question.sectionId,
          result: response.result,
          scoreAwarded:
            response.scoreAwarded,
          maximumScore:
            response.maximumScore,
          isCompliant:
            response.isCompliant,
          requiresFollowUp:
            response.requiresFollowUp,
          automaticFindingId:
            automaticFinding?.id ?? null,
          sectionProgress: {
            status: sectionStatus,
            answeredQuestionCount:
              sectionProgress
                .answeredQuestionCount,
            failedQuestionCount:
              sectionProgress
                .failedQuestionCount,
            achievedScore:
              sectionProgress
                .achievedScore,
            maximumPossibleScore:
              sectionProgress
                .maximumPossibleScore,
            scorePercentage:
              sectionProgress
                .scorePercentage,
          },
          auditProgress: {
            status: auditStatus,
            answeredQuestionCount:
              auditProgress
                .answeredQuestionCount,
            failedQuestionCount:
              auditProgress
                .failedQuestionCount,
            achievedScore:
              auditProgress
                .achievedScore,
            maximumPossibleScore:
              auditProgress
                .maximumPossibleScore,
            scorePercentage:
              auditProgress
                .scorePercentage,
          },
        };
      }
    );
  }