"use client";

import { upload } from "@vercel/blob/client";
import { LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const input =
  "w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm";

export function SamplingFrameUpload({
  projectId,
  designId,
}: {
  projectId: string;
  designId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(data: FormData) {
    const file = data.get("file");
    const name = String(data.get("name") ?? "").trim();
    if (!(file instanceof File) || !file.size || !name)
      return setMessage("Enter a frame name and select a CSV or XLSX file.");
    setPending(true);
    setMessage("");
    try {
      await upload(
        `research-sampling-frames/${projectId}/${designId}/${file.name}`,
        file,
        {
          access: "private",
          handleUploadUrl: "/api/research/sampling-frames/upload",
          clientPayload: JSON.stringify({
            projectId,
            designId,
            name,
            fileName: file.name,
            fileSize: file.size,
            identifierColumn: String(data.get("identifierColumn") ?? "").trim(),
            strataColumn: String(data.get("strataColumn") ?? "").trim(),
            clusterColumn: String(data.get("clusterColumn") ?? "").trim(),
          }),
        },
      );
      setMessage("Sampling frame uploaded and validated.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sampling frame upload failed.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      action={submit}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <h2 className="text-xl font-semibold">Upload private sampling frame</h2>
      <p className="mt-2 text-sm text-slate-400">
        CSV or XLSX, maximum 10 MB and 50,000 units. Column names must exactly
        match the file header. Raw frame data remains in private storage.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <input
          name="name"
          required
          maxLength={160}
          placeholder="Sampling frame name"
          className={input}
        />
        <input
          name="file"
          type="file"
          required
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={input}
        />
        <input
          name="identifierColumn"
          required
          maxLength={160}
          placeholder="Unique identifier column"
          className={input}
        />
        <input
          name="strataColumn"
          maxLength={160}
          placeholder="Strata column (when required)"
          className={input}
        />
        <input
          name="clusterColumn"
          maxLength={160}
          placeholder="Cluster column (when required)"
          className={input}
        />
      </div>
      <button
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          <Upload size={16} />
        )}
        {pending ? "Validating…" : "Upload and validate frame"}
      </button>
      {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
    </form>
  );
}
