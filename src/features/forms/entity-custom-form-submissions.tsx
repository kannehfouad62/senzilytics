import { CustomFormFileUpload } from "@/features/forms/custom-form-file-upload";
import { prisma } from "@/lib/prisma";
import { isRuntimeFieldVisible } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFieldType,
  ConfigurableFormModule,
  ConfigurableSubmissionStatus,
  DocumentEntityType,
} from "@prisma/client";

type SupportedEntityType =
  | typeof DocumentEntityType.SAFETY_OBSERVATION
  | typeof DocumentEntityType.INCIDENT
  | typeof DocumentEntityType.INSPECTION
  | typeof DocumentEntityType.RISK
  | typeof DocumentEntityType.MOC
  | typeof DocumentEntityType.CORRECTIVE_ACTION
  | typeof DocumentEntityType.COMPLIANCE
  | typeof DocumentEntityType.TRAINING
  | typeof DocumentEntityType.CHEMICAL
  | typeof DocumentEntityType.ENVIRONMENTAL
  | typeof DocumentEntityType.ESG
  | typeof DocumentEntityType.CONTRACTOR
  | typeof DocumentEntityType.PERMIT_TO_WORK
  | typeof DocumentEntityType.INDUSTRIAL_HYGIENE;

function displayValue(
  value: unknown
) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value ?? "");
}

export async function EntityCustomFormSubmissions({
  organizationId,
  userId,
  module,
  entityType,
  entityId,
  canUpload,
  className = "mb-8 space-y-6",
}: {
  organizationId: string;
  userId: string;
  module: ConfigurableFormModule;
  entityType: SupportedEntityType;
  entityId: string;
  canUpload: boolean;
  className?: string;
}) {
  const submissions =
    await prisma.configurableFormSubmission.findMany(
      {
        where: {
          organizationId,
          entityType: module,
          entityId,
          status: {
            not: ConfigurableSubmissionStatus.VOIDED,
          },
        },
        include: {
          definition: true,
          version: {
            include: {
              fields: {
                orderBy: {
                  sequence: "asc",
                },
              },
            },
          },
          answers: {
            include: {
              field: true,
            },
            orderBy: {
              field: {
                sequence: "asc",
              },
            },
          },
          fileAnswers: {
            include: {
              document: true,
            },
          },
        },
        orderBy: {
          submittedAt: "asc",
        },
      }
    );

  if (submissions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {submissions.map(
        (submission) => {
          const values = new Map(
            submission.answers.map(
              (answer) => [
                answer.field.key,
                answer.value,
              ]
            )
          );

          const fileFields =
            submission.version.fields.filter(
              (field) =>
                field.fieldType ===
                  ConfigurableFieldType.FILE &&
                isRuntimeFieldVisible(
                  field.visibilityRule,
                  values
                )
            );

          const complete =
            submission.status ===
            ConfigurableSubmissionStatus.SUBMITTED;

          return (
            <section
              key={submission.id}
              className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                    Organization-specific form · Version{" "}
                    {
                      submission
                        .version
                        .version
                    }
                  </p>

                  <h2 className="mt-2 text-xl font-semibold">
                    {
                      submission
                        .definition
                        .name
                    }
                  </h2>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    complete
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {complete
                    ? "Complete"
                    : "Attachments required"}
                </span>
              </div>

              {submission.answers
                .length > 0 && (
                <dl className="mt-5 grid gap-3 md:grid-cols-2">
                  {submission.answers.map(
                    (answer) => (
                      <div
                        key={
                          answer.id
                        }
                        className="rounded-xl bg-slate-950/40 p-3"
                      >
                        <dt className="text-xs text-slate-500">
                          {
                            answer
                              .field
                              .label
                          }
                        </dt>

                        <dd className="mt-1 whitespace-pre-wrap text-sm text-white">
                          {displayValue(
                            answer.value
                          )}
                        </dd>
                      </div>
                    )
                  )}
                </dl>
              )}

              {fileFields.length >
                0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-semibold">
                    Private attachments
                  </p>

                  {fileFields.map(
                    (field) => {
                      const linked =
                        submission.fileAnswers.find(
                          (answer) =>
                            answer.fieldId ===
                            field.id
                        );

                      if (linked) {
                        return (
                          <a
                            key={
                              field.id
                            }
                            href={`/api/documents/${linked.document.id}/download`}
                            className="block rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200"
                          >
                            {field.label}: {" "}
                            {
                              linked
                                .document
                                .originalName
                            }
                          </a>
                        );
                      }

                      if (canUpload) {
                        return (
                          <CustomFormFileUpload
                            key={
                              field.id
                            }
                            organizationId={
                              organizationId
                            }
                            userId={
                              userId
                            }
                            entityType={
                              entityType
                            }
                            entityId={
                              entityId
                            }
                            submissionId={
                              submission.id
                            }
                            fieldId={
                              field.id
                            }
                            label={
                              field.label
                            }
                            required={
                              field.isRequired
                            }
                          />
                        );
                      }

                      return (
                        <p
                          key={field.id}
                          className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200"
                        >
                          {field.label}: File upload is unavailable for your access level or subscription.
                        </p>
                      );
                    }
                  )}
                </div>
              )}

              <p className="mt-4 text-xs text-slate-500">
                Captured{" "}
                {submission.submittedAt.toLocaleString()}
              </p>
            </section>
          );
        }
      )}
    </div>
  );
}
