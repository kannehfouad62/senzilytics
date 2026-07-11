"use client";

import {
  Clock3,
  Download,
  Eye,
  FileText,
  History,
  LoaderCircle,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type DocumentVersion = {
  id: string;
  name: string;
  originalName: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isLatest: boolean;
  status: string;
  createdAt: string;
  uploadedBy: {
    name: string;
    email: string;
  } | null;
};

type DocumentVersionHistoryProps = {
  documentId: string;
  documentName: string;
};

const PREVIEWABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function DocumentVersionHistory({
  documentId,
  documentName,
}: DocumentVersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadVersions() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/documents/${documentId}/versions`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = (await response.json()) as {
        versions?: DocumentVersion[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error || "Version history could not be loaded."
        );
      }

      setVersions(result.versions || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Version history could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function openDialog() {
    setIsOpen(true);
    await loadVersions();
  }

  function closeDialog() {
    setIsOpen(false);
    setError(null);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDialog();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-400/20"
      >
        <History size={16} />
        Version History
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Version history for ${documentName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeDialog();
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
              <div>
                <p className="flex items-center gap-2 text-sm text-blue-300">
                  <History size={16} />
                  Document Versioning
                </p>

                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Version History
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {documentName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                aria-label="Close version history"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {isLoading && (
                <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                  <LoaderCircle
                    size={22}
                    className="animate-spin text-cyan-300"
                  />
                  Loading version history...
                </div>
              )}

              {error && !isLoading && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-300">
                  {error}
                </div>
              )}

              {!isLoading && !error && (
                <div className="space-y-4">
                  {versions.map((version) => {
                    const canPreview =
                      PREVIEWABLE_MIME_TYPES.has(version.mimeType);

                    return (
                      <article
                        key={version.id}
                        className={`rounded-2xl border p-5 ${
                          version.isLatest
                            ? "border-cyan-400/30 bg-cyan-400/5"
                            : "border-white/10 bg-white/[0.025]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-xl bg-blue-400/10 p-3 text-blue-300">
                              <FileText size={20} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-white">
                                  Version {version.version}
                                </h3>

                                {version.isLatest && (
                                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                                    LATEST
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 break-words text-sm text-slate-300">
                                {version.originalName}
                              </p>

                              {version.description && (
                                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                                  {version.description}
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock3 size={13} />
                                  {new Date(
                                    version.createdAt
                                  ).toLocaleString()}
                                </span>

                                <span>
                                  Uploaded by{" "}
                                  {version.uploadedBy?.name || "System"}
                                </span>

                                <span>
                                  {formatFileSize(version.sizeBytes)}
                                </span>

                                <span>{version.mimeType}</span>
                              </div>
                            </div>
                          </div>

                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                            {version.status}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                          {canPreview && (
                            <a
                              href={`/api/documents/${version.id}/preview`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
                            >
                              <Eye size={16} />
                              Preview
                            </a>
                          )}

                          <a
                            href={`/api/documents/${version.id}/download`}
                            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                          >
                            <Download size={16} />
                            Download
                          </a>
                        </div>
                      </article>
                    );
                  })}

                  {versions.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center text-slate-400">
                      No document versions were found.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kilobytes = sizeBytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  const megabytes = kilobytes / 1024;

  return `${megabytes.toFixed(1)} MB`;
}