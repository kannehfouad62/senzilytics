import {
  archiveDocumentAction,
  deleteDocumentAction,
  restoreDocumentAction,
} from "@/core/documents/document.actions";
import { DocumentPreview } from "@/core/documents/document-preview";
import { ReplaceDocumentUpload } from "@/core/documents/replace-document-upload";
import { DocumentVersionHistory } from "@/core/documents/document-version-history";
import { ConfirmDocumentAction } from "@/core/documents/confirm-document-action";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  DocumentCategory,
  DocumentEntityType,
  DocumentStatus,
  PermissionKey,
  Prisma,
} from "@prisma/client";
import { hasSubscriptionFeature } from "@/lib/subscription";
import {
  Archive,
  Download,
  FileArchive,
  FileText,
  FolderOpen,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DocumentCenterPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    entityType?: string;
  }>;
};

export default async function DocumentCenterPage({
  searchParams,
}: DocumentCenterPageProps) {
  await requirePermission(PermissionKey.MANAGE_DOCUMENTS);

  const {
    organizationId,
    user: currentUser,
  } = await getCurrentUserTenant();

  const filters = await searchParams;
  const canUploadDocuments = await hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD");

  const query = filters.q?.trim() || "";

  const category = isEnumValue(
    DocumentCategory,
    filters.category
  )
    ? filters.category
    : undefined;

  const status = isEnumValue(
    DocumentStatus,
    filters.status
  )
    ? filters.status
    : undefined;

  const entityType = isEnumValue(
    DocumentEntityType,
    filters.entityType
  )
    ? filters.entityType
    : undefined;

  const where: Prisma.DocumentWhereInput = {
    organizationId,
    isLatest: true,

    status:
      status ??
      {
        not: DocumentStatus.DELETED,
      },

    ...(category
      ? {
          category,
        }
      : {}),

    ...(entityType
      ? {
          entityType,
        }
      : {}),

    ...(query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              originalName: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [
    documents,
    activeCount,
    archivedCount,
    totalStorage,
  ] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    }),

    prisma.document.count({
      where: {
        organizationId,
        isLatest: true,
        status: DocumentStatus.ACTIVE,
      },
    }),

    prisma.document.count({
      where: {
        organizationId,
        isLatest: true,
        status: DocumentStatus.ARCHIVED,
      },
    }),

    prisma.document.aggregate({
      where: {
        organizationId,
        status: {
          not: DocumentStatus.DELETED,
        },
      },
      _sum: {
        sizeBytes: true,
      },
    }),
  ]);

  const returnTo = buildReturnPath(filters);

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <FolderOpen size={16} />
          Enterprise Document Management
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
          Document Center
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          Search, preview, download, replace, archive, restore,
          and manage documents across your organization.
        </p>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-3">
        <StatCard
          label="Active Documents"
          value={activeCount.toString()}
          icon={FileText}
        />

        <StatCard
          label="Archived Documents"
          value={archivedCount.toString()}
          icon={FileArchive}
        />

        <StatCard
          label="Storage Used"
          value={formatFileSize(
            totalStorage._sum.sizeBytes ?? 0
          )}
          icon={FolderOpen}
        />
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <form className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Search documents
            </label>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4">
              <Search
                size={18}
                className="text-slate-500"
              />

              <input
                name="q"
                defaultValue={query}
                placeholder="Name, filename, or description..."
                className="w-full bg-transparent py-3 text-white outline-none"
              />
            </div>
          </div>

          <FilterSelect
            label="Category"
            name="category"
            defaultValue={category || ""}
            options={Object.values(DocumentCategory)}
          />

          <FilterSelect
            label="Status"
            name="status"
            defaultValue={status || ""}
            options={[
              DocumentStatus.ACTIVE,
              DocumentStatus.ARCHIVED,
            ]}
          />

          <FilterSelect
            label="Record Type"
            name="entityType"
            defaultValue={entityType || ""}
            options={Object.values(DocumentEntityType)}
          />

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Apply
            </button>

            <Link
              href="/documents"
              className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/5"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 p-6">
          <h2 className="text-2xl font-semibold text-white">
            Documents
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Showing {documents.length} matching document
            {documents.length === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {documents.map((document) => {
            const relatedLink = getRelatedRecordLink(
              document.entityType,
              document.entityId
            );

            return (
              <article
                key={document.id}
                className="p-6 transition hover:bg-white/[0.025]"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                      <FileText size={22} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-white">
                        {document.name}
                      </h3>

                      <p className="mt-1 break-words text-sm text-slate-400">
                        {document.description ||
                          document.originalName}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                        <span>
                          Uploaded by{" "}
                          {document.uploadedBy?.name ||
                            "System"}
                        </span>

                        <span>
                          {document.createdAt.toLocaleString()}
                        </span>

                        <span>
                          {formatFileSize(
                            document.sizeBytes
                          )}
                        </span>

                        <span>
                          Version {document.version}
                        </span>

                        <span>
                          {document.entityType.replaceAll(
                            "_",
                            " "
                          )}
                        </span>

                        <span>{document.mimeType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      status={document.status}
                    />

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {document.category.replaceAll(
                        "_",
                        " "
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                  <DocumentPreview
                    documentId={document.id}
                    documentName={document.name}
                    mimeType={document.mimeType}
                  />

<DocumentVersionHistory
  documentId={document.id}
  documentName={document.name}
/>

                  <a
                    href={`/api/documents/${document.id}/download`}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    <Download size={16} />
                    Download
                  </a>

                  {canUploadDocuments && document.status ===
                    DocumentStatus.ACTIVE && (
                    <ReplaceDocumentUpload
                      documentId={document.id}
                      documentName={document.name}
                      entityType={document.entityType}
                      entityId={document.entityId}
                      organizationId={organizationId}
                      userId={currentUser.id}
                    />
                  )}

                  {relatedLink && (
                    <Link
                      href={relatedLink}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                    >
                      <FolderOpen size={16} />
                      Open Related Record
                    </Link>
                  )}

                  {document.status ===
                    DocumentStatus.ACTIVE && (
                    <form
                      action={archiveDocumentAction}
                    >
                      <input
                        type="hidden"
                        name="documentId"
                        value={document.id}
                      />

                      <input
                        type="hidden"
                        name="returnTo"
                        value={returnTo}
                      />

<ConfirmDocumentAction
  title="Archive document?"
  description="The document will remain available in the Document Center but will be marked as archived."
  confirmLabel="Archive Document"
  buttonLabel="Archive"
  icon={<Archive size={16} />}
  buttonClassName="inline-flex items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-400/20"
/>
                    </form>
                  )}

                  {document.status ===
                    DocumentStatus.ARCHIVED && (
                    <form
                      action={restoreDocumentAction}
                    >
                      <input
                        type="hidden"
                        name="documentId"
                        value={document.id}
                      />

                      <input
                        type="hidden"
                        name="returnTo"
                        value={returnTo}
                      />

<ConfirmDocumentAction
  title="Restore document?"
  description="The archived document will return to active document status."
  confirmLabel="Restore Document"
  buttonLabel="Restore"
  icon={<RotateCcw size={16} />}
  buttonClassName="inline-flex items-center gap-2 rounded-xl border border-green-400/20 bg-green-400/10 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-400/20"
/>
                    </form>
                  )}

                  <form action={deleteDocumentAction}>
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />

                    <input
                      type="hidden"
                      name="returnTo"
                      value={returnTo}
                    />

<ConfirmDocumentAction
  title="Delete document permanently?"
  description="The file will be removed from private Blob storage and the document record will be marked as deleted. This action cannot be undone."
  confirmLabel="Delete Permanently"
  buttonLabel="Delete"
  icon={<Trash2 size={16} />}
  buttonClassName="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/20"
/>
                  </form>
                </div>
              </article>
            );
          })}

          {documents.length === 0 && (
            <div className="p-12 text-center">
              <FolderOpen
                size={36}
                className="mx-auto text-slate-600"
              />

              <p className="mt-4 font-medium text-slate-300">
                No documents match your filters.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Upload a document from an incident or
                adjust your search filters.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function isEnumValue<
  T extends Record<string, string>,
>(
  enumObject: T,
  value: string | undefined
): value is T[keyof T] {
  return (
    typeof value === "string" &&
    Object.values(enumObject).includes(value)
  );
}

function buildReturnPath(filters: {
  q?: string;
  category?: string;
  status?: string;
  entityType?: string;
}) {
  const search = new URLSearchParams();

  if (filters.q) {
    search.set("q", filters.q);
  }

  if (filters.category) {
    search.set("category", filters.category);
  }

  if (filters.status) {
    search.set("status", filters.status);
  }

  if (filters.entityType) {
    search.set("entityType", filters.entityType);
  }

  const query = search.toString();

  return query
    ? `/documents?${query}`
    : "/documents";
}

function getRelatedRecordLink(
  entityType: DocumentEntityType,
  entityId: string
) {
  switch (entityType) {
    case DocumentEntityType.INCIDENT:
      return `/incidents/${entityId}`;

    case DocumentEntityType.AUDIT:
      return `/audits/${entityId}`;

    case DocumentEntityType.INSPECTION:
      return `/inspections/${entityId}`;

    case DocumentEntityType.COMPLIANCE:
      return `/compliance/${entityId}`;

    case DocumentEntityType.TRAINING:
      return `/training/${entityId}`;

    case DocumentEntityType.CORRECTIVE_ACTION:
      return `/actions/${entityId}`;

    case DocumentEntityType.CHEMICAL:
      return `/chemicals/${entityId}`;

    case DocumentEntityType.ENVIRONMENTAL:
      return `/environmental/${entityId}`;

    case DocumentEntityType.ESG:
      return `/esg/${entityId}`;

    case DocumentEntityType.RISK:
      return `/risks/${entityId}`;

    case DocumentEntityType.MOC:
      return `/moc/${entityId}`;

    case DocumentEntityType.CONTRACTOR:
      return `/contractors/${entityId}`;

    case DocumentEntityType.PERMIT_TO_WORK:
      return `/permits-to-work/${entityId}`;

    case DocumentEntityType.INDUSTRIAL_HYGIENE:
      return `/industrial-hygiene/${entityId}`;

    case DocumentEntityType.SIF_ASSURANCE:
      return "/assurance/sif/controls";

    case DocumentEntityType.CERTIFICATION_READINESS:
      return `/assurance/certification/reviews/${entityId}`;

    case DocumentEntityType.WORKFLOW:
      return "/workflows";

    default:
      return null;
  }
}

function FilterSelect<T extends string>({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly T[];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">
        {label}
      </label>

      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
      >
        <option value="">All</option>

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: DocumentStatus;
}) {
  const className =
    status === DocumentStatus.ARCHIVED
      ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
      : "border-green-400/20 bg-green-400/10 text-green-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="w-fit rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
        <Icon size={22} />
      </div>

      <p className="mt-5 text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kilobytes =
    sizeBytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  const megabytes =
    kilobytes / 1024;

  if (megabytes < 1024) {
    return `${megabytes.toFixed(1)} MB`;
  }

  const gigabytes =
    megabytes / 1024;

  return `${gigabytes.toFixed(2)} GB`;
}
