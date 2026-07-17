import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getOpenAIClient,
  getOpenAIModel,
} from "@/core/ai/openai.service";
import {
  getExecutiveReportData,
  type ExecutiveReportData,
} from "@/core/analytics/executive-report.service";
import {
  getRiskAnalyticsData,
  type RiskAnalyticsData,
} from "@/core/analytics/risk-analytics.service";
import {
  ActivityAction,
} from "@prisma/client";
import type {
  ExecutiveReportAiDraft,
} from "./executive-report-ai.types";

const executiveReportAiSchema = {
  type: "object",

  additionalProperties: false,

  required: [
    "executiveSummary",
    "keyFindings",
    "positiveSignals",
    "riskSignals",
    "capaInsights",
    "auditAndInspectionInsights",
    "siteExposureInsights",
    "governanceInsights",
    "crossModuleInsights",
    "enterpriseRiskInsights",
    "strategicOpportunities",
    "predictiveSignals",
    "effectivenessInsights",
    "forecastConsiderations",
    "leadingIndicatorRecommendations",
    "recommendedPriorities",
    "dataQualityCautions",
    "confidenceAssessment",
    "limitationsNotice",
  ],

  properties: {
    executiveSummary: {
      type: "string",
    },

    keyFindings: {
      type: "array",

      items: {
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
      },
    },

    positiveSignals: {
      type: "array",

      items: {
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
      },
    },

    riskSignals: {
      type: "array",

      items: {
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
      },
    },

    capaInsights: {
      type: "array",

      items: {
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
      },
    },

    auditAndInspectionInsights: {
      type: "array",

      items: {
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
      },
    },

    siteExposureInsights: {
      type: "array",

      items: {
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
      },
    },

    governanceInsights: {
      type: "array",

      items: {
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
      },
    },

    crossModuleInsights: {
      type: "array",

      items: {
        type: "object",

        additionalProperties: false,

        required: [
          "title",
          "observation",
          "supportingEvidence",
          "significance",
        ],

        properties: {
          title: {
            type: "string",
          },

          observation: {
            type: "string",
          },

          supportingEvidence: {
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
      },
    },

    enterpriseRiskInsights: {
      type: "array",

      items: {
        type: "object",

        additionalProperties: false,

        required: [
          "title",
          "observation",
          "supportingEvidence",
          "recommendedExecutiveAction",
        ],

        properties: {
          title: {
            type: "string",
          },

          observation: {
            type: "string",
          },

          supportingEvidence: {
            type: "string",
          },

          recommendedExecutiveAction: {
            type: "string",
          },
        },
      },
    },

    strategicOpportunities: {
      type: "array",

      items: {
        type: "object",

        additionalProperties: false,

        required: [
          "title",
          "opportunity",
          "expectedBenefit",
          "recommendedOwnerFunction",
        ],

        properties: {
          title: {
            type: "string",
          },

          opportunity: {
            type: "string",
          },

          expectedBenefit: {
            type: "string",
          },

          recommendedOwnerFunction: {
            type: "string",
          },
        },
      },
    },

    predictiveSignals: {
      type: "array",
    
      items: {
        type: "object",
    
        additionalProperties: false,
    
        required: [
          "title",
          "signalType",
          "observation",
          "supportingEvidence",
          "direction",
          "horizon",
          "significance",
          "managementConsideration",
        ],
    
        properties: {
          title: {
            type: "string",
          },
    
          signalType: {
            type: "string",
    
            enum: [
              "EMERGING_RISK",
              "DETERIORATING_CONTROL",
              "RECURRING_FINDING",
              "OVERDUE_EXPOSURE",
              "OWNERSHIP_GAP",
              "PERFORMANCE_DIVERGENCE",
              "OTHER",
            ],
          },
    
          observation: {
            type: "string",
          },
    
          supportingEvidence: {
            type: "string",
          },
    
          direction: {
            type: "string",
    
            enum: [
              "IMPROVING",
              "STABLE",
              "DETERIORATING",
              "UNCLEAR",
            ],
          },
    
          horizon: {
            type: "string",
    
            enum: [
              "IMMEDIATE",
              "NEXT_30_DAYS",
              "NEXT_QUARTER",
              "LONGER_TERM",
            ],
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
    
          managementConsideration: {
            type: "string",
          },
        },
      },
    },
    
    effectivenessInsights: {
      type: "array",
    
      items: {
        type: "object",
    
        additionalProperties: false,
    
        required: [
          "title",
          "area",
          "assessment",
          "observation",
          "supportingEvidence",
          "evidenceLimitations",
          "recommendedReviewAction",
        ],
    
        properties: {
          title: {
            type: "string",
          },
    
          area: {
            type: "string",
    
            enum: [
              "CAPA",
              "AUDIT",
              "INSPECTION",
              "TRAINING",
              "RISK_CONTROL",
              "GOVERNANCE",
            ],
          },
    
          assessment: {
            type: "string",
    
            enum: [
              "EFFECTIVE",
              "PARTIALLY_EFFECTIVE",
              "INEFFECTIVE",
              "INSUFFICIENT_EVIDENCE",
            ],
          },
    
          observation: {
            type: "string",
          },
    
          supportingEvidence: {
            type: "string",
          },
    
          evidenceLimitations: {
            type: "string",
          },
    
          recommendedReviewAction: {
            type: "string",
          },
        },
      },
    },
    
    forecastConsiderations: {
      type: "array",
    
      items: {
        type: "object",
    
        additionalProperties: false,
    
        required: [
          "title",
          "forecastHorizon",
          "currentConditions",
          "potentialDevelopment",
          "supportingEvidence",
          "uncertainty",
          "suggestedPreparation",
        ],
    
        properties: {
          title: {
            type: "string",
          },
    
          forecastHorizon: {
            type: "string",
          },
    
          currentConditions: {
            type: "string",
          },
    
          potentialDevelopment: {
            type: "string",
          },
    
          supportingEvidence: {
            type: "string",
          },
    
          uncertainty: {
            type: "string",
          },
    
          suggestedPreparation: {
            type: "string",
          },
        },
      },
    },
    
    leadingIndicatorRecommendations: {
      type: "array",
    
      items: {
        type: "object",
    
        additionalProperties: false,
    
        required: [
          "indicator",
          "purpose",
          "sourceModule",
          "suggestedReviewFrequency",
          "escalationThreshold",
        ],
    
        properties: {
          indicator: {
            type: "string",
          },
    
          purpose: {
            type: "string",
          },
    
          sourceModule: {
            type: "string",
          },
    
          suggestedReviewFrequency: {
            type: "string",
          },
    
          escalationThreshold: {
            type: "string",
          },
        },
      },
    },

    recommendedPriorities: {
      type: "array",

      minItems: 1,
      maxItems: 10,

      items: {
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
      },
    },

    dataQualityCautions: {
      type: "array",

      items: {
        type: "string",
      },
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

function parseExecutiveReportAiDraft(
  value: string
): ExecutiveReportAiDraft {
  let parsedValue: unknown;

  try {
    parsedValue =
      JSON.parse(value);
  } catch {
    throw new Error(
      "The AI service returned an invalid executive report analysis."
    );
  }

  if (
    !parsedValue ||
    typeof parsedValue !==
      "object"
  ) {
    throw new Error(
      "The AI service returned an empty executive report analysis."
    );
  }

  const draft =
    parsedValue as Partial<ExecutiveReportAiDraft>;

  if (
    typeof draft.executiveSummary !==
      "string" ||
    !Array.isArray(
      draft.keyFindings
    ) ||
    !Array.isArray(
      draft.positiveSignals
    ) ||
    !Array.isArray(
      draft.riskSignals
    ) ||
    !Array.isArray(
      draft.capaInsights
    ) ||
    !Array.isArray(
      draft.auditAndInspectionInsights
    ) ||
    !Array.isArray(
      draft.siteExposureInsights
    ) ||
    !Array.isArray(
      draft.governanceInsights
    ) ||
    !Array.isArray(
      draft.governanceInsights
    ) ||
    !Array.isArray(
      draft.crossModuleInsights
    ) ||
    !Array.isArray(
      draft.enterpriseRiskInsights
    ) ||
    !Array.isArray(
      draft.strategicOpportunities
    ) ||
    !Array.isArray(
      draft.predictiveSignals
    ) ||
    !Array.isArray(
      draft.effectivenessInsights
    ) ||
    !Array.isArray(
      draft.forecastConsiderations
    ) ||
    !Array.isArray(
      draft.leadingIndicatorRecommendations
    ) ||
    !Array.isArray(
      draft.recommendedPriorities
    ) ||
    !Array.isArray(
      draft.recommendedPriorities
    ) ||
    !Array.isArray(
      draft.dataQualityCautions
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
      "The AI service returned an incomplete executive report analysis."
    );
  }

  return draft as ExecutiveReportAiDraft;
}

function createAiReportContext(
  report: ExecutiveReportData,
  riskAnalytics: RiskAnalyticsData,
  leadershipContext:
    | string
    | null
  ) {
    return {
      reportingPeriod: {
        from:
          report.filters.from.toISOString(),
  
        to:
          report.filters.to.toISOString(),
  
        site:
          report.filters.siteName ??
          "All sites",
      },
  
      operationalPerformance: {
        summary:
          report.summary,
  
        monthlyTrend:
          report.monthlyTrend,
  
        incidentRiskDistribution:
          report.incidentRiskDistribution,
  
        incidentStatusDistribution:
          report.incidentStatusDistribution,
  
        correctiveActionStatusDistribution:
          report.correctiveActionStatusDistribution,
  
        correctiveActionRiskDistribution:
          report.correctiveActionRiskDistribution,
  
        correctiveActionSourceDistribution:
          report.correctiveActionSourceDistribution,
  
        auditStatusDistribution:
          report.auditStatusDistribution,
  
        inspectionStatusDistribution:
          report.inspectionStatusDistribution,
  
        sitePerformance:
          report.sitePerformance.map(
            (site) => ({
              siteName:
                site.siteName,
  
              incidents:
                site.incidents,
  
              openIncidents:
                site.openIncidents,
  
              highRiskIncidents:
                site.highRiskIncidents,
  
              audits:
                site.audits,
  
              inspections:
                site.inspections,
  
              openCorrectiveActions:
                site.openCorrectiveActions,
  
              overdueCorrectiveActions:
                site.overdueCorrectiveActions,
  
              exposureScore:
                site.exposureScore,
            })
          ),
  
        managementAttention:
          report.managementAttention.map(
            (item) => ({
              type:
                item.type,
  
              title:
                item.title,
  
              description:
                item.description,
  
              riskLevel:
                item.riskLevel,
  
              status:
                item.status,
  
              dueDate:
                item.dueDate
                  ?.toISOString() ??
                null,
  
              siteName:
                item.siteName,
  
              ownerName:
                item.ownerName,
            })
          ),
      },
  
      enterpriseRiskManagement: {
        scopeNotice:
          "Risk-register analytics represent the current point-in-time enterprise position and are not limited to records created during the selected report period.",
  
        summary: {
          totalRisks:
            riskAnalytics.summary
              .totalRisks,
  
          activeRisks:
            riskAnalytics.summary
              .activeRisks,
  
          criticalCurrentRisks:
            riskAnalytics.summary
              .criticalCurrentRisks,
  
          criticalResidualRisks:
            riskAnalytics.summary
              .criticalResidualRisks,
  
          highResidualRisks:
            riskAnalytics.summary
              .highResidualRisks,
  
          overdueReviews:
            riskAnalytics.summary
              .overdueReviews,
  
          unassignedRisks:
            riskAnalytics.summary
              .unassignedRisks,
  
          totalControls:
            riskAnalytics.summary
              .totalControls,
  
          openControls:
            riskAnalytics.summary
              .openControls,
  
          overdueControls:
            riskAnalytics.summary
              .overdueControls,
  
          ineffectiveControls:
            riskAnalytics.summary
              .ineffectiveControls,
  
          averageCurrentScore:
            riskAnalytics.summary
              .averageCurrentScore,
  
          averageResidualScore:
            riskAnalytics.summary
              .averageResidualScore,
  
          expectedRiskReductionPercentage:
            riskAnalytics.summary
              .riskReductionPercentage,
        },
  
        currentRiskDistribution:
          riskAnalytics
            .currentRiskDistribution,
  
        residualRiskDistribution:
          riskAnalytics
            .residualRiskDistribution,
  
        categoryDistribution:
          riskAnalytics
            .categoryDistribution,
  
        statusDistribution:
          riskAnalytics
            .statusDistribution,
  
        controlEffectivenessDistribution:
          riskAnalytics
            .controlEffectivenessDistribution,
  
        controlHierarchyDistribution:
          riskAnalytics
            .controlHierarchyDistribution,
  
        siteExposure:
          riskAnalytics.sitePerformance.map(
            (site) => ({
              siteName:
                site.siteName,
  
              totalRisks:
                site.totalRisks,
  
              activeRisks:
                site.activeRisks,
  
              criticalRisks:
                site.criticalRisks,
  
              highResidualRisks:
                site.highResidualRisks,
  
              overdueReviews:
                site.overdueReviews,
  
              openControls:
                site.openControls,
  
              overdueControls:
                site.overdueControls,
  
              exposureScore:
                site.exposureScore,
            })
          ),
  
        highestResidualRisks:
          riskAnalytics.topResidualRisks
            .slice(0, 10)
            .map(
              (risk) => ({
                reference:
                  risk.reference,
  
                title:
                  risk.title,
  
                category:
                  risk.category,
  
                status:
                  risk.status,
  
                currentScore:
                  risk.currentScore,
  
                currentRiskLevel:
                  risk.currentRiskLevel,
  
                residualScore:
                  risk.residualScore,
  
                residualRiskLevel:
                  risk.residualRiskLevel,
  
                siteName:
                  risk.siteName,
  
                ownerName:
                  risk.ownerName,
  
                nextReviewDate:
                  risk.nextReviewDate
                    ?.toISOString() ??
                  null,
  
                overdueReview:
                  risk.overdueReview,
  
                openControls:
                  risk.openControls,
  
                overdueControls:
                  risk.overdueControls,
  
                attentionReason:
                  risk.reason,
              })
            ),
  
        managementAttention:
          riskAnalytics.managementAttention
            .slice(0, 20)
            .map(
              (risk) => ({
                reference:
                  risk.reference,
  
                title:
                  risk.title,
  
                residualScore:
                  risk.residualScore,
  
                residualRiskLevel:
                  risk.residualRiskLevel,
  
                siteName:
                  risk.siteName,
  
                ownerName:
                  risk.ownerName,
  
                overdueReview:
                  risk.overdueReview,
  
                overdueControls:
                  risk.overdueControls,
  
                attentionReason:
                  risk.reason,
              })
            ),
      },
  
      leadershipContext,
    };
  }

export async function generateExecutiveReportAiDraftService(
  input: {
    organizationId: string;
    userId: string;
    from: Date;
    to: Date;
    siteId?: string | null;
    leadershipContext?:
      | string
      | null;
  }
) {
  const [
    report,
    riskAnalytics,
  ] = await Promise.all([
    getExecutiveReportData({
      organizationId:
        input.organizationId,
  
      userId:
        input.userId,
  
      from:
        input.from,
  
      to:
        input.to,
  
      siteId:
        input.siteId,
    }),
  
    getRiskAnalyticsData(
      input.organizationId
    ),
  ]);
  
  const context =
    createAiReportContext(
      report,
      riskAnalytics,
      input.leadershipContext ??
        null
    );

  const openAI =
    getOpenAIClient();

  const response =
    await openAI.responses.create({
      model:
        getOpenAIModel(),

        instructions: `
        You are an enterprise EHS executive-reporting assistant.
        
        Your purpose is to help senior leaders interpret aggregated EHS and enterprise-risk performance information and identify management priorities.
        
        Mandatory governance rules:
        
        1. The analysis is advisory and review-only.
        2. Do not create, assign, approve, close, or modify records.
        3. Use only the information provided in the report context.
        4. Never invent events, causes, trends, regulations, financial impacts, or record contents.
        5. Clearly distinguish measured results from interpretation.
        6. Do not assign personal blame or recommend disciplinary action.
        7. Do not make legal, medical, criminal, or regulatory conclusions.
        8. Do not claim statistical significance unless statistical testing is explicitly provided.
        9. Do not claim that a trend exists when the data contains too few observations.
        10. When zero records exist, explain that the absence of records may reflect either good performance or incomplete reporting.
        11. Evaluate CAPA performance using open, overdue, high-risk, closure-rate, and source information.
        12. Evaluate audits and inspections using completion rates, open findings, overdue records, and risk exposure.
        13. Evaluate enterprise risk management using current and residual scores, high and critical residual exposure, overdue reviews, overdue controls, weak controls, ownership gaps, and site concentration.
        14. Treat risk scores and site exposure scores as internal management indicators, not statistical probabilities or predictions.
        15. Clearly distinguish the selected-period operational report from the point-in-time enterprise risk-register position.
        16. Do not claim that expected residual-risk reduction has been achieved unless control implementation and verification evidence supports it.
        17. Identify material differences between current and residual exposure, but do not assume planned controls will be effective.
        18. Highlight critical residual risks, weak controls, overdue reviews, overdue controls, and unassigned risks when supported by the supplied data.
        19. Recommendations must be organizational priorities, not automatically approved actions.
        20. Suggested owners must be organizational functions or roles, not invented people.
        21. Every recommended priority must include a measurable success indicator.
        22. Mention material data-quality limitations.
        23. Avoid repeating the same observation across multiple sections.
        24. Use concise, professional language suitable for an executive management review.
        25. Prioritize the most material issues first.
        26. Generate crossModuleInsights only when the supplied data supports a meaningful relationship between at least two different modules.
        27. Name the relevant modules and numerical evidence in supportingEvidence whenever possible.
        28. Do not claim causation merely because two conditions occur together.
        29. Clearly describe cross-module observations as associations, concentrations, inconsistencies, or potential relationships unless causation is directly established.
        30. Generate enterpriseRiskInsights using current and residual exposure, control effectiveness, reviews, ownership, and site concentration.
        31. Every enterprise-risk insight must include a practical review-only executive action.
        32. Generate strategicOpportunities only when there is a plausible improvement opportunity supported by the supplied data.
        33. Strategic opportunities must identify the expected benefit and an organizational owner function.
        34. Do not describe a recommendation as a guaranteed improvement.
        35. Predictive signals are evidence-based management considerations, not guaranteed predictions.
        36. Generate a predictive signal only when the supplied data supports a measurable pattern, concentration, divergence, overdue condition, or governance weakness.
        37. Do not claim that one module caused an outcome in another module unless causation is explicitly established by the supplied records.
        38. When evidence is insufficient to determine direction, use UNCLEAR.
        39. Do not describe residual-risk reduction as achieved merely because the residual score is lower than the current score.
        40. Assess CAPA, audit, inspection, training, risk-control, and governance effectiveness only from the supplied completion, overdue, recurrence, exposure, and control data.
        41. Use INSUFFICIENT_EVIDENCE when effectiveness cannot reasonably be assessed.
        42. Forecast considerations must state current conditions, potential development, uncertainty, and suggested preparation.
        43. Avoid numerical probability estimates unless the supplied data includes a validated probability model.
        44. Leading indicators must be measurable and connected to an existing source module.
        45. Escalation thresholds must be practical review triggers, not legal or regulatory conclusions.
        46. Do not invent historical trends when only point-in-time data is available.
        47. Clearly state when a forecast is based on point-in-time risk-register information rather than a time series.
        `.trim(),

      input: [
        {
          role: "user",

          content: [
            {
              type:
                "input_text",

              text:
                "Prepare a review-only executive EHS analysis using the following tenant-authorized report data:\n\n" +
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
            "executive_ehs_report_analysis",

          strict: true,

          schema:
            executiveReportAiSchema,
        },
      },
    });

  if (
    !response.output_text
  ) {
    throw new Error(
      "The AI service did not return an executive report analysis."
    );
  }

  const draft =
    parseExecutiveReportAiDraft(
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
      "ExecutiveReportAI",

    entityId: null,

    title:
      "AI executive insights generated",

    description:
      "A review-only AI analysis was generated for an executive EHS report.",

    metadata: {
      from:
    input.from.toISOString(),

  to:
    input.to.toISOString(),

  siteId:
    input.siteId ??
    null,

  model:
    getOpenAIModel(),

  responseId:
    response.id,

  keyFindingCount:
    draft.keyFindings.length,

  priorityCount:
    draft.recommendedPriorities.length,

  confidenceLevel:
    draft.confidenceAssessment.level,

  crossModuleInsightCount:
    draft.crossModuleInsights.length,
    
  enterpriseRiskInsightCount:
    draft.enterpriseRiskInsights.length,
    
  strategicOpportunityCount:
    draft.strategicOpportunities.length,
  predictiveSignalCount:
    draft.predictiveSignals.length,

  effectivenessInsightCount:
    draft.effectivenessInsights.length,

  forecastConsiderationCount:
    draft.forecastConsiderations.length,

  leadingIndicatorRecommendationCount:
    draft.leadingIndicatorRecommendations.length,

  activeRiskCount:
    riskAnalytics.summary.activeRisks,

  criticalResidualRiskCount:
    riskAnalytics.summary.criticalResidualRisks,

  highResidualRiskCount:
    riskAnalytics.summary.highResidualRisks,

  overdueRiskReviewCount:
    riskAnalytics.summary.overdueReviews,

  overdueRiskControlCount:
    riskAnalytics.summary.overdueControls,

  ineffectiveRiskControlCount:
    riskAnalytics.summary.ineffectiveControls,

  generatedAt:
    new Date().toISOString(),

  automaticallyApplied:
    false,
    },
  });

  return draft;
}