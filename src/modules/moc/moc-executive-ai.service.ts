import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getOpenAIClient,
  getOpenAIModel,
} from "@/core/ai/openai.service";
import { getMocExecutiveDashboard } from "@/core/analytics/moc-dashboard.service";
import { ActivityAction } from "@prisma/client";
import type {
  MocExecutiveAiDraft,
} from "./moc-executive-ai.types";

const significanceEnum = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

const insightSchema = {
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
      enum: significanceEnum,
    },
  },
} as const;

const insightArraySchema = {
  type: "array",
  maxItems: 12,
  items: insightSchema,
} as const;

const prioritySchema = {
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

const stringArraySchema = {
  type: "array",

  items: {
    type: "string",
  },
} as const;

const mocExecutiveAiSchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "executiveSummary",
    "portfolioAssessment",
    "keyFindings",
    "positiveSignals",
    "approvalBottlenecks",
    "implementationRisks",
    "temporaryChangeExposure",
    "siteExposureInsights",
    "ownerWorkloadInsights",
    "riskProfileInsights",
    "governanceInsights",
    "recommendedPriorities",
    "managementQuestions",
    "dataQualityCautions",
    "confidenceAssessment",
    "limitationsNotice",
  ],

  properties: {
    executiveSummary: {
      type: "string",
    },

    portfolioAssessment: {
      type: "object",

      additionalProperties: false,

      required: [
        "overallCondition",
        "rationale",
      ],

      properties: {
        overallCondition: {
          type: "string",

          enum: [
            "STABLE",
            "WATCH",
            "ELEVATED",
            "CRITICAL",
          ],
        },

        rationale: {
          type: "string",
        },
      },
    },

    keyFindings:
      insightArraySchema,

    positiveSignals:
      insightArraySchema,

    approvalBottlenecks:
      insightArraySchema,

    implementationRisks:
      insightArraySchema,

    temporaryChangeExposure:
      insightArraySchema,

    siteExposureInsights:
      insightArraySchema,

    ownerWorkloadInsights:
      insightArraySchema,

    riskProfileInsights:
      insightArraySchema,

    governanceInsights:
      insightArraySchema,

    recommendedPriorities: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: prioritySchema,
    },

    managementQuestions:
      stringArraySchema,

    dataQualityCautions:
      stringArraySchema,

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

function parseMocExecutiveAiDraft(
  value: string
): MocExecutiveAiDraft {
  let parsedValue: unknown;

  try {
    parsedValue =
      JSON.parse(value);
  } catch {
    throw new Error(
      "The AI service returned an invalid executive MOC summary."
    );
  }

  if (
    !parsedValue ||
    typeof parsedValue !==
      "object"
  ) {
    throw new Error(
      "The AI service returned an empty executive MOC summary."
    );
  }

  const draft =
    parsedValue as Partial<MocExecutiveAiDraft>;

  if (
    typeof draft.executiveSummary !==
      "string" ||
    !draft.portfolioAssessment ||
    !Array.isArray(
      draft.keyFindings
    ) ||
    !Array.isArray(
      draft.positiveSignals
    ) ||
    !Array.isArray(
      draft.approvalBottlenecks
    ) ||
    !Array.isArray(
      draft.implementationRisks
    ) ||
    !Array.isArray(
      draft.temporaryChangeExposure
    ) ||
    !Array.isArray(
      draft.siteExposureInsights
    ) ||
    !Array.isArray(
      draft.ownerWorkloadInsights
    ) ||
    !Array.isArray(
      draft.riskProfileInsights
    ) ||
    !Array.isArray(
      draft.governanceInsights
    ) ||
    !Array.isArray(
      draft.recommendedPriorities
    ) ||
    !Array.isArray(
      draft.managementQuestions
    ) ||
    !Array.isArray(
      draft.dataQualityCautions
    ) ||
    !draft.confidenceAssessment ||
    typeof draft.limitationsNotice !==
      "string"
  ) {
    throw new Error(
      "The AI service returned an incomplete executive MOC summary."
    );
  }

  return draft as MocExecutiveAiDraft;
}

export async function generateMocExecutiveAiSummaryService(
  input: {
    organizationId: string;
    userId: string;
    reviewerContext?:
      | string
      | null;
  }
): Promise<MocExecutiveAiDraft> {
  const dashboard =
    await getMocExecutiveDashboard(
      input.organizationId
    );

  const context = {
    generatedAt:
      dashboard.generatedAt,

    summary:
      dashboard.summary,

    lifecycleDistribution:
      dashboard.lifecycleDistribution,

    approvalBottlenecks:
      dashboard.approvalsByRole,

    longestPendingApprovals:
      dashboard.pendingApprovals.map(
        (approval) => ({
          mocReference:
            approval.mocReference,

          mocTitle:
            approval.mocTitle,

          role:
            approval.role,

          waitingDays:
            approval.waitingDays,

          approver:
            approval.approver,

          site:
            approval.site,

          priority:
            approval.priority,

          residualRiskLevel:
            approval.residualRiskLevel,
        })
      ),

    overdueTasks:
      dashboard.overdueTasks.map(
        (task) => ({
          mocReference:
            task.mocReference,

          mocTitle:
            task.mocTitle,

          taskTitle:
            task.taskTitle,

          taskType:
            task.taskType,

          daysOverdue:
            task.daysOverdue,

          assignedTo:
            task.assignedTo,

          site:
            task.site,

          priority:
            task.priority,

          residualRiskLevel:
            task.residualRiskLevel,
        })
      ),

    temporaryChanges:
      dashboard.temporaryChanges.map(
        (moc) => ({
          reference:
            moc.reference,

          title:
            moc.title,

          status:
            moc.status,

          priority:
            moc.priority,

          site:
            moc.site,

          owner:
            moc.owner,

          daysUntilExpiration:
            moc.daysUntilExpiration,

          expirationCategory:
            moc.expirationCategory,

          residualRiskLevel:
            moc.residualRiskLevel,
        })
      ),

    siteExposure:
      dashboard.siteExposure,

    workloadByOwner:
      dashboard.workloadByOwner,

    monthlyTrends:
      dashboard.monthlyTrends,

    changesByType:
      dashboard.changesByType,

    residualRiskDistribution:
      dashboard.residualRiskDistribution,

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
You are an enterprise Management of Change executive-governance advisor.

Prepare a concise, evidence-based management analysis of the supplied MOC portfolio.

Mandatory rules:

1. Use only the supplied tenant-authorized dashboard information.
2. Do not invent MOCs, dates, sites, owners, approvals, tasks, risks, trends, incidents, regulations, or business impacts.
3. Clearly distinguish recorded metrics from professional interpretation.
4. Do not approve, reject, close, advance, modify, or assign any MOC record.
5. Do not claim that a planned control or task is effective merely because it exists.
6. Treat overdue tasks, approval delays, expired temporary changes, and high residual risk as governance signals requiring review.
7. Do not assign personal blame or recommend disciplinary action.
8. Owner workload observations must be framed as workload or resourcing considerations, not performance conclusions.
9. Regulatory and legal conclusions are outside scope.
10. Prioritize material portfolio risks, approval bottlenecks, temporary-change exposure, implementation delays, verification delays, site concentration, and workload imbalance.
11. Identify positive signals when supported by closure volume, improving trends, low overdue exposure, or stable risk distribution.
12. Avoid repeating the same finding across multiple sections.
13. Every finding must state its evidence basis using supplied metrics.
14. Management priorities must be actionable, measurable, ordered, and assigned to organizational functions rather than invented individuals.
15. Use data-quality cautions when the metrics lack enough history, volume, or context for a reliable conclusion.
16. The portfolio condition must reflect the totality of the supplied evidence.
17. Keep the executive summary suitable for senior leadership.
18. The analysis is advisory and requires qualified management review.
      `.trim(),

      input: [
        {
          role: "user",

          content: [
            {
              type:
                "input_text",

              text:
                "Prepare a review-only executive Management of Change portfolio analysis using this authorized dashboard context:\n\n" +
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
            "moc_executive_portfolio_summary",

          strict: true,

          schema:
            mocExecutiveAiSchema,
        },
      },
    });

  if (!response.output_text) {
    throw new Error(
      "The AI service did not return an executive MOC summary."
    );
  }

  const draft =
    parseMocExecutiveAiDraft(
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
      "MocExecutiveAI",

    entityId:
      input.organizationId,

    title:
      "AI executive MOC summary generated",

    description:
      "A review-only AI executive analysis of the Management of Change portfolio was generated.",

    metadata: {
      model:
        getOpenAIModel(),

      responseId:
        response.id,

      portfolioCondition:
        draft.portfolioAssessment
          .overallCondition,

      keyFindingCount:
        draft.keyFindings
          .length,

      approvalBottleneckCount:
        draft.approvalBottlenecks
          .length,

      implementationRiskCount:
        draft.implementationRisks
          .length,

      temporaryExposureCount:
        draft.temporaryChangeExposure
          .length,

      priorityCount:
        draft.recommendedPriorities
          .length,

      confidenceLevel:
        draft.confidenceAssessment
          .level,

      activeChanges:
        dashboard.summary
          .activeChanges,

      pendingApprovals:
        dashboard.summary
          .pendingApprovals,

      overdueTasks:
        dashboard.summary
          .overdueTasks,

      highRiskChanges:
        dashboard.summary
          .highRiskChanges,

      expiredTemporaryChanges:
        dashboard.summary
          .expiredTemporaryChanges,

      generatedAt:
        new Date().toISOString(),
    },
  });

  return draft;
}