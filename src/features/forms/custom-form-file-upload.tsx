"use client";

import {
  DocumentCategory,
  DocumentEntityType,
} from "@prisma/client";
import { upload } from "@vercel/blob/client";
import {
  FileUp,
  LoaderCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type FormEvent,
} from "react";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

const ACCEPTED_TYPES =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/webp,video/mp4,text/plain,text/csv";

type SupportedEntityType =
  | typeof DocumentEntityType.SAFETY_OBSERVATION
  | typeof DocumentEntityType.INCIDENT
  | typeof DocumentEntityType.INSPECTION
  | typeof DocumentEntityType.RISK
  | typeof DocumentEntityType.MOC
  | typeof DocumentEntityType.CORRECTIVE_ACTION
  | typeof DocumentEntityType.COMPLIANCE
  | typeof DocumentEntityType.TRAINING
  | typeof DocumentEntityType.CHEMICAL
  | typeof DocumentEntityType.ENVIRONMENTAL
  | typeof DocumentEntityType.ESG
  | typeof DocumentEntityType.CONTRACTOR
  | typeof DocumentEntityType.PERMIT_TO_WORK
  | typeof DocumentEntityType.INDUSTRIAL_HYGIENE
  | typeof DocumentEntityType.SIF_ASSURANCE
  | typeof DocumentEntityType.CERTIFICATION_READINESS;

function entityFolder(
  entityType: SupportedEntityType
) {
  switch (entityType) {
    case DocumentEntityType.SAFETY_OBSERVATION:
      return "safety-observations";
    case DocumentEntityType.INCIDENT:
      return "incidents";
    case DocumentEntityType.INSPECTION:
      return "inspections";
    case DocumentEntityType.RISK:
      return "risks";
    case DocumentEntityType.MOC:
      return "moc";
    case DocumentEntityType.CORRECTIVE_ACTION:
      return "capa";
    case DocumentEntityType.COMPLIANCE:
      return "compliance";
    case DocumentEntityType.TRAINING:
      return "training";
    case DocumentEntityType.CHEMICAL:
      return "chemicals";
    case DocumentEntityType.ENVIRONMENTAL:
      return "environmental";
    case DocumentEntityType.ESG:
      return "esg";
    case DocumentEntityType.CONTRACTOR:
      return "contractors";
    case DocumentEntityType.PERMIT_TO_WORK:
      return "permits-to-work";
    case DocumentEntityType.INDUSTRIAL_HYGIENE:
      return "industrial-hygiene";
    case DocumentEntityType.SIF_ASSURANCE:
      return "sif-assurance";
    case DocumentEntityType.CERTIFICATION_READINESS:
      return "certification-readiness";
  }
}

async function checksum(file: File) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer()
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

export function CustomFormFileUpload({
  organizationId,
  userId,
  entityType,
  entityId,
  submissionId,
  fieldId,
  label,
  required,
}: {
  organizationId: string;
  userId: string;
  entityType: SupportedEntityType;
  entityId: string;
  submissionId: string;
  fieldId: string;
  label: string;
  required: boolean;
}) {
  const router = useRouter();
  const inputRef =
    useRef<HTMLInputElement>(null);
  const [busy, setBusy] =
    useState(false);
  const [progress, setProgress] =
    useState(0);
  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    const file =
      inputRef.current?.files?.[0];

    if (!file) {
      setError("Select a file.");
      return;
    }

    if (
      file.size <= 0 ||
      file.size > MAX_FILE_SIZE
    ) {
      setError(
        "The file must be between 1 byte and 25 MB."
      );
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const hash =
        await checksum(file);
      const safeName =
        file.name.replace(
          /[^a-zA-Z0-9._-]+/g,
          "-"
        );

      await upload(
        `${organizationId}/${entityFolder(entityType)}/${entityId}/custom-forms/${fieldId}/${safeName}`,
        file,
        {
          access: "private",
          handleUploadUrl:
            "/api/documents/upload",
          multipart:
            file.size >
            5 * 1024 * 1024,
          clientPayload:
            JSON.stringify({
              organizationId,
              userId,
              entityType,
              entityId,
              category:
                DocumentCategory.EVIDENCE,
              displayName: label,
              originalName:
                file.name,
              description:
                `Custom form attachment: ${label}`,
              sizeBytes: file.size,
              checksum: hash,
              configurableSubmissionId:
                submissionId,
              configurableFieldId:
                fieldId,
            }),
          onUploadProgress: ({
            percentage,
          }) =>
            setProgress(
              Math.round(
                percentage
              )
            ),
        }
      );

      router.refresh();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "The attachment could not be uploaded."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 rounded-xl border border-dashed border-white/10 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {label}
            {required && (
              <span className="text-red-300">
                {" "}*
              </span>
            )}
          </p>

          <p className="text-xs text-slate-500">
            Private attachment · Maximum 25 MB
          </p>
        </div>

        {busy && (
          <span className="text-xs text-cyan-300">
            {progress}%
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        required
        accept={ACCEPTED_TYPES}
        disabled={busy}
        className="mt-3 w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:font-semibold file:text-slate-950"
      />

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-red-300"
        >
          {error}
        </p>
      )}

      <button
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle
            size={14}
            className="animate-spin"
          />
        ) : (
          <FileUp size={14} />
        )}
        Upload attachment
      </button>
    </form>
  );
}
