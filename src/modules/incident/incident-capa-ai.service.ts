import {
    getOpenAIClient,
    getOpenAIModel,
  } from "@/core/ai/openai.service";
  import { logActivity } from "@/core/activity-log/activity-log.service";
  import { prisma } from "@/lib/prisma";
  import {
    ActivityAction,
    DocumentEntityType,
    DocumentStatus,
  } from "@prisma/client";
  import type {
    IncidentCorrectiveActionAiDraft,
  } from "./incident-capa-ai.types";
  
  const correctiveActionRecommendationSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "executiveSummary",
      "incidentControlObjective",
      "recommendations",
      "immediateContainmentActions",
      "preventiveActionThemes",
      "missingInformation",
      "implementationSequence",
      "managementConsiderations",
      "confidenceAssessment",
      "limitationsNotice",
    ],
    properties: {
      executiveSummary: {
        type: "string",
      },
  
      incidentControlObjective: {
        type: "string",
      },
  
      recommendations: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "recommendationId",
            "title",
            "description",
            "rationale",
            "hierarchyLevel",
            "priority",
            "suggestedRiskLevel",
            "suggestedOwnerRole",
            "suggestedDueDays",
            "implementationSteps",
            "dependencies",
            "verificationMethod",
            "effectivenessCriteria",
            "evidenceBasis",
            "addressesCause",
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
  
            hierarchyLevel: {
              type: "string",
              enum: [
                "ELIMINATION",
                "SUBSTITUTION",
                "ENGINEERING_CONTROL",
                "ADMINISTRATIVE_CONTROL",
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
  
            suggestedRiskLevel: {
              type: "string",
              enum: [
                "LOW",
                "MEDIUM",
                "HIGH",
                "CRITICAL",
              ],
            },
  
            suggestedOwnerRole: {
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
  
            addressesCause: {
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
        },
      },
  
      immediateContainmentActions: {
        type: "array",
        items: {
          type: "string",
        },
      },
  
      preventiveActionThemes: {
        type: "array",
        items: {
          type: "string",
        },
      },
  
      missingInformation: {
        type: "array",
        items: {
          type: "string",
        },
      },
  
      implementationSequence: {
        type: "array",
        items: {
          type: "string",
        },
      },
  
      managementConsiderations: {
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
  
  function parseCorrectiveActionDraft(
    value: string
  ): IncidentCorrectiveActionAiDraft {
    let parsedValue: unknown;
  
    try {
      parsedValue =
        JSON.parse(value);
    } catch {
      throw new Error(
        "The AI service returned invalid corrective-action recommendations."
      );
    }
  
    if (
      !parsedValue ||
      typeof parsedValue !== "object"
    ) {
      throw new Error(
        "The AI service returned an empty corrective-action draft."
      );
    }
  
    const draft =
      parsedValue as Partial<IncidentCorrectiveActionAiDraft>;
  
    if (
      typeof draft.executiveSummary !==
        "string" ||
      typeof draft.incidentControlObjective !==
        "string" ||
      !Array.isArray(
        draft.recommendations
      ) ||
      !Array.isArray(
        draft.immediateContainmentActions
      ) ||
      !Array.isArray(
        draft.preventiveActionThemes
      ) ||
      !Array.isArray(
        draft.missingInformation
      ) ||
      !Array.isArray(
        draft.implementationSequence
      ) ||
      !Array.isArray(
        draft.managementConsiderations
      ) ||
      !draft.confidenceAssessment ||
      typeof draft.confidenceAssessment
        .level !== "string" ||
      typeof draft.confidenceAssessment
        .rationale !== "string" ||
      typeof draft.limitationsNotice !==
        "string"
    ) {
      throw new Error(
        "The AI service returned an incomplete corrective-action draft."
      );
    }
  
    return draft as IncidentCorrectiveActionAiDraft;
  }
  
  export async function generateIncidentCorrectiveActionAiDraftService(
    input: {
      organizationId: string;
      userId: string;
      incidentId: string;
      reviewerContext?: string | null;
    }
  ) {
    const incident =
      await prisma.incident.findFirst({
        where: {
          id: input.incidentId,
          site: {
            organizationId:
              input.organizationId,
          },
        },
  
        include: {
          site: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              country: true,
            },
          },
  
          reportedBy: {
            select: {
              id: true,
              name: true,
              jobTitle: true,
  
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
  
          investigation: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  jobTitle: true,
                },
              },
            },
          },
  
          actions: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  jobTitle: true,
                },
              },
            },
  
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
  
    if (!incident) {
      throw new Error(
        "Incident not found in this organization."
      );
    }
  
    const documents =
      await prisma.document.findMany({
        where: {
          organizationId:
            input.organizationId,
          entityType:
            DocumentEntityType.INCIDENT,
          entityId: incident.id,
          isLatest: true,
          status: {
            not:
              DocumentStatus.DELETED,
          },
        },
  
        select: {
          id: true,
          name: true,
          originalName: true,
          description: true,
          category: true,
          mimeType: true,
          createdAt: true,
        },
  
        orderBy: {
          createdAt: "asc",
        },
      });
  
    const recommendationContext = {
      incident: {
        id: incident.id,
        title: incident.title,
        description:
          incident.description,
        type: incident.type,
        riskLevel:
          incident.riskLevel,
        status: incident.status,
        location:
          incident.location,
        occurredAt:
          incident.occurredAt.toISOString(),
      },
  
      site: {
        name: incident.site.name,
        address:
          incident.site.address,
        city: incident.site.city,
        state: incident.site.state,
        country:
          incident.site.country,
      },
  
      reporter: {
        jobTitle:
          incident.reportedBy.jobTitle,
        department:
          incident.reportedBy.department
            ?.name ?? null,
      },
  
      investigation:
        incident.investigation
          ? {
              summary:
                incident.investigation
                  .summary,
              immediateCause:
                incident.investigation
                  .immediateCause,
              rootCause:
                incident.investigation
                  .rootCause,
              contributingFactors:
                incident.investigation
                  .contributingFactors,
              status:
                incident.investigation
                  .status,
              dueDate:
                incident.investigation
                  .dueDate?.toISOString() ??
                null,
            }
          : null,
  
      existingCorrectiveActions:
        incident.actions.map(
          (action) => ({
            id: action.id,
            title: action.title,
            description:
              action.description,
            riskLevel:
              action.riskLevel,
            status: action.status,
            dueDate:
              action.dueDate.toISOString(),
            assignedRole:
              action.assignedTo.role,
            assignedJobTitle:
              action.assignedTo
                .jobTitle,
          })
        ),
  
      availableDocumentMetadata:
        documents.map(
          (document) => ({
            name: document.name,
            originalName:
              document.originalName,
            description:
              document.description,
            category:
              document.category,
            mimeType:
              document.mimeType,
            uploadedAt:
              document.createdAt.toISOString(),
          })
        ),
  
      reviewerContext:
        input.reviewerContext ||
        null,
    };
  
    const openAI =
      getOpenAIClient();
  
    const response =
      await openAI.responses.create({
        model: getOpenAIModel(),
  
        instructions: `
  You are an enterprise EHS corrective-action recommendation assistant.
  
  Your purpose is to help qualified EHS professionals develop preliminary corrective and preventive action recommendations from authorized incident information.
  
  Mandatory governance rules:
  
  1. Recommendations are drafts for human review only.
  2. Never create, assign, approve, or close a corrective action.
  3. Never present an unverified cause as a confirmed fact.
  4. Do not assign blame or recommend disciplinary action.
  5. Do not provide legal, regulatory, medical, or criminal conclusions.
  6. Prefer higher-order controls using the hierarchy of controls.
  7. Do not default to training, procedures, or PPE when elimination, substitution, or engineering controls may be more effective.
  8. Clearly distinguish immediate containment from long-term corrective and preventive actions.
  9. Avoid recommending an action that duplicates an existing corrective action.
  10. When a recommendation overlaps an existing action, mark it as potentially duplicative and explain why.
  11. Every recommendation must address a stated cause, contributing factor, hazard, or verified control gap.
  12. Every recommendation must include measurable effectiveness criteria.
  13. Every recommendation must include a verification method.
  14. Suggested owners must be organizational roles or functions, not invented people.
  15. Suggested due dates must be expressed as a reasonable number of days from approval.
  16. Document metadata confirms only that a file exists. Never infer the contents of an attachment.
  17. When evidence is insufficient, include the gap under missing information.
  18. Use concise enterprise EHS language.
  19. Provide between three and eight recommendations unless the available evidence supports fewer.
  20. recommendationId values must be unique, concise identifiers such as REC-01, REC-02, and REC-03.
        `.trim(),
  
        input: [
          {
            role: "user",
  
            content: [
              {
                type: "input_text",
  
                text:
                  "Prepare review-only corrective and preventive action recommendations using only the following tenant-authorized incident information:\n\n" +
                  JSON.stringify(
                    recommendationContext,
                    null,
                    2
                  ),
              },
            ],
          },
        ],
  
        text: {
          format: {
            type: "json_schema",
            name:
              "incident_corrective_action_recommendations",
            strict: true,
            schema:
              correctiveActionRecommendationSchema,
          },
        },
      });
  
    if (!response.output_text) {
      throw new Error(
        "The AI service did not return corrective-action recommendations."
      );
    }
  
    const draft =
      parseCorrectiveActionDraft(
        response.output_text
      );
  
    await logActivity({
      organizationId:
        input.organizationId,
      userId: input.userId,
      action:
        ActivityAction.SYSTEM,
      entityType:
        "IncidentCorrectiveActionAI",
      entityId: incident.id,
      title:
        "AI corrective-action recommendations generated",
      description:
        "Review-only AI corrective and preventive action recommendations were generated.",
      metadata: {
        incidentId: incident.id,
        model:
          getOpenAIModel(),
        responseId:
          response.id,
        recommendationCount:
          draft.recommendations.length,
        confidenceLevel:
          draft.confidenceAssessment
            .level,
        existingActionCount:
          incident.actions.length,
        documentMetadataCount:
          documents.length,
        generatedAt:
          new Date().toISOString(),
        automaticallyCreated: false,
        automaticallyAssigned: false,
      },
    });
  
    return draft;
  }