"use client";

import { DocumentCategory, DocumentEntityType,} from "@prisma/client";
import { upload } from "@vercel/blob/client";
import { CheckCircle2, FileUp, LoaderCircle, UploadCloud, XCircle,} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useMemo,
    useRef,
    useState,
  } from "react";
  
  import type {
    DragEvent,
    SubmitEventHandler,
  } from "react";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = new Set([
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
]);

type UploadState =
  | "queued"
  | "hashing"
  | "uploading"
  | "success"
  | "error";

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  state: UploadState;
  error?: string;
};

type MultiDocumentUploadProps = {
  entityType: DocumentEntityType;
  entityId: string;
  organizationId: string;
  userId: string;
  defaultCategory?: DocumentCategory;
};

async function calculateFileChecksum(file: File) {
  const fileBuffer = await file.arrayBuffer();

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    fileBuffer
  );

  const hashBytes = Array.from(new Uint8Array(hashBuffer));

  return hashBytes
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function MultiDocumentUpload({
  entityType,
  entityId,
  organizationId,
  userId,
  defaultCategory = DocumentCategory.EVIDENCE,
}: MultiDocumentUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [category, setCategory] =
    useState<DocumentCategory>(defaultCategory);
  const [description, setDescription] = useState("");

  const queuedCount = useMemo(
    () => items.filter((item) => item.state === "queued").length,
    [items]
  );

  function validateFile(file: File) {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return "Unsupported file type.";
    }

    if (file.size <= 0) {
      return "The file is empty.";
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "The maximum file size is 25 MB.";
    }

    return null;
  }

  function addFiles(files: File[]) {
    setItems((current) => {
      const existingKeys = new Set(
        current.map(
          (item) =>
            `${item.file.name}-${item.file.size}-${item.file.lastModified}`
        )
      );
  
      const newItems = files
        .filter((file) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
  
          return !existingKeys.has(key);
        })
        .map<UploadItem>((file) => {
          const validationError = validateFile(file);
  
          return {
            id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
            file,
            progress: 0,
            state: validationError ? "error" : "queued",
            error: validationError || undefined,
          };
        });
  
      return [...current, ...newItems];
    });
  }

  function handleFileSelection(files: FileList | null) {
    if (!files) return;
    addFiles(Array.from(files));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeItem(id: string) {
    if (isUploading) return;

    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  function updateItem(
    id: string,
    updates: Partial<UploadItem>
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
            }
          : item
      )
    );
  }

  async function uploadItem(item: UploadItem) {
    updateItem(item.id, {
      state: "hashing",
      progress: 0,
      error: undefined,
    });
  
    try {
      const checksum = await calculateFileChecksum(item.file);
  
      updateItem(item.id, {
        state: "uploading",
        progress: 0,
      });
  
      const safeFileName = item.file.name
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-");
  
      const pathname = [
        organizationId,
        entityType.toLowerCase(),
        entityId,
        safeFileName,
      ].join("/");
  
      const clientPayload = JSON.stringify({
        organizationId,
        userId,
        entityType,
        entityId,
        category,
        displayName: item.file.name,
        originalName: item.file.name,
        description: description.trim() || null,
        sizeBytes: item.file.size,
        checksum,
      });
  
      await upload(pathname, item.file, {
        access: "private",
        handleUploadUrl: "/api/documents/upload",
        clientPayload,
        multipart: item.file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          updateItem(item.id, {
            progress: Math.round(percentage),
          });
        },
      });
  
      updateItem(item.id, {
        state: "success",
        progress: 100,
      });
    } catch (error) {
      updateItem(item.id, {
        state: "error",
        error:
          error instanceof Error
            ? error.message
            : "Upload failed.",
      });
    }
  }

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();
  
    const queuedItems = items.filter(
      (item) => item.state === "queued"
    );
  
    if (queuedItems.length === 0) {
      return;
    }
  
    setIsUploading(true);
  
    try {
      for (const item of queuedItems) {
        await uploadItem(item);
      }
  
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  };

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
            Upload documents
          </h3>
          <p className="text-sm text-slate-400">
            Drag and drop multiple files, up to 25 MB each.
          </p>
        </div>
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();

          if (event.currentTarget === event.target) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`rounded-2xl border border-dashed p-8 text-center transition ${
          isDragging
            ? "border-cyan-400 bg-cyan-400/10"
            : "border-white/15 bg-slate-950/40"
        }`}
      >
        <FileUp
          size={28}
          className="mx-auto text-cyan-300"
        />

        <p className="mt-3 font-medium text-white">
          Drop files here
        </p>

        <p className="mt-1 text-sm text-slate-400">
          or choose files from your computer
        </p>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
        >
          Choose Files
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          disabled={isUploading}
          onChange={(event) => {
            handleFileSelection(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Category
          </label>

          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as DocumentCategory)
            }
            disabled={isUploading}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          >
            {Object.values(DocumentCategory).map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Shared description
          </label>

          <input
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            disabled={isUploading}
            placeholder="Optional description for all selected files"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {item.file.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                {(item.state === "hashing" ||
  item.state === "uploading") && (
  <LoaderCircle
    size={18}
    className="animate-spin text-cyan-300"
  />
)}

                  {item.state === "success" && (
                    <CheckCircle2
                      size={18}
                      className="text-green-300"
                    />
                  )}

                  {item.state === "error" && (
                    <XCircle
                      size={18}
                      className="text-red-300"
                    />
                  )}

                  {!isUploading &&
                    item.state !== "success" && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-slate-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                </div>
              </div>

              {item.state === "hashing" && (
  <p className="mt-3 text-xs text-cyan-300">
    Checking file for duplicates...
  </p>
)}

              {(item.state === "uploading" ||
                item.state === "success") && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>
                      {item.state === "success"
                        ? "Uploaded"
                        : "Uploading"}
                    </span>
                    <span>{item.progress}%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{
                        width: `${item.progress}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {item.error && (
                <p className="mt-3 text-sm text-red-300">
                  {item.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={isUploading || queuedCount === 0}
        className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading && (
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
        )}

        {isUploading
          ? "Uploading documents..."
          : `Upload ${queuedCount} file${
              queuedCount === 1 ? "" : "s"
            }`}
      </button>
    </form>
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

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}