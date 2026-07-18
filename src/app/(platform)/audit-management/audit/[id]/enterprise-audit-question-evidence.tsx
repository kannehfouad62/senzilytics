"use client";

import {
  Camera,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type EvidenceItem = {
  id: string;
  evidenceType: string;
  title: string;
  description: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  capturedAt: string | null;
  createdAt: string;
  downloadUrl: string;
  capturedBy: {
    id: string;
    name: string | null;
  } | null;
};

function formatFileSize(
  value: number | null
) {
  if (!value) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(value) /
        Math.log(1024)
    ),
    units.length - 1
  );

  return `${(
    value /
    1024 ** index
  ).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`;
}

export function EnterpriseAuditQuestionEvidence({
  auditId,
  questionId,
  locked,
  requireEvidence,
  requirePhoto,
  initialCount,
}: {
  auditId: string;
  questionId: string;
  locked: boolean;
  requireEvidence: boolean;
  requirePhoto: boolean;
  initialCount: number;
}) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [evidence, setEvidence] =
    useState<EvidenceItem[]>([]);

  const [count, setCount] =
    useState(initialCount);

  const [loading, setLoading] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [message, setMessage] =
    useState<{
      success: boolean;
      text: string;
    } | null>(null);

  const endpoint = `/api/audit-management/audit/${auditId}/questions/${questionId}/evidence`;

  async function loadEvidence() {
    setLoading(true);

    try {
      const response =
        await fetch(endpoint, {
          cache: "no-store",
        });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "Audit evidence could not be loaded."
        );
      }

      setEvidence(payload.evidence);
      setCount(payload.evidence.length);
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "Audit evidence could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvidence();
  }, [auditId, questionId]);

  async function uploadFile(
    file: File
  ) {
    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("title", file.name);

    try {
      const response =
        await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "Audit evidence could not be uploaded."
        );
      }

      setEvidence((current) => [
        payload.evidence,
        ...current,
      ]);

      setCount(
        (current) => current + 1
      );

      setMessage({
        success: true,
        text: payload.message,
      });
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "Audit evidence could not be uploaded.",
      });
    } finally {
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function removeEvidence(
    evidenceId: string
  ) {
    setMessage(null);

    const response = await fetch(
      `/api/audit-management/audit-evidence/${evidenceId}`,
      {
        method: "DELETE",
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      setMessage({
        success: false,
        text:
          payload.message ||
          "Audit evidence could not be deleted.",
      });
      return;
    }

    setEvidence((current) =>
      current.filter(
        (item) =>
          item.id !== evidenceId
      )
    );

    setCount((current) =>
      Math.max(0, current - 1)
    );

    setMessage({
      success: true,
      text: payload.message,
    });
  }

  const requirementMissing =
    (requireEvidence ||
      requirePhoto) &&
    count === 0;

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            {requirePhoto ? (
              <Camera size={16} />
            ) : (
              <Paperclip size={16} />
            )}
            Question evidence
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {count} attachment
            {count === 1 ? "" : "s"}
            {requirementMissing
              ? " · required before completion"
              : ""}
          </p>
        </div>

        {!locked && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={
                requirePhoto
                  ? "image/*"
                  : undefined
              }
              onChange={(event) => {
                const file =
                  event.target.files?.[0];

                if (file) {
                  void uploadFile(file);
                }
              }}
            />

            <button
              type="button"
              onClick={() =>
                inputRef.current?.click()
              }
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2
                  size={15}
                  className="animate-spin"
                />
              ) : (
                <Upload size={15} />
              )}
              Add evidence
            </button>
          </>
        )}
      </div>

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2
            size={15}
            className="animate-spin"
          />
          Loading evidence
        </p>
      )}

      {!loading &&
        evidence.length > 0 && (
          <div className="mt-4 space-y-2">
            {evidence.map((item) => (
              <article
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <FileText
                    size={17}
                    className="mt-0.5 shrink-0 text-cyan-300"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(
                        item.fileSize
                      )}
                      {" · "}
                      {item.capturedBy?.name ||
                        "System"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={item.downloadUrl}
                    className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:text-white"
                    aria-label={`Download ${item.title}`}
                  >
                    <Download size={15} />
                  </a>

                  {!locked && (
                    <button
                      type="button"
                      onClick={() =>
                        void removeEvidence(
                          item.id
                        )
                      }
                      className="rounded-lg border border-red-400/20 p-2 text-red-300 transition hover:bg-red-400/10"
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

      {message && (
        <p
          className={`mt-3 rounded-xl border p-3 text-sm ${
            message.success
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-red-400/20 bg-red-400/10 text-red-200"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
