import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getOpenAIClient,
  getOpenAIModel,
} from "@/core/ai/openai.service";
import { findTenantRiskById } from "@/modules/risk/risk.repository";
import {
  ActivityAction,
} from "@prisma/client";
import type {
  RiskAiDraft,
} from "./risk-ai.types";

const riskInsightSchema = {
  type: "object",
  additionalProperties: false,

  required: [
    "title",
    "observation",
    "evidenceBasis",
    "significance",
  ],

  properties: {
    title: {
      type: "string",
    },

    observation: {
      type: "string",
    },

    evidenceBasis: {
      type: "string",
    },

    significance: {
      type: "string",

      enum: [
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
      ],
    },
  },
} as const;

const riskControlRecommendationSchema = {
  type: "object",
  additionalProperties: false,

  required: [
    "recommendationId",
    "title",
    "description",
    "rationale",
    "controlHierarchy",
    "priority",
    "suggestedOwnerFunction",
    "suggestedDueDays",
    "implementationSteps",
    "dependencies",
    "verificationMethod",
    "effectivenessCriteria",
    "evidenceBasis",
    "addressesExposure",
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

    rationale: {
      type: "string",
    },

    controlHierarchy: {
      type: "string",

      enum: [
        "ELIMINATION",
        "SUBSTITUTION",
        "ENGINEERING",
        "ADMINISTRATIVE",
        "TRAINING",
        "PPE",
        "MONITORING",
        "OTHER",
      ],
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

    suggestedOwnerFunction: {
      type: "string",
    },

    suggestedDueDays: {
      type: "integer",
      minimum: 1,
      maximum: 365,
    },

    implementationSteps: {
      type: "array",

      items: {
        type: "string",
      },
    },

    dependencies: {
      type: "array",

      items: {
        type: "string",
      },
    },

    verificationMethod: {
      type: "string",
    },

    effectivenessCriteria: {
      type: "array",

      items: {
        type: "string",
      },
    },

    evidenceBasis: {
      type: "string",
    },

    addressesExposure: {
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

const riskManagementPrioritySchema = {
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

const riskAiSchema = {
  type: "object",
  additionalProperties: false,

  required: [
    "executiveSummary",
    "riskConditionAssessment",
    "keyInsights",
    "controlGapInsights",
    "ownershipAndGovernanceInsights",
    "monitoringInsights",
    "recommendedControls",
    "evidenceGaps",
    "reviewQuestions",
    "suggestedLeadingIndicators",
    "suggestedLaggingIndicators",
    "escalationConsiderations",
    "managementPriorities",
    "confidenceAssessment",
    "limitationsNotice",
  ],

  properties: {
    executiveSummary: {
      type: "string",
    },

    riskConditionAssessment: {
      type: "object",
      additionalProperties: false,

      required: [
        "currentExposure",
        "residualExposure",
        "riskDirection",
        "rationale",
      ],

      properties: {
        currentExposure: {
          type: "string",
        },

        residualExposure: {
          type: "string",
        },

        riskDirection: {
          type: "string",

          enum: [
            "DECREASING",
            "STABLE",
            "INCREASING",
            "UNCLEAR",
          ],
        },

        rationale: {
          type: "string",
        },
      },
    },

    keyInsights: {
      type: "array",
      items: riskInsightSchema,
    },

    controlGapInsights: {
      type: "array",
      items: riskInsightSchema,
    },

    ownershipAndGovernanceInsights: {
      type: "array",
      items: riskInsightSchema,
    },

    monitoringInsights: {
      type: "array",
      items: riskInsightSchema,
    },

    recommendedControls: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items:
        riskControlRecommendationSchema,
    },

    evidenceGaps: {
      type: "array",

      items: {
        type: "string",
      },
    },

    reviewQuestions: {
      type: "array",

      items: {
        type: "string",
      },
    },

    suggestedLeadingIndicators: {
      type: "array",

      items: {
        type: "string",
      },
    },

    suggestedLaggingIndicators: {
      type: "array",

      items: {
        type: "string",
      },
    },

    escalationConsiderations: {
      type: "array",

      items: {
        type: "string",
      },
    },

    managementPriorities: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items:
        riskManagementPrioritySchema,
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

function parseRiskAiDraft(
  value: string
): RiskAiDraft {
  let parsedValue: unknown;

  try {
    parsedValue =
      JSON.parse(value);
  } catch {
    throw new Error(
      "The AI service returned an invalid risk analysis."
    );
  }

  if (
    !parsedValue ||
    typeof parsedValue !==
      "object"
  ) {
    throw new Error(
      "The AI service returned an empty risk analysis."
    );
  }

  const draft =
    parsedValue as Partial<RiskAiDraft>;

  if (
    typeof draft.executiveSummary !==
      "string" ||
    !draft.riskConditionAssessment ||
    typeof draft
      .riskConditionAssessment
      .currentExposure !==
      "string" ||
    typeof draft
      .riskConditionAssessment
      .residualExposure !==
      "string" ||
    typeof draft
      .riskConditionAssessment
      .riskDirection !==
      "string" ||
    typeof draft
      .riskConditionAssessment
      .rationale !==
      "string" ||
    !Array.isArray(
      draft.keyInsights
    ) ||
    !Array.isArray(
      draft.controlGapInsights
    ) ||
    !Array.isArray(
      draft.ownershipAndGovernanceInsights
    ) ||
    !Array.isArray(
      draft.monitoringInsights
    ) ||
    !Array.isArray(
      draft.recommendedControls
    ) ||
    !Array.isArray(
      draft.evidenceGaps
    ) ||
    !Array.isArray(
      draft.reviewQuestions
    ) ||
    !Array.isArray(
      draft.suggestedLeadingIndicators
    ) ||
    !Array.isArray(
      draft.suggestedLaggingIndicators
    ) ||
    !Array.isArray(
      draft.escalationConsiderations
    ) ||
    !Array.isArray(
      draft.managementPriorities
    ) ||
    !draft.confidenceAssessment ||
    typeof draft
      .confidenceAssessment
      .level !== "string" ||
    typeof draft
      .confidenceAssessment
      .rationale !== "string" ||
    typeof draft.limitationsNotice !==
      "string"
  ) {
    throw new Error(
      "The AI service returned an incomplete risk analysis."
    );
  }

  return draft as RiskAiDraft;
}

export async function generateRiskAiDraftService(
  input: {
    organizationId: string;
    userId: string;
    riskId: string;
    advisorContext?:
      | string
      | null;
  }
) {
  const risk =
    await findTenantRiskById({
      organizationId:
        input.organizationId,
      riskId:
        input.riskId,
    });

  if (!risk) {
    throw new Error(
      "Risk not found in this organization."
    );
  }

  const context = {
    risk: {
      reference:
        risk.reference,
      title:
        risk.title,
      description:
        risk.description,
      category:
        risk.category,
      hazardType:
        risk.hazardType,
      process:
        risk.process,
      status:
        risk.status,

      site:
        risk.site?.name ??
        "Enterprise-wide",

      department:
        risk.department?.name ??
        null,

      owner: risk.owner
        ? {
            name:
              risk.owner.name,
            jobTitle:
              risk.owner.jobTitle,
            role:
              risk.owner.role,
          }
        : null,

      initialAssessment: {
        likelihood:
          risk.initialLikelihood,
        impact:
          risk.initialImpact,
        score:
          risk.initialScore,
        riskLevel:
          risk.initialRiskLevel,
      },

      currentAssessment: {
        likelihood:
          risk.currentLikelihood,
        impact:
          risk.currentImpact,
        score:
          risk.currentScore,
        riskLevel:
          risk.currentRiskLevel,
      },

      residualAssessment: {
        likelihood:
          risk.residualLikelihood,
        impact:
          risk.residualImpact,
        score:
          risk.residualScore,
        riskLevel:
          risk.residualRiskLevel,
      },

      reviewSchedule: {
        frequency:
          risk.reviewFrequency,
        lastReviewedAt:
          risk.lastReviewedAt
            ?.toISOString() ??
          null,
        nextReviewDate:
          risk.nextReviewDate
            ?.toISOString() ??
          null,
      },
    },

    controls:
      risk.controls.map(
        (control) => ({
          name:
            control.name,
          description:
            control.description,
          controlType:
            control.controlType,
          hierarchy:
            control.hierarchy,
          effectiveness:
            control.effectiveness,
          status:
            control.status,
          owner:
            control.owner?.name ??
            null,
          dueDate:
            control.dueDate
              ?.toISOString() ??
            null,
          implementedAt:
            control.implementedAt
              ?.toISOString() ??
            null,
          verificationDate:
            control.verificationDate
              ?.toISOString() ??
            null,
          verificationMethod:
            control.verificationMethod,
          verificationResult:
            control.verificationResult,
        })
      ),

    reviewHistory:
      risk.reviews.map(
        (review) => ({
          reviewDate:
            review.reviewDate.toISOString(),
          likelihood:
            review.likelihood,
          impact:
            review.impact,
          score:
            review.score,
          riskLevel:
            review.riskLevel,
          controlEffectiveness:
            review.controlEffectiveness,
          trend:
            review.trend,
          nextReviewDate:
            review.nextReviewDate
              ?.toISOString() ??
            null,
          notes:
            review.notes,
        })
      ),

    linkedRecords:
      risk.links.map(
        (link) => ({
          entityType:
            link.entityType,
          entityId:
            link.entityId,
          label:
            link.label,
        })
      ),

    advisorContext:
      input.advisorContext ??
      null,
  };

  const openAI =
    getOpenAIClient();

  const response =
    await openAI.responses.create({
      model:
        getOpenAIModel(),

      instructions: `
You are an enterprise EHS and operational-risk advisor.

Your purpose is to help qualified professionals review an existing risk register record, identify control gaps, formulate preliminary control recommendations, and improve monitoring and governance.

Mandatory governance rules:

1. The analysis is advisory and review-only.
2. Never create, approve, assign, verify, close, or modify a risk or control.
3. Never change a risk score or claim that the current score is incorrect.
4. Use only the information supplied in the authorized risk context.
5. Never invent incidents, measurements, regulations, procedures, control performance, record contents, or review outcomes.
6. Clearly distinguish facts, interpretations, hypotheses, and missing evidence.
7. Do not assign personal blame or recommend disciplinary action.
8. Do not provide legal, medical, criminal, or regulatory conclusions.
9. Prefer higher-order controls using the hierarchy of controls.
10. Do not default to training, procedures, or PPE when elimination, substitution, or engineering controls may be feasible.
11. Avoid recommending controls that duplicate existing or planned controls.
12. Mark possible duplication and explain the overlap.
13. Every recommendation must identify the exposure or control gap it addresses.
14. Every recommendation must include verification and measurable effectiveness criteria.
15. Suggested owners must be organizational functions or roles, not invented people.
16. Suggested due periods must be reasonable numbers of days after approval.
17. Treat residual risk as an estimate, not a guaranteed future condition.
18. Treat internal scores as management indicators, not probabilities of harm.
19. Do not infer a risk trend unless review history or supplied context supports it.
20. When trend evidence is insufficient, use UNCLEAR.
21. Recommend both leading and lagging indicators where appropriate.
22. Mention ownership, overdue reviews, overdue controls, weak controls, and verification gaps when supported.
23. Use concise, professional enterprise-risk language.
24. Prioritize the most material issues first.
25. recommendationId values must be unique identifiers such as CONTROL-01, CONTROL-02, and CONTROL-03.
      `.trim(),

      input: [
        {
          role: "user",

          content: [
            {
              type:
                "input_text",

              text:
                "Prepare a review-only AI risk-advisor analysis using only the following tenant-authorized risk information:\n\n" +
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
            "enterprise_risk_advisor_analysis",

          strict: true,

          schema:
            riskAiSchema,
        },
      },
    });

  if (
    !response.output_text
  ) {
    throw new Error(
      "The AI service did not return a risk analysis."
    );
  }

  const draft =
    parseRiskAiDraft(
      response.output_text
    );

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.SYSTEM,

    entityType:
      "RiskAI",

    entityId:
      risk.id,

    title:
      "AI risk-advisor analysis generated",

    description:
      `A review-only AI analysis was generated for ${risk.reference}.`,

    metadata: {
      riskId:
        risk.id,
      riskReference:
        risk.reference,
      model:
        getOpenAIModel(),
      responseId:
        response.id,
      recommendedControlCount:
        draft.recommendedControls
          .length,
      managementPriorityCount:
        draft.managementPriorities
          .length,
      riskDirection:
        draft
          .riskConditionAssessment
          .riskDirection,
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