"use client";

import { initialFormActionState, type FormActionState } from "@/core/actions/action-state";
import {
  createTenantDepartment,
  createTenantSite,
  updateTenantDepartment,
  updateTenantSite,
} from "@/features/identity/organization-structure.actions";
import { Building2, MapPin, Pencil, Plus, Users } from "lucide-react";
import { useActionState } from "react";

type Department = { id: string; name: string; siteId: string };
type Site = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  departments: Department[];
};

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-400/40";

export function OrganizationStructureManager({ sites }: { sites: Site[] }) {
  return (
    <section className="mb-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Building2 size={16} /> Tenant configuration
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Sites & departments</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Configure your company structure. Department changes remain attached
            to existing users and operational records for traceability.
          </p>
        </div>
        <CreateSiteForm />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {sites.map((site) => (
          <article
            key={site.id}
            className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <MapPin size={16} className="text-cyan-300" /> {site.name}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {[site.city, site.state, site.country].filter(Boolean).join(", ") ||
                    "Location not provided"}
                </p>
              </div>
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300">
                  <Pencil size={13} /> Edit site
                </summary>
                <div className="mt-3 min-w-0 sm:min-w-[420px]">
                  <EditSiteForm site={site} />
                </div>
              </details>
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Users size={15} className="text-cyan-300" /> Departments
                </p>
                <span className="text-xs text-slate-500">
                  {site.departments.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {site.departments.map((department) => (
                  <details
                    key={department.id}
                    className="rounded-xl border border-white/10 bg-white/[.03]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>{department.name}</span>
                      <span className="flex items-center gap-1 text-xs text-cyan-300">
                        <Pencil size={12} /> Edit
                      </span>
                    </summary>
                    <EditDepartmentForm department={department} sites={sites} />
                  </details>
                ))}
                {site.departments.length === 0 && (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                    No departments yet.
                  </p>
                )}
              </div>
              <CreateDepartmentForm siteId={site.id} />
            </div>
          </article>
        ))}
      </div>

      {sites.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-cyan-400/20 bg-cyan-400/[.03] p-8 text-center">
          <p className="font-medium">Create your first site</p>
          <p className="mt-2 text-sm text-slate-400">
            A department must belong to a site. Add a site to begin defining
            your company structure.
          </p>
        </div>
      )}
    </section>
  );
}

function CreateSiteForm() {
  const [state, action, pending] = useActionState(
    createTenantSite,
    initialFormActionState,
  );
  return (
    <details className="w-full sm:w-auto">
      <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950">
        <Plus size={16} /> Add site
      </summary>
      <form
        action={action}
        className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4 sm:min-w-[440px] sm:grid-cols-2"
      >
        <Field name="name" label="Site name" required className="sm:col-span-2" />
        <Field name="address" label="Address" className="sm:col-span-2" />
        <Field name="city" label="City" />
        <Field name="state" label="State / province" />
        <Field name="country" label="Country" className="sm:col-span-2" />
        <Feedback state={state} className="sm:col-span-2" />
        <Submit pending={pending} label="Create site" className="sm:col-span-2" />
      </form>
    </details>
  );
}

function EditSiteForm({ site }: { site: Site }) {
  const [state, action, pending] = useActionState(
    updateTenantSite,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4 sm:grid-cols-2"
    >
      <input type="hidden" name="siteId" value={site.id} />
      <Field name="name" label="Site name" required defaultValue={site.name} className="sm:col-span-2" />
      <Field name="address" label="Address" defaultValue={site.address || ""} className="sm:col-span-2" />
      <Field name="city" label="City" defaultValue={site.city || ""} />
      <Field name="state" label="State / province" defaultValue={site.state || ""} />
      <Field name="country" label="Country" defaultValue={site.country || ""} className="sm:col-span-2" />
      <Feedback state={state} className="sm:col-span-2" />
      <Submit pending={pending} label="Save site" className="sm:col-span-2" />
    </form>
  );
}

function CreateDepartmentForm({ siteId }: { siteId: string }) {
  const [state, action, pending] = useActionState(
    createTenantDepartment,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="siteId" value={siteId} />
      <label className="min-w-48 flex-1 text-xs text-slate-400">
        New department
        <input name="name" required maxLength={100} className={input} />
      </label>
      <Submit pending={pending} label="Add department" />
      <Feedback state={state} className="w-full" />
    </form>
  );
}

function EditDepartmentForm({
  department,
  sites,
}: {
  department: Department;
  sites: Site[];
}) {
  const [state, action, pending] = useActionState(
    updateTenantDepartment,
    initialFormActionState,
  );
  return (
    <form action={action} className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-2">
      <input type="hidden" name="departmentId" value={department.id} />
      <label className="text-xs text-slate-400">
        Department name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={department.name}
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400">
        Site
        <select name="siteId" defaultValue={department.siteId} className={input}>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <Feedback state={state} className="sm:col-span-2" />
      <Submit pending={pending} label="Save department" className="sm:col-span-2" />
    </form>
  );
}

function Field({
  name,
  label,
  className = "",
  ...props
}: {
  name: string;
  label: string;
  className?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className={`text-xs text-slate-400 ${className}`}>
      {label}
      <input name={name} maxLength={name === "address" ? 200 : 100} className={input} {...props} />
    </label>
  );
}

function Feedback({
  state,
  className = "",
}: {
  state: FormActionState;
  className?: string;
}) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "ERROR" ? "alert" : "status"}
      className={`rounded-xl border p-3 text-xs ${
        state.status === "ERROR"
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      } ${className}`}
    >
      {state.message}
    </p>
  );
}

function Submit({
  pending,
  label,
  className = "",
}: {
  pending: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      disabled={pending}
      className={`rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50 ${className}`}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
