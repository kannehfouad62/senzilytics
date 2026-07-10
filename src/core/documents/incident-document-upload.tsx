"use client";

import {
  DocumentCategory,
  DocumentEntityType,
} from "@prisma/client";
import { upload } from "@vercel/blob/client";
import {
  FileUp,
  LoaderCircle,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useRef,
  useState,
} from "react";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "text/plain",
  "text/csv",
].join(",");

type IncidentDocumentUploadProps = {
  incidentId: string;
  organizationId: string;
  userId: string;
};

export function IncidentDocumentUpload({
  incidentId,
  organizationId,
  userId,
}: IncidentDocumentUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Select a file before uploading.");
      return;
    }

    if (file.size <= 0) {
      setError("The selected file is empty.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("The maximum file size is 25 MB.");
      return;
    }

    const displayName =
      String(formData.get("displayName") || "").trim() ||
      file.name;

    const category = String(
      formData.get("category") || DocumentCategory.OTHER
    ) as DocumentCategory;

    const description =
      String(formData.get("description") || "").trim() || null;

    const clientPayload = JSON.stringify({
      organizationId,
      userId,
      entityType: DocumentEntityType.INCIDENT,
      entityId: incidentId,
      category,
      displayName,
      originalName: file.name,
      description,
      sizeBytes: file.size,
    });

    const safeFileName = file.name
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-");

    const pathname = [
      organizationId,
      "incidents",
      incidentId,
      safeFileName,
    ].join("/");

    try {
      setIsUploading(true);
      setProgress(0);

      await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/documents/upload",
        clientPayload,
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          setProgress(Math.round(percentage));
        },
      });

      form.reset();
      setProgress(100);
      router.refresh();
    } catch (uploadError) {
      console.error(uploadError);

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The document could not be uploaded."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
          <UploadCloud size={20} />
        </div>

        <div>
          <h3 className="font-semibold text-white">
            Upload attachment
          </h3>
          <p className="text-sm text-slate-400">
            Maximum file size: 25 MB
          </p>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          File
        </label>

        <input
          ref={fileInputRef}
          type="file"
          required
          accept={ACCEPTED_FILE_TYPES}
          disabled={isUploading}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Display name
          </label>

          <input
            name="displayName"
            placeholder="Optional document title"
            disabled={isUploading}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Category
          </label>

          <select
            name="category"
            defaultValue={DocumentCategory.EVIDENCE}
            disabled={isUploading}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          >
            {Object.values(DocumentCategory).map((category) => (
              <option key={category} value={category}>
                {category.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Description
        </label>

        <textarea
          name="description"
          rows={3}
          disabled={isUploading}
          placeholder="Describe the evidence or document..."
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
        />
      </div>

      {isUploading && (
        <div>
          <div className="mb-2 flex justify-between text-xs text-slate-400">
            <span>Uploading</span>
            <span>{progress}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full bg-cyan-400 transition-all"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isUploading}
        className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading ? (
          <LoaderCircle size={18} className="animate-spin" />
        ) : (
          <FileUp size={18} />
        )}

        {isUploading ? "Uploading..." : "Upload Document"}
      </button>
    </form>
  );
}