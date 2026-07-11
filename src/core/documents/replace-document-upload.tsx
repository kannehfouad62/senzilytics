"use client";

import { DocumentEntityType } from "@prisma/client";
import { upload } from "@vercel/blob/client";
import {
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SubmitEventHandler } from "react";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type ReplaceDocumentUploadProps = {
  documentId: string;
  documentName: string;
  entityType: DocumentEntityType;
  entityId: string;
  organizationId: string;
  userId: string;
};

async function calculateFileChecksum(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function ReplaceDocumentUpload({
  documentId,
  documentName,
  entityType,
  entityId,
  organizationId,
  userId,
}: ReplaceDocumentUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Select a replacement file.");
      return;
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      setError("The replacement file must be between 1 byte and 25 MB.");
      return;
    }

    setIsUploading(true);
    setIsComplete(false);
    setError(null);
    setProgress(0);

    try {
      const checksum = await calculateFileChecksum(file);

      const safeFileName = file.name
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-");

      const pathname = [
        organizationId,
        entityType.toLowerCase(),
        entityId,
        "versions",
        safeFileName,
      ].join("/");

      const clientPayload = JSON.stringify({
        organizationId,
        userId,
        entityType,
        entityId,
        category: "OTHER",
        displayName: documentName,
        originalName: file.name,
        description: null,
        sizeBytes: file.size,
        checksum,
        replacedDocumentId: documentId,
      });

      await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/documents/upload",
        clientPayload,
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          setProgress(Math.round(percentage));
        },
      });

      setProgress(100);
      setIsComplete(true);
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The replacement file could not be uploaded."
      );
    } finally {
      setIsUploading(false);
    }
  };

  function closeDialog() {
    if (isUploading) {
      return;
    }

    setIsOpen(false);
    setError(null);
    setProgress(0);
    setIsComplete(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-300 transition hover:bg-violet-400/20"
      >
        <RefreshCw size={16} />
        Replace File
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-violet-300">
                  Document Versioning
                </p>

                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Replace File
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Uploading a replacement will create a new version of{" "}
                  <span className="text-slate-200">{documentName}</span>.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                disabled={isUploading}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <input
                ref={fileInputRef}
                type="file"
                required
                disabled={isUploading || isComplete}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
              />

              {(isUploading || isComplete) && (
                <div>
                  <div className="mb-2 flex justify-between text-xs text-slate-400">
                    <span>
                      {isComplete ? "Version uploaded" : "Uploading"}
                    </span>
                    <span>{progress}%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full bg-violet-400 transition-all"
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

              {isComplete && (
                <div className="flex items-center gap-2 rounded-2xl border border-green-400/20 bg-green-400/10 p-4 text-sm text-green-300">
                  <CheckCircle2 size={18} />
                  A new document version was created successfully.
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {!isComplete && (
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-violet-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {isUploading && (
                      <LoaderCircle
                        size={18}
                        className="animate-spin"
                      />
                    )}

                    {isUploading
                      ? "Uploading..."
                      : "Create New Version"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isUploading}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-slate-300"
                >
                  {isComplete ? "Close" : "Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}