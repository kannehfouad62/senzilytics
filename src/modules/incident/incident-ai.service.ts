import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getOpenAIClient,
  getOpenAIModel,
} from "@/core/ai/openai.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  DocumentEntityType,
  DocumentStatus,
} from "@prisma/client";
import type { IncidentInvestigationAiDraft } from "./incident-ai.types";

const incidentInvestigationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "investigationSummary",
    "immediateCauseHypotheses",
    "rootCauseHypotheses",
    "contributingFactors",
    "fiveWhys",
    "evidenceToCollect",
    "interviewQuestions",
    "dataGaps",
    "recommendedNextSteps",
    "preliminaryCorrectiveActionThemes",
    "confidenceAssessment",
    "limitationsNotice",
  ],
  properties: {
    investigationSummary: {
      type: "string",
    },

    immediateCauseHypotheses: {
      type: "array",
      items: {
        type: "string",
      },
    },

    rootCauseHypotheses: {
      type: "array",
      items: {
        type: "string",
      },
    },

    contributingFactors: {
      type: "array",
      items: {
        type: "string",
      },
    },

    fiveWhys: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "level",
          "question",
          "answer",
          "evidenceBasis",
        ],
        properties: {
          level: {
            type: "integer",
            minimum: 1,
            maximum: 5,
          },
          question: {
            type: "string",
          },
          answer: {
            type: "string",
          },
          evidenceBasis: {
            type: "string",
          },
        },
      },
    },

    evidenceToCollect: {
      type: "array",
      items: {
        type: "string",
      },
    },

    interviewQuestions: {
      type: "array",
      items: {
        type: "string",
      },
    },

    dataGaps: {
      type: "array",
      items: {
        type: "string",
      },
    },

    recommendedNextSteps: {
      type: "array",
      items: {
        type: "string",
      },
    },

    preliminaryCorrectiveActionThemes: {
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

function parseInvestigationDraft(
  value: string
): IncidentInvestigationAiDraft {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error(
      "The AI service returned an invalid investigation draft."
    );
  }

  if (
    !parsedValue ||
    typeof parsedValue !== "object"
  ) {
    throw new Error(
      "The AI service returned an empty investigation draft."
    );
  }

  const draft =
    parsedValue as Partial<IncidentInvestigationAiDraft>;

  if (
    typeof draft.investigationSummary !==
      "string" ||
    !Array.isArray(
      draft.immediateCauseHypotheses
    ) ||
    !Array.isArray(
      draft.rootCauseHypotheses
    ) ||
    !Array.isArray(
      draft.contributingFactors
    ) ||
    !Array.isArray(draft.fiveWhys) ||
    !Array.isArray(
      draft.evidenceToCollect
    ) ||
    !Array.isArray(
      draft.interviewQuestions
    ) ||
    !Array.isArray(draft.dataGaps) ||
    !Array.isArray(
      draft.recommendedNextSteps
    ) ||
    !Array.isArray(
      draft.preliminaryCorrectiveActionThemes
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
      "The AI service returned an incomplete investigation draft."
    );
  }

  return draft as IncidentInvestigationAiDraft;
}

export async function generateIncidentInvestigationAiDraftService(
  input: {
    organizationId: string;
    userId: string;
    incidentId: string;
    investigatorContext?: string | null;
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

  const incidentEvidenceContext = {
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
      createdAt:
        incident.createdAt.toISOString(),
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
      name: incident.reportedBy.name,
      jobTitle:
        incident.reportedBy.jobTitle,
      department:
        incident.reportedBy.department
          ?.name ?? null,
    },

    existingInvestigation:
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
            assignedTo:
              incident.investigation
                .assignedTo?.name ??
              null,
          }
        : null,

    existingCorrectiveActions:
      incident.actions.map(
        (action) => ({
          title: action.title,
          description:
            action.description,
          riskLevel:
            action.riskLevel,
          status: action.status,
          dueDate:
            action.dueDate.toISOString(),
          assignedTo:
            action.assignedTo.name,
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

    investigatorContext:
      input.investigatorContext ||
      null,
  };

  const openAI =
    getOpenAIClient();

  const response =
    await openAI.responses.create({
      model: getOpenAIModel(),

      instructions: `
You are an enterprise EHS incident-investigation assistant.

Your purpose is to help a qualified human investigator organize available facts, identify evidence gaps, and formulate preliminary hypotheses.

Mandatory rules:

1. Never present a hypothesis as a verified fact.
2. Never assign personal blame.
3. Do not make legal, medical, disciplinary, criminal, or regulatory conclusions.
4. Distinguish clearly between:
   - known information,
   - reasonable hypotheses,
   - missing evidence.
5. Do not invent witness statements, measurements, policies, procedures, equipment conditions, training records, or document contents.
6. Document metadata only confirms that a file exists. It does not reveal the contents of that file.
7. Existing investigation text may be incomplete or incorrect. Treat it as investigator-provided context, not verified truth.
8. Root causes must focus on systems, controls, processes, supervision, equipment, environment, communication, competence, workload, and organizational conditions.
9. Corrective-action themes must remain preliminary and must not duplicate existing corrective actions unnecessarily.
10. The result is a draft for human review and must not be represented as the final investigation.
11. Use concise, professional enterprise EHS language.
12. The Five-Whys chain must contain exactly five levels.
13. When evidence is insufficient, state that directly.
      `.trim(),

      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Prepare a preliminary incident-investigation draft using only the following tenant-authorized incident information:\n\n" +
                JSON.stringify(
                  incidentEvidenceContext,
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
            "incident_investigation_draft",
          strict: true,
          schema:
            incidentInvestigationJsonSchema,
        },
      },
    });

  if (!response.output_text) {
    throw new Error(
      "The AI service did not return an investigation draft."
    );
  }

  const draft =
    parseInvestigationDraft(
      response.output_text
    );

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.SYSTEM,
    entityType:
      "IncidentInvestigationAI",
    entityId: incident.id,
    title:
      "AI investigation draft generated",
    description:
      "A review-only AI investigation draft was generated for the incident.",
    metadata: {
      incidentId: incident.id,
      model:
        getOpenAIModel(),
      responseId:
        response.id,
      confidenceLevel:
        draft.confidenceAssessment
          .level,
      documentMetadataCount:
        documents.length,
      existingInvestigation:
        Boolean(
          incident.investigation
        ),
      generatedAt:
        new Date().toISOString(),
      automaticallySaved: false,
    },
  });

  return draft;
}