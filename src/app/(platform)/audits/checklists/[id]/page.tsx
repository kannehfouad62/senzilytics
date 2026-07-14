import {
    addAuditChecklistQuestion,
    addAuditChecklistSection,
    deleteAuditChecklistQuestion,
    toggleAuditChecklistTemplate,
  } from "@/features/audits/audit-checklist.actions";
  import { requirePermission } from "@/lib/permissions";
  import { prisma } from "@/lib/prisma";
  import { getCurrentUserTenant } from "@/lib/tenant";
  import {
    AuditQuestionType,
    PermissionKey,
  } from "@prisma/client";
  import {
    ArrowLeft,
    ClipboardList,
    Plus,
    Trash2,
  } from "lucide-react";
  import Link from "next/link";
  import { notFound } from "next/navigation";
  
  export default async function AuditChecklistTemplatePage({
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }) {
    await requirePermission(
      PermissionKey.MANAGE_AUDITS
    );
  
    const { id } = await params;
  
    const { organizationId } =
      await getCurrentUserTenant();
  
    const template =
      await prisma.auditChecklistTemplate.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          sections: {
            include: {
              questions: {
                include: {
                  checklistItems: {
                    select: {
                      id: true,
                    },
                    take: 1,
                  },
                },
                orderBy: {
                  sequence: "asc",
                },
              },
            },
            orderBy: {
              sequence: "asc",
            },
          },
          audits: {
            select: {
              id: true,
            },
          },
        },
      });
  
    if (!template) {
      notFound();
    }
  
    return (
      <div>
        <Link
          href="/audits/checklists"
          className="inline-flex items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft size={16} />
          Back to checklists
        </Link>
  
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <ClipboardList
                size={16}
              />
              Checklist Template
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {template.name}
            </h1>
  
            <p className="mt-2 max-w-3xl text-slate-400">
              {template.description ||
                "No description provided."}
            </p>
  
            <p className="mt-3 text-xs text-slate-500">
              {
                template.auditType
              }{" "}
              · Version{" "}
              {template.version} ·{" "}
              {template.audits.length}{" "}
              audits
            </p>
          </div>
  
          <form
            action={
              toggleAuditChecklistTemplate
            }
          >
            <input
              type="hidden"
              name="templateId"
              value={template.id}
            />
  
            <button
              type="submit"
              className={`rounded-2xl border px-5 py-3 text-sm font-medium ${
                template.isActive
                  ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
                  : "border-green-400/20 bg-green-400/10 text-green-300"
              }`}
            >
              {template.isActive
                ? "Deactivate Template"
                : "Activate Template"}
            </button>
          </form>
        </div>
  
        <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_380px]">
          <section className="space-y-5">
            {template.sections.map(
              (section) => (
                <div
                  key={section.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div>
                    <p className="text-xs text-cyan-300">
                      Section{" "}
                      {section.sequence}
                    </p>
  
                    <h2 className="mt-1 text-xl font-semibold text-white">
                      {section.name}
                    </h2>
  
                    <p className="mt-2 text-sm text-slate-400">
                      {section.description ||
                        "No description provided."}
                    </p>
                  </div>
  
                  <div className="mt-5 space-y-3">
                    {section.questions.map(
                      (question) => (
                        <div
                          key={
                            question.id
                          }
                          className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs text-slate-500">
                                Question{" "}
                                {
                                  question.sequence
                                }
                              </p>
  
                              <p className="mt-1 text-sm font-medium text-white">
                                {
                                  question.questionText
                                }
                              </p>
  
                              {question.guidance && (
                                <p className="mt-2 text-xs text-slate-400">
                                  {
                                    question.guidance
                                  }
                                </p>
                              )}
                            </div>
  
                            {question
                              .checklistItems
                              .length ===
                              0 && (
                              <form
                                action={
                                  deleteAuditChecklistQuestion
                                }
                              >
                                <input
                                  type="hidden"
                                  name="templateId"
                                  value={
                                    template.id
                                  }
                                />
  
                                <input
                                  type="hidden"
                                  name="questionId"
                                  value={
                                    question.id
                                  }
                                />
  
                                <button
                                  type="submit"
                                  className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300"
                                >
                                  <Trash2
                                    size={
                                      15
                                    }
                                  />
                                </button>
                              </form>
                            )}
                          </div>
  
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-300">
                              {question.questionType.replaceAll(
                                "_",
                                " "
                              )}
                            </span>
  
                            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                              Weight:{" "}
                              {
                                question.weight
                              }
                            </span>
  
                            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                              {question.isRequired
                                ? "Required"
                                : "Optional"}
                            </span>
                          </div>
                        </div>
                      )
                    )}
  
                    {section.questions
                      .length === 0 && (
                      <p className="text-sm text-slate-500">
                        No questions in
                        this section.
                      </p>
                    )}
                  </div>
  
                  <form
                    action={
                      addAuditChecklistQuestion
                    }
                    className="mt-6 rounded-2xl border border-dashed border-white/15 p-5"
                  >
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
  
                    <input
                      type="hidden"
                      name="sectionId"
                      value={section.id}
                    />
  
                    <div className="flex items-center gap-2">
                      <Plus
                        size={16}
                        className="text-cyan-300"
                      />
  
                      <h3 className="font-medium text-white">
                        Add Question
                      </h3>
                    </div>
  
                    <div className="mt-4 space-y-4">
                      <Field label="Question">
                        <textarea
                          name="questionText"
                          required
                          rows={3}
                          className={
                            inputClass
                          }
                        />
                      </Field>
  
                      <Field label="Guidance">
                        <textarea
                          name="guidance"
                          rows={2}
                          className={
                            inputClass
                          }
                        />
                      </Field>
  
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Question type">
                          <select
                            name="questionType"
                            defaultValue={
                              AuditQuestionType.COMPLIANCE
                            }
                            className={
                              inputClass
                            }
                          >
                            {Object.values(
                              AuditQuestionType
                            ).map(
                              (
                                type
                              ) => (
                                <option
                                  key={
                                    type
                                  }
                                  value={
                                    type
                                  }
                                >
                                  {type.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </option>
                              )
                            )}
                          </select>
                        </Field>
  
                        <Field label="Weight">
                          <input
                            name="weight"
                            type="number"
                            min={1}
                            step={1}
                            defaultValue={
                              1
                            }
                            required
                            className={
                              inputClass
                            }
                          />
                        </Field>
                      </div>
  
                      <label className="flex items-center gap-3 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          name="isRequired"
                          defaultChecked
                        />
                        Required question
                      </label>
                    </div>
  
                    <button
                      type="submit"
                      className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
                    >
                      Add Question
                    </button>
                  </form>
                </div>
              )
            )}
  
            {template.sections.length ===
              0 && (
              <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-slate-400">
                Add a section to begin
                building this checklist.
              </div>
            )}
          </section>
  
          <aside>
            <form
              action={
                addAuditChecklistSection
              }
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <input
                type="hidden"
                name="templateId"
                value={template.id}
              />
  
              <h2 className="text-lg font-semibold text-white">
                Add Section
              </h2>
  
              <div className="mt-5 space-y-4">
                <Field label="Section name">
                  <input
                    name="name"
                    required
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Description">
                  <textarea
                    name="description"
                    rows={4}
                    className={inputClass}
                  />
                </Field>
              </div>
  
              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                Add Section
              </button>
            </form>
          </aside>
        </div>
      </div>
    );
  }
  
  const inputClass =
    "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white";
  
  function Field({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) {
    return (
      <label className="block text-sm text-slate-300">
        {label}
        {children}
      </label>
    );
  }