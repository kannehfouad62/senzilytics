import { MocCreateForm } from "@/features/moc/moc-create-form";
import { RiskMatrix } from "@/features/risks/risk-matrix";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  MocChangeDuration,
  MocChangeType,
  MocPriority,
  PermissionKey,
  RiskImpact,
  RiskLikelihood,
} from "@prisma/client";
import {
  ArrowLeft,
  CalendarClock,
  Factory,
  Gauge,
  ShieldAlert,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewMocPage() {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const [
    sites,
    departments,
    users,
    forms,
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

    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.MOC
    ),
  ]);

  return (
    <div>
      <Link
        href="/moc"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to MOC register
      </Link>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <Workflow size={16} />
          Change Governance
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Create Change Request
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          Define the proposed change,
          business need, organizational
          scope, impacts, risk exposure,
          ownership, and implementation
          schedule.
        </p>
      </div>

      <MocCreateForm
        forms={forms}
      >
        <section className={sectionClass}>
          <SectionHeading
            title="Change Information"
            description="Describe the proposed change and the business reason for introducing it."
            icon={<Workflow size={21} />}
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field
              label="Change title"
              required
            >
              <input
                name="title"
                required
                placeholder="Example: Replace warehouse ventilation system"
                className={inputClass}
              />
            </Field>

            <Field
              label="Change type"
              required
            >
              <select
                name="changeType"
                required
                defaultValue={
                  MocChangeType.PROCESS
                }
                className={inputClass}
              >
                {Object.values(
                  MocChangeType
                ).map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {formatEnum(value)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Description"
            required
          >
            <textarea
              name="description"
              required
              rows={5}
              placeholder="Describe what will change, what is included, what is excluded, and the expected implementation approach."
              className={inputClass}
            />
          </Field>

          <Field
            label="Business justification"
            required
          >
            <textarea
              name="businessJustification"
              required
              rows={4}
              placeholder="Explain why the change is required, what problem it addresses, and the expected business or operational benefit."
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-3">
            <Field
              label="Duration"
              required
            >
              <select
                name="changeDuration"
                required
                defaultValue={
                  MocChangeDuration.PERMANENT
                }
                className={inputClass}
              >
                {Object.values(
                  MocChangeDuration
                ).map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {formatEnum(value)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Priority"
              required
            >
              <select
                name="priority"
                required
                defaultValue={
                  MocPriority.MEDIUM
                }
                className={inputClass}
              >
                {Object.values(
                  MocPriority
                ).map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {formatEnum(value)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Temporary expiration">
              <input
                name="temporaryExpirationDate"
                type="datetime-local"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Emergency justification">
            <textarea
              name="emergencyJustification"
              rows={3}
              placeholder="Required only when the duration is Emergency."
              className={inputClass}
            />
          </Field>
        </section>

        <section className={sectionClass}>
          <SectionHeading
            title="Scope and Ownership"
            description="Assign the change to a site, department, and accountable owner."
            icon={
              <UserRoundCheck
                size={21}
              />
            }
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field
              label="Site"
              required
            >
              <select
                name="siteId"
                required
                defaultValue=""
                className={inputClass}
              >
                <option
                  value=""
                  disabled
                >
                  Select site
                </option>

                {sites.map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.name}
                  </option>
                ))}
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
                The department must belong
                to the selected site.
              </p>
            </Field>

            <Field label="Change owner">
              <select
                name="ownerId"
                defaultValue=""
                className={inputClass}
              >
                <option value="">
                  Not assigned
                </option>

                {users.map((user) => (
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
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className={sectionClass}>
          <SectionHeading
            title="Affected Operations"
            description="Record the processes, equipment, systems, and materials that may be affected by the change."
            icon={<Factory size={21} />}
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Affected process">
              <input
                name="affectedProcess"
                placeholder="Example: Warehouse receiving"
                className={inputClass}
              />
            </Field>

            <Field label="Affected equipment">
              <input
                name="affectedEquipment"
                placeholder="Example: Ventilation units V-01 through V-04"
                className={inputClass}
              />
            </Field>

            <Field label="Affected systems">
              <input
                name="affectedSystems"
                placeholder="Example: Building management system"
                className={inputClass}
              />
            </Field>

            <Field label="Affected materials">
              <input
                name="affectedMaterials"
                placeholder="Example: Cleaning solvents and packaging materials"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className={sectionClass}>
          <SectionHeading
            title="Impact Assessment"
            description="Record known or reasonably anticipated operational, regulatory, environmental, safety, and quality impacts."
            icon={
              <ShieldAlert size={21} />
            }
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <ImpactField
              label="Operational impact"
              name="operationalImpact"
            />

            <ImpactField
              label="Regulatory impact"
              name="regulatoryImpact"
            />

            <ImpactField
              label="Environmental impact"
              name="environmentalImpact"
            />

            <ImpactField
              label="Safety impact"
              name="safetyImpact"
            />

            <ImpactField
              label="Quality impact"
              name="qualityImpact"
            />
          </div>
        </section>

        <RiskAssessmentSection
          title="Initial Change Risk"
          description="Assess the inherent exposure before planned controls, approvals, and implementation safeguards."
          prefix="initial"
          defaultLikelihood={
            RiskLikelihood.POSSIBLE
          }
          defaultImpact={
            RiskImpact.MODERATE
          }
        />

        <RiskAssessmentSection
          title="Expected Residual Risk"
          description="Estimate the remaining exposure after planned controls, approvals, training, inspections, and verification."
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
            title="Implementation Schedule"
            description="Define the proposed start and planned completion dates."
            icon={
              <CalendarClock
                size={21}
              />
            }
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Proposed start date">
              <input
                name="proposedStartDate"
                type="datetime-local"
                className={inputClass}
              />
            </Field>

            <Field label="Planned completion date">
              <input
                name="plannedCompletionDate"
                type="datetime-local"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <Gauge size={21} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">
                Creation behavior
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                The change will be created
                in Draft status. Initial
                and residual scores are
                calculated by the server.
                Approval requirements,
                implementation tasks,
                linked risks, documents,
                and lifecycle transitions
                will be managed from the
                change detail workspace.
              </p>
            </div>
          </div>
        </section>

      </MocCreateForm>
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
  prefix: "initial" | "residual";
  defaultLikelihood: RiskLikelihood;
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
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {formatEnum(value)}
              </option>
            ))}
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
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <RiskMatrix
          selectedLikelihood={
            defaultLikelihood
          }
          selectedImpact={
            defaultImpact
          }
          compact
        />
      </div>
    </section>
  );
}

function ImpactField({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  return (
    <Field label={label}>
      <textarea
        name={name}
        rows={4}
        className={inputClass}
      />
    </Field>
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

        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
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
