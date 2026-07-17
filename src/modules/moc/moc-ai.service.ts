import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getOpenAIClient,
  getOpenAIModel,
} from "@/core/ai/openai.service";
import { calculateRiskRating } from "@/modules/risk/risk-scoring";
import { findTenantMocById } from "@/modules/moc/moc.repository";
import {
  ActivityAction,
  MocApprovalRole,
  MocTaskType,
  RiskImpact,
  RiskLikelihood,
} from "@prisma/client";
import type {
  MocAiAssessmentDraft,
} from "./moc-ai.types";

const significanceEnum = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

const hazardCategoryEnum = [
  "SAFETY",
  "ENVIRONMENTAL",
  "OPERATIONAL",
  "QUALITY",
  "REGULATORY",
  "SECURITY",
  "TECHNOLOGY",
  "HUMAN_FACTORS",
  "OTHER",
] as const;

const controlHierarchyEnum = [
  "ELIMINATION",
  "SUBSTITUTION",
  "ENGINEERING",
  "ADMINISTRATIVE",
  "TRAINING",
  "PPE",
  "MONITORING",
  "OTHER",
] as const;

const approvalRoleEnum =
  Object.values(
    MocApprovalRole
  );

const taskTypeEnum =
  Object.values(
    MocTaskType
  );

const riskLikelihoodEnum =
  Object.values(
    RiskLikelihood
  );

const riskImpactEnum =
  Object.values(
    RiskImpact
  );

const stringArraySchema = {
  type: "array",

  items: {
    type: "string",
  },
} as const;

const mocHazardSchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "title",
    "category",
    "description",
    "exposurePathway",
    "potentialConsequence",
    "significance",
    "evidenceBasis",
  ],

  properties: {
    title: {
      type: "string",
    },

    category: {
      type: "string",
      enum: hazardCategoryEnum,
    },

    description: {
      type: "string",
    },

    exposurePathway: {
      type: "string",
    },

    potentialConsequence: {
      type: "string",
    },

    significance: {
      type: "string",
      enum: significanceEnum,
    },

    evidenceBasis: {
      type: "string",
    },
  },
} as const;

const mocControlSchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "recommendationId",
    "title",
    "description",
    "hierarchy",
    "priority",
    "rationale",
    "addressesHazards",
    "suggestedOwnerFunction",
    "verificationMethod",
    "effectivenessCriteria",
    "evidenceBasis",
    "duplicationAssessment",
  ],

  properties: {
    recommendationId: {
      type: "string",
    },

    title: {
      type: "string",
    },

    description: {
      type: "string",
    },

    hierarchy: {
      type: "string",
      enum: controlHierarchyEnum,
    },

    priority: {
      type: "string",

      enum: [
        "IMMEDIATE",
        "HIGH",
        "MEDIUM",
        "LOW",
      ],
    },

    rationale: {
      type: "string",
    },

    addressesHazards:
      stringArraySchema,

    suggestedOwnerFunction: {
      type: "string",
    },

    verificationMethod: {
      type: "string",
    },

    effectivenessCriteria:
      stringArraySchema,

    evidenceBasis: {
      type: "string",
    },

    duplicationAssessment: {
      type: "object",

      additionalProperties: false,

      required: [
        "appearsDuplicative",
        "explanation",
      ],

      properties: {
        appearsDuplicative: {
          type: "boolean",
        },

        explanation: {
          type: "string",
        },
      },
    },
  },
} as const;

const mocApprovalSchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "role",
    "sequence",
    "rationale",
    "required",
  ],

  properties: {
    role: {
      type: "string",
      enum: approvalRoleEnum,
    },

    sequence: {
      type: "integer",
      minimum: 1,
      maximum: 20,
    },

    rationale: {
      type: "string",
    },

    required: {
      type: "boolean",
    },
  },
} as const;

const mocTaskSchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "recommendationId",
    "title",
    "description",
    "taskType",
    "sequence",
    "required",
    "suggestedOwnerFunction",
    "suggestedDueDays",
    "completionEvidence",
    "verificationCriteria",
  ],

  properties: {
    recommendationId: {
      type: "string",
    },

    title: {
      type: "string",
    },

    description: {
      type: "string",
    },

    taskType: {
      type: "string",
      enum: taskTypeEnum,
    },

    sequence: {
      type: "integer",
      minimum: 1,
      maximum: 100,
    },

    required: {
      type: "boolean",
    },

    suggestedOwnerFunction: {
      type: "string",
    },

    suggestedDueDays: {
      type: "integer",
      minimum: 1,
      maximum: 365,
    },

    completionEvidence: {
      type: "string",
    },

    verificationCriteria:
      stringArraySchema,
  },
} as const;

const verificationActivitySchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "title",
    "description",
    "suggestedOwnerFunction",
    "timing",
    "evidenceRequired",
    "acceptanceCriteria",
  ],

  properties: {
    title: {
      type: "string",
    },

    description: {
      type: "string",
    },

    suggestedOwnerFunction: {
      type: "string",
    },

    timing: {
      type: "string",
    },

    evidenceRequired: {
      type: "string",
    },

    acceptanceCriteria:
      stringArraySchema,
  },
} as const;

const managementPrioritySchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "priority",
    "title",
    "recommendedAction",
    "rationale",
    "suggestedOwnerFunction",
    "suggestedTimeframe",
    "successMeasure",
  ],

  properties: {
    priority: {
      type: "integer",
      minimum: 1,
      maximum: 10,
    },

    title: {
      type: "string",
    },

    recommendedAction: {
      type: "string",
    },

    rationale: {
      type: "string",
    },

    suggestedOwnerFunction: {
      type: "string",
    },

    suggestedTimeframe: {
      type: "string",
    },

    successMeasure: {
      type: "string",
    },
  },
} as const;

const mocAiSchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "executiveSummary",
    "changeConditionAssessment",
    "majorHazards",
    "operationalRisks",
    "environmentalRisks",
    "safetyRisks",
    "qualityRisks",
    "regulatoryConsiderations",
    "humanFactorConsiderations",
    "recommendedControls",
    "residualRiskRecommendation",
    "recommendedApprovals",
    "recommendedTasks",
    "verificationActivities",
    "documentationUpdates",
    "trainingNeeds",
    "inspectionNeeds",
    "communicationNeeds",
    "informationGaps",
    "reviewQuestions",
    "escalationConsiderations",
    "managementPriorities",
    "confidenceAssessment",
    "limitationsNotice",
  ],

  properties: {
    executiveSummary: {
      type: "string",
    },

    changeConditionAssessment: {
      type: "object",

      additionalProperties: false,

      required: [
        "scopeClarity",
        "impactClarity",
        "implementationReadiness",
        "rationale",
      ],

      properties: {
        scopeClarity: {
          type: "string",

          enum: [
            "ADEQUATE",
            "PARTIALLY_ADEQUATE",
            "INADEQUATE",
          ],
        },

        impactClarity: {
          type: "string",

          enum: [
            "ADEQUATE",
            "PARTIALLY_ADEQUATE",
            "INADEQUATE",
          ],
        },

        implementationReadiness: {
          type: "string",

          enum: [
            "READY_FOR_REVIEW",
            "ADDITIONAL_INFORMATION_REQUIRED",
            "SIGNIFICANT_GAPS",
          ],
        },

        rationale: {
          type: "string",
        },
      },
    },

    majorHazards: {
      type: "array",
      maxItems: 20,
      items: mocHazardSchema,
    },

    operationalRisks:
      stringArraySchema,

    environmentalRisks:
      stringArraySchema,

    safetyRisks:
      stringArraySchema,

    qualityRisks:
      stringArraySchema,

    regulatoryConsiderations:
      stringArraySchema,

    humanFactorConsiderations:
      stringArraySchema,

    recommendedControls: {
      type: "array",
      maxItems: 20,
      items: mocControlSchema,
    },

    residualRiskRecommendation: {
      type: "object",

      additionalProperties: false,

      required: [
        "likelihood",
        "impact",
        "rationale",
        "assumptions",
      ],

      properties: {
        likelihood: {
          type: "string",
          enum: riskLikelihoodEnum,
        },

        impact: {
          type: "string",
          enum: riskImpactEnum,
        },

        rationale: {
          type: "string",
        },

        assumptions:
          stringArraySchema,
      },
    },

    recommendedApprovals: {
      type: "array",
      maxItems: 12,
      items: mocApprovalSchema,
    },

    recommendedTasks: {
      type: "array",
      maxItems: 30,
      items: mocTaskSchema,
    },

    verificationActivities: {
      type: "array",
      maxItems: 20,
      items:
        verificationActivitySchema,
    },

    documentationUpdates:
      stringArraySchema,

    trainingNeeds:
      stringArraySchema,

    inspectionNeeds:
      stringArraySchema,

    communicationNeeds:
      stringArraySchema,

    informationGaps:
      stringArraySchema,

    reviewQuestions:
      stringArraySchema,

    escalationConsiderations:
      stringArraySchema,

    managementPriorities: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items:
        managementPrioritySchema,
    },

    confidenceAssessment: {
      type: "object",

      additionalProperties: false,

      required: [
        "level",
        "rationale",
      ],

      properties: {
        level: {
          type: "string",

          enum: [
            "LOW",
            "MEDIUM",
            "HIGH",
          ],
        },

        rationale: {
          type: "string",
        },
      },
    },

    limitationsNotice: {
      type: "string",
    },
  },
} as const;

type RawMocAiAssessment =
  Omit<
    MocAiAssessmentDraft,
    "residualRiskRecommendation"
  > & {
    residualRiskRecommendation: {
      likelihood: RiskLikelihood;
      impact: RiskImpact;
      rationale: string;
      assumptions: string[];
    };
  };

function parseMocAiAssessment(
  value: string
): RawMocAiAssessment {
  let parsedValue: unknown;

  try {
    parsedValue =
      JSON.parse(value);
  } catch {
    throw new Error(
      "The AI service returned an invalid MOC assessment."
    );
  }

  if (
    !parsedValue ||
    typeof parsedValue !==
      "object"
  ) {
    throw new Error(
      "The AI service returned an empty MOC assessment."
    );
  }

  const draft =
    parsedValue as Partial<RawMocAiAssessment>;

  if (
    typeof draft.executiveSummary !==
      "string" ||
    !draft.changeConditionAssessment ||
    !Array.isArray(
      draft.majorHazards
    ) ||
    !Array.isArray(
      draft.operationalRisks
    ) ||
    !Array.isArray(
      draft.environmentalRisks
    ) ||
    !Array.isArray(
      draft.safetyRisks
    ) ||
    !Array.isArray(
      draft.qualityRisks
    ) ||
    !Array.isArray(
      draft.regulatoryConsiderations
    ) ||
    !Array.isArray(
      draft.humanFactorConsiderations
    ) ||
    !Array.isArray(
      draft.recommendedControls
    ) ||
    !draft.residualRiskRecommendation ||
    !Array.isArray(
      draft.residualRiskRecommendation
        .assumptions
    ) ||
    !Array.isArray(
      draft.recommendedApprovals
    ) ||
    !Array.isArray(
      draft.recommendedTasks
    ) ||
    !Array.isArray(
      draft.verificationActivities
    ) ||
    !Array.isArray(
      draft.documentationUpdates
    ) ||
    !Array.isArray(
      draft.trainingNeeds
    ) ||
    !Array.isArray(
      draft.inspectionNeeds
    ) ||
    !Array.isArray(
      draft.communicationNeeds
    ) ||
    !Array.isArray(
      draft.informationGaps
    ) ||
    !Array.isArray(
      draft.reviewQuestions
    ) ||
    !Array.isArray(
      draft.escalationConsiderations
    ) ||
    !Array.isArray(
      draft.managementPriorities
    ) ||
    !draft.confidenceAssessment ||
    typeof draft.limitationsNotice !==
      "string"
  ) {
    throw new Error(
      "The AI service returned an incomplete MOC assessment."
    );
  }

  return draft as RawMocAiAssessment;
}

export async function generateMocAiAssessmentService(
  input: {
    organizationId: string;
    userId: string;
    mocId: string;
    reviewerContext?:
      | string
      | null;
  }
): Promise<MocAiAssessmentDraft> {
  const moc =
    await findTenantMocById({
      organizationId:
        input.organizationId,
      mocId: input.mocId,
    });

  if (!moc) {
    throw new Error(
      "Management of change record not found in this organization."
    );
  }

  const context = {
    change: {
      reference:
        moc.reference,

      title:
        moc.title,

      description:
        moc.description,

      businessJustification:
        moc.businessJustification,

      changeType:
        moc.changeType,

      changeDuration:
        moc.changeDuration,

      priority:
        moc.priority,

      status:
        moc.status,

      emergencyJustification:
        moc.emergencyJustification,

      temporaryExpirationDate:
        moc.temporaryExpirationDate
          ?.toISOString() ??
        null,

      site:
        moc.site.name,

      department:
        moc.department?.name ??
        null,

      requestor:
        moc.requestor.name,

      owner:
        moc.owner?.name ??
        null,

      proposedStartDate:
        moc.proposedStartDate
          ?.toISOString() ??
        null,

      plannedCompletionDate:
        moc.plannedCompletionDate
          ?.toISOString() ??
        null,
    },

    affectedOperations: {
      process:
        moc.affectedProcess,

      equipment:
        moc.affectedEquipment,

      systems:
        moc.affectedSystems,

      materials:
        moc.affectedMaterials,
    },

    recordedImpacts: {
      operational:
        moc.operationalImpact,

      regulatory:
        moc.regulatoryImpact,

      environmental:
        moc.environmentalImpact,

      safety:
        moc.safetyImpact,

      quality:
        moc.qualityImpact,
    },

    currentRiskAssessments: {
      initial: {
        likelihood:
          moc.initialLikelihood,

        impact:
          moc.initialImpact,

        score:
          moc.initialScore,

        riskLevel:
          moc.initialRiskLevel,
      },

      residual: {
        likelihood:
          moc.residualLikelihood,

        impact:
          moc.residualImpact,

        score:
          moc.residualScore,

        riskLevel:
          moc.residualRiskLevel,
      },
    },

    existingApprovals:
      moc.approvals.map(
        (approval) => ({
          role:
            approval.role,

          sequence:
            approval.sequence,

          status:
            approval.status,

          approver:
            approval.approver
              ?.name ??
            null,
        })
      ),

    existingTasks:
      moc.tasks.map(
        (task) => ({
          title:
            task.title,

          description:
            task.description,

          taskType:
            task.taskType,

          status:
            task.status,

          sequence:
            task.sequence,

          required:
            task.isRequired,

          assignee:
            task.assignedTo
              ?.name ??
            null,

          dueDate:
            task.dueDate
              ?.toISOString() ??
            null,
        })
      ),

    linkedRisks:
      moc.riskLinks.map(
        (link) => ({
          reference:
            link.risk.reference,

          title:
            link.risk.title,

          currentScore:
            link.risk.currentScore,

          currentRiskLevel:
            link.risk.currentRiskLevel,

          residualScore:
            link.risk.residualScore,

          residualRiskLevel:
            link.risk.residualRiskLevel,

          relationshipNote:
            link.relationshipNote,
        })
      ),

    reviewerContext:
      input.reviewerContext ??
      null,
  };

  const openAI =
    getOpenAIClient();

  const response =
    await openAI.responses.create({
      model:
        getOpenAIModel(),

      instructions: `
You are an enterprise Management of Change risk-assessment advisor.

Your purpose is to help qualified professionals evaluate a proposed organizational, operational, process, equipment, chemical, software, facility, or temporary change.

Mandatory governance rules:

1. The assessment is advisory and review-only.
2. Never approve, reject, implement, verify, close, or modify the change.
3. Use only the tenant-authorized information supplied in the MOC context.
4. Never invent equipment specifications, chemical properties, regulations, permits, incidents, measurements, drawings, procedures, test results, or control performance.
5. Clearly distinguish supplied facts, professional interpretations, assumptions, questions, and missing evidence.
6. Do not provide legal, medical, criminal, engineering-certification, or regulatory-compliance conclusions.
7. Regulatory considerations must be framed as topics requiring qualified review, not definitive applicability determinations.
8. Do not assign personal blame or recommend disciplinary action.
9. Prefer elimination, substitution, and engineering controls over administrative controls, training, and PPE when feasible.
10. Training alone must not be presented as sufficient where higher-order controls may reasonably be needed.
11. Avoid recommending tasks, controls, or approvals that duplicate existing items.
12. Mark potential duplication in every control recommendation.
13. Recommended approval roles must use only the supplied MocApprovalRole enum values.
14. Recommended task types must use only the supplied MocTaskType enum values.
15. Suggested owners must be organizational functions or roles, not invented people.
16. Suggested due periods must be reasonable numbers of days after management acceptance.
17. Every task must specify completion evidence and verification criteria.
18. Every control must identify the hazards it addresses and measurable effectiveness criteria.
19. Treat residual risk as a recommendation based on stated assumptions—not as an achieved or verified condition.
20. Do not claim that controls are effective merely because they are planned.
21. Use information gaps and review questions when the supplied scope is incomplete.
22. Recommend approvals only when the supplied change characteristics support the functional involvement.
23. Recommend both implementation and verification activities where appropriate.
24. Consider operational, environmental, safety, quality, regulatory, technology, security, contractor, maintenance, human-factor, startup, shutdown, temporary-change, and emergency-change impacts when supported.
25. Do not invent a relationship between the change and linked risks.
26. Prioritize the most material hazards and management actions first.
27. recommendationId values must be unique identifiers such as CONTROL-01 and TASK-01.
28. Keep the response concise enough for management review while retaining actionable detail.
      `.trim(),

      input: [
        {
          role: "user",

          content: [
            {
              type:
                "input_text",

              text:
                "Prepare a review-only enterprise Management of Change assessment using only the following authorized context:\n\n" +
                JSON.stringify(
                  context,
                  null,
                  2
                ),
            },
          ],
        },
      ],

      text: {
        format: {
          type:
            "json_schema",

          name:
            "enterprise_moc_change_assessment",

          strict: true,

          schema:
            mocAiSchema,
        },
      },
    });

  if (!response.output_text) {
    throw new Error(
      "The AI service did not return an MOC assessment."
    );
  }

  const rawDraft =
    parseMocAiAssessment(
      response.output_text
    );

  const residualRating =
    calculateRiskRating({
      likelihood:
        rawDraft
          .residualRiskRecommendation
          .likelihood,

      impact:
        rawDraft
          .residualRiskRecommendation
          .impact,
    });

  const draft: MocAiAssessmentDraft =
    {
      ...rawDraft,

      residualRiskRecommendation: {
        ...rawDraft
          .residualRiskRecommendation,

        score:
          residualRating.score,

        riskLevel:
          residualRating.riskLevel,
      },
    };

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.SYSTEM,

    entityType:
      "MocAI",

    entityId:
      moc.id,

    title:
      "AI MOC assessment generated",

    description:
      `A review-only AI change assessment was generated for ${moc.reference}.`,

    metadata: {
      mocId:
        moc.id,

      mocReference:
        moc.reference,

      model:
        getOpenAIModel(),

      responseId:
        response.id,

      hazardCount:
        draft.majorHazards
          .length,

      controlRecommendationCount:
        draft.recommendedControls
          .length,

      approvalRecommendationCount:
        draft.recommendedApprovals
          .length,

      taskRecommendationCount:
        draft.recommendedTasks
          .length,

      verificationActivityCount:
        draft.verificationActivities
          .length,

      recommendedResidualLikelihood:
        draft
          .residualRiskRecommendation
          .likelihood,

      recommendedResidualImpact:
        draft
          .residualRiskRecommendation
          .impact,

      recommendedResidualScore:
        draft
          .residualRiskRecommendation
          .score,

      recommendedResidualRiskLevel:
        draft
          .residualRiskRecommendation
          .riskLevel,

      confidenceLevel:
        draft.confidenceAssessment
          .level,

      generatedAt:
        new Date().toISOString(),

      automaticallyApplied:
        false,
    },
  });

  return draft;
}