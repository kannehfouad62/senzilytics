import {
  addChemicalInventory,
  completeChemicalForms,
  reviewChemical,
} from "@/features/chemicals/actions";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { RuntimeFormCompletion } from "@/features/forms/runtime-form-completion";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ChemicalApprovalStatus,
  ConfigurableFormModule,
  DocumentEntityType,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function ChemicalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_CHEMICALS);
  const [{ id }, { organizationId, user }, permissions] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_CHEMICALS);
  const [item, sites] = await Promise.all([
    prisma.chemical.findFirst({
      where: { id, organizationId },
      include: {
        inventories: { include: { site: true } },
        reviewedBy: true,
      },
    }),
    prisma.site.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!item) {
    notFound();
  }

  const [forms, capturedForms, documentUploadEnabled] = await Promise.all([
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.CHEMICAL
    ),
    prisma.configurableFormSubmission.findMany({
      where: {
        organizationId,
        entityType: ConfigurableFormModule.CHEMICAL,
        entityId: item.id,
      },
      select: { definitionId: true },
    }),
    hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
  ]);
  const capturedIds = new Set(
    capturedForms.map((submission) => submission.definitionId)
  );
  const missingForms = forms.filter((form) => !capturedIds.has(form.id));

  return (
    <div>
      <Link
        href="/chemicals"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to chemicals
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <FlaskConical size={17} />
            {item.productCode || item.casNumber || "CHEMICAL"}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{item.productName}</h1>
          <p className="mt-3 max-w-4xl whitespace-pre-wrap text-slate-400">
            {item.description || "No description provided."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            {item.status.replaceAll("_", " ")}
          </span>
          {canManage && (
            <Link
              href={`/chemicals/${item.id}/governance`}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm"
            >
              Governance
            </Link>
          )}
        </div>
      </div>

      {canManage && (
        <RuntimeFormCompletion
          action={completeChemicalForms}
          entityId={item.id}
          entityIdName="chemicalId"
          forms={missingForms}
          submitLabel="Save Chemical Forms"
        />
      )}

      <EntityCustomFormSubmissions
        organizationId={organizationId}
        userId={user.id}
        module={ConfigurableFormModule.CHEMICAL}
        entityType={DocumentEntityType.CHEMICAL}
        entityId={item.id}
        canUpload={canManage && documentUploadEnabled}
        className="mt-8 space-y-6"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck size={20} className="text-cyan-300" />
            Hazard profile
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Detail label="Manufacturer" value={item.manufacturer} />
            <Detail label="Supplier" value={item.supplier} />
            <Detail label="Signal word" value={item.signalWord} />
            <Detail label="Hazards" value={item.hazardClassifications} />
            <Detail label="Required PPE" value={item.requiredPpe} />
            <Detail label="Exposure limits" value={item.exposureLimits} />
            <Detail label="First aid" value={item.firstAidMeasures} />
            <Detail label="Spill response" value={item.spillResponse} />
            <Detail label="Storage" value={item.storageRequirements} />
            <Detail label="Incompatibilities" value={item.incompatibilities} />
            <Detail
              label="SDS review due"
              value={item.sdsReviewDueDate?.toLocaleDateString() || null}
            />
          </dl>

          {canManage && (
            <form action={reviewChemical} className="mt-6 flex gap-3">
              <input type="hidden" name="id" value={item.id} />
              <label className="flex-1 text-sm">
                Approval status
                <select
                  name="status"
                  defaultValue={item.status}
                  className={inputClassName}
                >
                  {Object.values(ChemicalApprovalStatus).map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <button className="self-end rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950">
                Review
              </button>
            </form>
          )}
        </section>

        {canManage ? (
          <form
            action={addChemicalInventory}
            className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <input type="hidden" name="chemicalId" value={item.id} />
            <h2 className="text-xl font-semibold">Add Site Inventory</h2>
            <label className="mt-4 block text-sm">
              Site
              <select name="siteId" className={inputClassName}>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <InventoryField name="storageLocation" label="Storage location" />
            <InventoryField name="quantity" label="Quantity" numeric />
            <InventoryField name="unit" label="Unit" />
            <InventoryField
              name="maximumAllowed"
              label="Maximum allowed"
              numeric
              optional
            />
            <InventoryField
              name="containerType"
              label="Container type"
              optional
            />
            <label className="mt-4 block text-sm">
              Storage notes
              <textarea
                name="storageNotes"
                rows={3}
                className={inputClassName}
              />
            </label>
            <button className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">
              Save Inventory
            </button>
          </form>
        ) : (
          <section className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Inventory access</h2>
            <p className="mt-2 text-sm text-slate-400">
              You can review inventory locations below. A chemical manager must
              update quantities or approval controls.
            </p>
          </section>
        )}
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Site Inventory</h2>
        <div className="mt-4 space-y-3">
          {item.inventories.map((inventory) => (
            <div
              key={inventory.id}
              className="rounded-xl bg-slate-950/50 p-4"
            >
              {inventory.site.name} · {inventory.storageLocation} · {" "}
              {inventory.quantity} {inventory.unit}
              {inventory.maximumAllowed
                ? ` / ${inventory.maximumAllowed} max`
                : ""}
            </div>
          ))}
          {item.inventories.length === 0 && (
            <p className="text-sm text-slate-400">
              No site inventory has been recorded.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-slate-200">
        {value || "Not recorded"}
      </dd>
    </div>
  );
}

function InventoryField({
  name,
  label,
  numeric = false,
  optional = false,
}: {
  name: string;
  label: string;
  numeric?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="mt-4 block text-sm">
      {label}
      <input
        name={name}
        required={!optional}
        type={numeric ? "number" : "text"}
        step={numeric ? "any" : undefined}
        className={inputClassName}
      />
    </label>
  );
}
