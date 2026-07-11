"use client";

import {
  Eye,
  FileText,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type DocumentPreviewProps = {
  documentId: string;
  documentName: string;
  mimeType: string;
};

const PREVIEWABLE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function DocumentPreview({
  documentId,
  documentName,
  mimeType,
}: DocumentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const canPreview =
    PREVIEWABLE_MIME_TYPES.has(mimeType);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isOpen]);

  if (!canPreview) {
    return null;
  }

  const previewUrl =
    `/api/documents/${documentId}/preview`;

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
      >
        <Eye size={16} />
        Preview
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${documentName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
                  <FileText size={20} />
                </div>

                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {documentName}
                  </p>

                  <p className="text-xs text-slate-500">
                    Secure document preview
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                aria-label="Close preview"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/30 p-4">
              {isImage && (
                <img
                  src={previewUrl}
                  alt={documentName}
                  className="max-h-full max-w-full rounded-2xl object-contain"
                />
              )}

              {isPdf && (
                <iframe
                  src={previewUrl}
                  title={documentName}
                  className="h-full min-h-[70vh] w-full rounded-2xl border border-white/10 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}