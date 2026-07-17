import { createRisk } from "@/features/risks/actions";
import { RiskMatrix } from "@/features/risks/risk-matrix";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  PermissionKey,
  RiskCategory,
  RiskImpact,
  RiskLikelihood,
  RiskReviewFrequency,
} from "@prisma/client";
import {
  ArrowLeft,
  CalendarClock,
  Gauge,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

export const dynamic =
  "force-dynamic";

export default async function NewRiskPage() {
  await requirePermission(
    PermissionKey.MANAGE_RISKS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const [
    sites,
    departments,
    users,
  ] = await Promise.all([
    prisma.site.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        name: true,
      },

      orderBy: {
        name: "asc",
      },
    }),

    prisma.department.findMany({
      where: {
        site: {
          organizationId,
        },
      },

      select: {
        id: true,
        name: true,
        siteId: true,

        site: {
          select: {
            name: true,
          },
        },
      },

      orderBy: [
        {
          site: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
    }),

    prisma.user.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        name: true,
        role: true,
        jobTitle: true,
      },

      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return (
    <div>
      <Link
        href="/risks"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to risk register
      </Link>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ShieldAlert size={16} />
          Enterprise Risk Management
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Create Risk
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          Record the hazard, ownership,
          initial exposure, current
          exposure, expected residual
          exposure, and review schedule.
        </p>
      </div>

      <form
        action={createRisk}
        className="mt-8 space-y-8"
      >
        <section className={sectionClass}>
          <SectionHeading
            title="Risk Information"
            description="Define the risk, affected process, organizational scope, and accountable owner."
            icon={
              <ShieldAlert size={21} />
            }
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field
              label="Risk title"
              required
            >
              <input
                name="title"
                required
                placeholder="Example: Vehicle and pedestrian interaction"
                className={inputClass}
              />
            </Field>

            <Field
              label="Risk category"
              required
            >
              <select
                name="category"
                required
                defaultValue={
                  RiskCategory.SAFETY
                }
                className={inputClass}
              >
                {Object.values(
                  RiskCategory
                ).map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {formatEnum(
                        category
                      )}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>

          <Field
            label="Risk description"
            required
          >
            <textarea
              name="description"
              required
              rows={5}
              placeholder="Describe the hazard, potential event, exposed groups, consequences, and operating conditions."
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Hazard type">
              <input
                name="hazardType"
                placeholder="Example: Mobile equipment"
                className={inputClass}
              />
            </Field>

            <Field label="Process or activity">
              <input
                name="process"
                placeholder="Example: Warehouse operations"
                className={inputClass}
              />
            </Field>

            <Field label="Site">
              <select
                name="siteId"
                defaultValue=""
                className={inputClass}
              >
                <option value="">
                  Enterprise-wide
                </option>

                {sites.map(
                  (site) => (
                    <option
                      key={site.id}
                      value={site.id}
                    >
                      {site.name}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Department">
              <select
                name="departmentId"
                defaultValue=""
                className={inputClass}
              >
                <option value="">
                  Not assigned
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {
                        department.site
                          .name
                      }{" "}
                      —{" "}
                      {
                        department.name
                      }
                    </option>
                  )
                )}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                The selected department
                must belong to the selected
                site.
              </p>
            </Field>

            <Field label="Risk owner">
              <select
                name="ownerId"
                defaultValue=""
                className={inputClass}
              >
                <option value="">
                  Not assigned
                </option>

                {users.map(
                  (user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.name} —{" "}
                      {user.jobTitle ||
                        formatEnum(
                          user.role
                        )}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>
        </section>

        <RiskAssessmentSection
          title="Initial Risk Assessment"
          description="Assess the inherent exposure before considering existing or planned controls."
          prefix="initial"
          defaultLikelihood={
            RiskLikelihood.POSSIBLE
          }
          defaultImpact={
            RiskImpact.MODERATE
          }
        />

        <RiskAssessmentSection
          title="Current Risk Assessment"
          description="Assess the exposure under the controls and operating conditions that currently exist."
          prefix="current"
          defaultLikelihood={
            RiskLikelihood.POSSIBLE
          }
          defaultImpact={
            RiskImpact.MODERATE
          }
        />

        <RiskAssessmentSection
          title="Residual Risk Assessment"
          description="Estimate the expected remaining exposure after all planned treatments are implemented and verified."
          prefix="residual"
          defaultLikelihood={
            RiskLikelihood.UNLIKELY
          }
          defaultImpact={
            RiskImpact.MODERATE
          }
        />

        <section className={sectionClass}>
          <SectionHeading
            title="Review Schedule"
            description="Define how often the risk must be formally reviewed and when the next review is due."
            icon={
              <CalendarClock
                size={21}
              />
            }
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field
              label="Review frequency"
              required
            >
              <select
                name="reviewFrequency"
                required
                defaultValue={
                  RiskReviewFrequency.ANNUAL
                }
                className={inputClass}
              >
                {Object.values(
                  RiskReviewFrequency
                ).map(
                  (frequency) => (
                    <option
                      key={frequency}
                      value={frequency}
                    >
                      {formatEnum(
                        frequency
                      )}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Next review date">
              <input
                name="nextReviewDate"
                type="datetime-local"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <UserRoundCheck
                size={21}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">
                Creation behavior
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                The risk will be created
                with DRAFT status. Scores
                and risk levels are
                calculated by the server
                from the selected
                likelihood and impact.
                Controls and formal reviews
                can be added from the risk
                detail page.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href="/risks"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Create Risk
          </button>
        </div>
      </form>
    </div>
  );
}

function RiskAssessmentSection({
  title,
  description,
  prefix,
  defaultLikelihood,
  defaultImpact,
}: {
  title: string;
  description: string;
  prefix:
    | "initial"
    | "current"
    | "residual";
  defaultLikelihood:
    RiskLikelihood;
  defaultImpact: RiskImpact;
}) {
  return (
    <section className={sectionClass}>
      <SectionHeading
        title={title}
        description={description}
        icon={<Gauge size={21} />}
      />

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field
          label="Likelihood"
          required
        >
          <select
            name={`${prefix}Likelihood`}
            required
            defaultValue={
              defaultLikelihood
            }
            className={inputClass}
          >
            {Object.values(
              RiskLikelihood
            ).map(
              (likelihood) => (
                <option
                  key={likelihood}
                  value={likelihood}
                >
                  {formatEnum(
                    likelihood
                  )}
                </option>
              )
            )}
          </select>
        </Field>

        <Field
          label="Impact"
          required
        >
          <select
            name={`${prefix}Impact`}
            required
            defaultValue={
              defaultImpact
            }
            className={inputClass}
          >
            {Object.values(
              RiskImpact
            ).map(
              (impact) => (
                <option
                  key={impact}
                  value={impact}
                >
                  {formatEnum(
                    impact
                  )}
                </option>
              )
            )}
          </select>
        </Field>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <p className="mb-4 text-sm font-medium text-white">
          5×5 Risk Matrix
        </p>

        <RiskMatrix
          selectedLikelihood={
            defaultLikelihood
          }
          selectedImpact={
            defaultImpact
          }
          compact
        />

        <p className="mt-4 text-xs leading-5 text-slate-500">
          The highlighted matrix cell
          represents the default values
          shown when the page first loads.
          The final score is calculated
          from the values submitted in the
          form.
        </p>
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
        {icon}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white">
          {title}
        </h2>

        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm text-slate-300">
      {label}

      {required && (
        <span className="ml-1 text-red-300">
          *
        </span>
      )}

      {children}
    </label>
  );
}

function formatEnum(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

const sectionClass =
  "rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl";

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50";