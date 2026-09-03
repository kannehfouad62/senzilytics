"use client";
import { upload } from "@vercel/blob/client";
import { LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResearchImportUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(data: FormData) {
    const file = data.get("file"), name = String(data.get("name") ?? "").trim();
    if (!(file instanceof File) || !file.size || !name) return setMessage("Enter a dataset name and select a CSV or XLSX file.");
    setPending(true); setMessage("");
    try {
      await upload(`research-imports/${projectId}/${file.name}`, file, {
        access: "private", handleUploadUrl: "/api/research/imports/upload",
        clientPayload: JSON.stringify({ projectId, name, fileName: file.name, fileSize: file.size }),
      });
      setMessage("Source file uploaded and profiled."); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setPending(false); }
  }
  return <form action={submit} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
    <h2 className="text-xl font-semibold">Import external research data</h2>
    <p className="mt-1 text-sm text-slate-400">The untouched source remains private. CSV and XLSX files up to 10 MB are profiled into a bounded preview and data dictionary.</p>
    <div className="mt-5 grid gap-3 md:grid-cols-2"><input name="name" required maxLength={160} placeholder="Dataset name" className={input}/><input name="file" type="file" required accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className={input}/></div>
    <button disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{pending?<LoaderCircle size={16} className="animate-spin"/>:<Upload size={16}/>}Import and profile</button>
    {message&&<p className="mt-3 text-sm text-slate-300">{message}</p>}
  </form>;
}
const input="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm";
