import { ChemicalCreateForm } from "@/features/chemicals/chemical-create-form";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ChemicalSignalWord,
  ConfigurableFormModule,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

const textAreas = [
  ["description", "Description"],
  ["hazardClassifications", "Hazard classifications"],
  ["pictograms", "GHS pictograms"],
  ["exposureLimits", "Exposure limits"],
  ["requiredPpe", "Required PPE"],
  ["firstAidMeasures", "First aid measures"],
  ["spillResponse", "Spill response"],
  ["storageRequirements", "Storage requirements"],
  ["incompatibilities", "Incompatibilities"],
] as const;

export default async function NewChemicalPage() {
  await requirePermission(PermissionKey.MANAGE_CHEMICALS);
  const { organizationId } = await getCurrentUserTenant();
  const forms = await getPublishedRuntimeForms(
    organizationId,
    ConfigurableFormModule.CHEMICAL
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/chemicals"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to chemicals
      </Link>
      <h1 className="mt-5 text-4xl font-bold">Add Chemical Product</h1>
      <p className="mt-2 text-slate-400">
        Register chemical hazards, SDS review controls, and tenant-specific
        governance evidence.
      </p>

      <ChemicalCreateForm forms={forms}>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm">
            Product name
            <input name="productName" required className={inputClassName} />
          </label>
          <label className="block text-sm">
            Product code
            <input name="productCode" className={inputClassName} />
          </label>
          <label className="block text-sm">
            Manufacturer
            <input name="manufacturer" className={inputClassName} />
          </label>
          <label className="block text-sm">
            Supplier
            <input name="supplier" className={inputClassName} />
          </label>
          <label className="block text-sm">
            CAS number
            <input name="casNumber" className={inputClassName} />
          </label>
          <label className="block text-sm">
            Signal word
            <select name="signalWord" className={inputClassName}>
              {Object.values(ChemicalSignalWord).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            SDS revision date
            <input
              type="date"
              name="sdsRevisionDate"
              className={inputClassName}
            />
          </label>
          <label className="block text-sm">
            SDS review due date
            <input
              type="date"
              name="sdsReviewDueDate"
              className={inputClassName}
            />
          </label>
        </div>

        {textAreas.map(([name, label]) => (
          <label key={name} className="block text-sm">
            {label}
            <textarea name={name} rows={3} className={inputClassName} />
          </label>
        ))}
      </ChemicalCreateForm>
    </div>
  );
}
