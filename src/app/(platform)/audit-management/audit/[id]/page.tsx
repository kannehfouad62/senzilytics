import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  findTenantEnterpriseAuditExecutionContext,
} from "@/modules/audit-v2/audit-execution.repository";
import {
  EnterpriseAuditStatus,
  PermissionKey,
  Prisma,
} from "@prisma/client";
import { notFound } from "next/navigation";
import {
  EnterpriseAuditExecutionClient,
  type EnterpriseAuditExecutionViewModel,
} from "./enterprise-audit-execution-client";

function decimalToString(
  value: Prisma.Decimal | null
) {
  return value?.toString() ?? null;
}

function selectedValuesToStrings(
  value: Prisma.JsonValue | null
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string"
  );
}

export default async function EnterpriseAuditExecutionPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { id } = await params;

  const { organizationId } =
    await getCurrentUserTenant();

  const audit =
    await findTenantEnterpriseAuditExecutionContext({
      organizationId,
      auditId: id,
    });

  if (!audit) {
    notFound();
  }

  const terminalStatuses =
    new Set<EnterpriseAuditStatus>([
      EnterpriseAuditStatus.COMPLETED,
      EnterpriseAuditStatus.CANCELLED,
      EnterpriseAuditStatus.CLOSED,
    ]);

  const viewModel: EnterpriseAuditExecutionViewModel = {
    id: audit.id,
    reference: audit.reference,
    title: audit.title,
    status: audit.status,
    locked: terminalStatuses.has(
      audit.status
    ),
    totalQuestionCount:
      audit.totalQuestionCount,
    answeredQuestionCount:
      audit.answeredQuestionCount,
    failedQuestionCount:
      audit.failedQuestionCount,
    maximumPossibleScore:
      decimalToString(
        audit.maximumPossibleScore
      ),
    achievedScore:
      decimalToString(audit.achievedScore),
    scorePercentage:
      decimalToString(
        audit.scorePercentage
      ),
    startedAt:
      audit.startedAt?.toISOString() ??
      null,
    completedAt:
      audit.completedAt?.toISOString() ??
      null,
    sections: audit.sections.map(
      (section) => ({
        id: section.id,
        title: section.title,
        sequence: section.sequence,
        status: section.status,
        isRequired: section.isRequired,
        totalQuestionCount:
          section.totalQuestionCount,
        answeredQuestionCount:
          section.answeredQuestionCount,
        failedQuestionCount:
          section.failedQuestionCount,
        maximumPossibleScore:
          decimalToString(
            section.maximumPossibleScore
          ),
        achievedScore:
          decimalToString(
            section.achievedScore
          ),
        scorePercentage:
          decimalToString(
            section.scorePercentage
          ),
        questions: section.questions.map(
          (question) => ({
            id: question.id,
            questionText:
              question.questionText,
            description:
              question.description,
            guidance: question.guidance,
            standardClause:
              question.standardClause,
            regulatoryRef:
              question.regulatoryRef,
            responseType:
              question.responseType,
            sequence: question.sequence,
            weight: question.weight,
            isRequired:
              question.isRequired,
            allowNotApplicable:
              question.allowNotApplicable,
            requireComment:
              question.requireComment,
            requireEvidence:
              question.requireEvidence,
            requirePhoto:
              question.requirePhoto,
            minimumNumericValue:
              decimalToString(
                question.minimumNumericValue
              ),
            maximumNumericValue:
              decimalToString(
                question.maximumNumericValue
              ),
            minimumPassingScore:
              decimalToString(
                question.minimumPassingScore
              ),
            maximumScore:
              decimalToString(
                question.maximumScore
              ),
            automaticallyCreateFinding:
              question
                .automaticallyCreateFinding,
            automaticallySuggestCapa:
              question
                .automaticallySuggestCapa,
            automaticallySuggestRisk:
              question
                .automaticallySuggestRisk,
            status: question.status,
            options: question.options.map(
              (option) => ({
                id: option.id,
                label: option.label,
                value: option.value,
                description:
                  option.description,
                scoreValue:
                  decimalToString(
                    option.scoreValue
                  ),
                isPassing:
                  option.isPassing,
                triggersFinding:
                  option.triggersFinding,
                findingSeverity:
                  option.findingSeverity,
              })
            ),
            response: question.response
              ? {
                  id:
                    question.response.id,
                  result:
                    question.response
                      .result,
                  responseText:
                    question.response
                      .responseText,
                  numericValue:
                    decimalToString(
                      question.response
                        .numericValue
                    ),
                  booleanValue:
                    question.response
                      .booleanValue,
                  selectedOptionValues:
                    selectedValuesToStrings(
                      question.response
                        .selectedOptionValues
                    ),
                  comments:
                    question.response
                      .comments,
                  scoreAwarded:
                    decimalToString(
                      question.response
                        .scoreAwarded
                    ),
                  maximumScore:
                    decimalToString(
                      question.response
                        .maximumScore
                    ),
                  isCompliant:
                    question.response
                      .isCompliant,
                  requiresFollowUp:
                    question.response
                      .requiresFollowUp,
                  answeredAt:
                    question.response
                      .answeredAt
                      ?.toISOString() ??
                    null,
                  evidenceCount:
                    question.response
                      ._count.evidence,
                  findingCount:
                    question.response
                      ._count.findings,
                }
              : null,
            evidenceCount:
              question._count.evidence,
            findingCount:
              question._count.findings,
          })
        ),
      })
    ),
  };

  return (
    <EnterpriseAuditExecutionClient
      initialAudit={viewModel}
    />
  );
}