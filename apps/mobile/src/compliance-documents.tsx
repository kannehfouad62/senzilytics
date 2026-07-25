import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { mobileApi, mobileBinary } from "./api";
import { uploadPrivateMobileDocument } from "./blob-upload";
import { pickEvidenceFiles, type SelectedEvidence } from "./evidence";
import {
  cacheControlledDocument,
  cachedControlledDocumentIds,
  readCachedControlledDocument,
  removeCachedControlledDocument,
} from "./storage";
import type {
  MobileBootstrap,
  MobileComplianceObligation,
  MobileCompliancePermit,
  MobileControlledDocument,
} from "./types";

export type ComplianceDocumentView = "compliance" | "documents";

type Props = {
  workspace: MobileBootstrap;
  ownerKey: string;
  online: boolean;
  initialView: ComplianceDocumentView;
  onBack: () => void;
  onRefresh: () => Promise<MobileBootstrap>;
  onNotice: (message: string) => void;
};

const documentCategories = [
  "POLICY",
  "PROCEDURE",
  "CERTIFICATE",
  "REPORT",
  "TRAINING_MATERIAL",
  "EVIDENCE",
  "OTHER",
] as const;

export function ComplianceDocumentsScreen(props: Props) {
  const available = [
    ...(props.workspace.complianceDocumentCapabilities.canViewCompliance
      ? (["compliance"] as const)
      : []),
    ...(props.workspace.complianceDocumentCapabilities.canManageDocuments
      ? (["documents"] as const)
      : []),
  ];
  const [view, setView] = useState<ComplianceDocumentView>(
    available.includes(props.initialView)
      ? props.initialView
      : (available[0] ?? "compliance")
  );

  if (!available.length) {
    return (
      <Page>
        <Header title="Compliance and documents" onBack={props.onBack} />
        <Empty text="Your role does not include compliance or controlled-document access." />
      </Page>
    );
  }

  return (
    <Page>
      <Header title="Compliance and documents" onBack={props.onBack} />
      <Text style={styles.caption}>
        Governed obligations, permits, formal evaluations, and controlled
        document records for your tenant.
      </Text>
      <Banner
        text={
          props.online
            ? `Live tenant data · refreshed ${formatDate(
                props.workspace.complianceDocumentGeneratedAt
              )}`
            : "Showing the last encrypted workspace snapshot. Evaluations, uploads, archive actions, and new downloads require a live authorization check."
        }
        warning={!props.online}
      />
      <View style={styles.row}>
        {available.map((item) => (
          <Chip
            key={item}
            label={item === "compliance" ? "Compliance" : "Documents"}
            active={view === item}
            onPress={() => setView(item)}
          />
        ))}
      </View>
      {view === "compliance" ? (
        <ComplianceWorkspace {...props} />
      ) : (
        <DocumentWorkspace {...props} />
      )}
    </Page>
  );
}

function ComplianceWorkspace(props: Props) {
  const [mode, setMode] = useState<"obligations" | "permits">("obligations");
  const [selectedObligationId, setSelectedObligationId] = useState<
    string | null
  >(null);
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const metrics = props.workspace.complianceDocumentMetrics;
  const normalized = query.trim().toLowerCase();
  const obligations = props.workspace.complianceObligations.filter(
    (item) =>
      !normalized ||
      `${item.reference ?? ""} ${item.title} ${item.authority ?? ""} ${
        item.site.name
      }`
        .toLowerCase()
        .includes(normalized)
  );
  const permits = props.workspace.compliancePermits.filter(
    (item) =>
      !normalized ||
      `${item.number} ${item.name} ${item.authority ?? ""} ${item.site.name}`
        .toLowerCase()
        .includes(normalized)
  );
  const selectedObligation = props.workspace.complianceObligations.find(
    (item) => item.id === selectedObligationId
  );
  const selectedPermit = props.workspace.compliancePermits.find(
    (item) => item.id === selectedPermitId
  );

  if (selectedObligation) {
    return (
      <ObligationDetail
        {...props}
        obligation={selectedObligation}
        onBack={() => setSelectedObligationId(null)}
      />
    );
  }
  if (selectedPermit) {
    return (
      <PermitDetail
        permit={selectedPermit}
        onBack={() => setSelectedPermitId(null)}
      />
    );
  }

  return (
    <>
      <View style={styles.metricGrid}>
        <Metric label="Obligations" value={metrics.obligations} />
        <Metric
          label="Overdue"
          value={metrics.overdueObligations}
          danger={metrics.overdueObligations > 0}
        />
        <Metric
          label="Noncompliant"
          value={metrics.noncompliantObligations}
          danger={metrics.noncompliantObligations > 0}
        />
        <Metric
          label="Permits due ≤60d"
          value={metrics.permitsExpiringWithin60Days}
          danger={metrics.permitsExpiringWithin60Days > 0}
        />
      </View>
      <View style={styles.row}>
        <Chip
          label="Obligations"
          active={mode === "obligations"}
          onPress={() => setMode("obligations")}
        />
        <Chip
          label="Permit register"
          active={mode === "permits"}
          onPress={() => setMode("permits")}
        />
      </View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${mode}`}
      />
      {mode === "obligations" ? (
        obligations.length ? (
          obligations.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedObligationId(item.id)}
            >
              <Card danger={item.isOverdue}>
                <View style={styles.titleRow}>
                  <View style={styles.grow}>
                    <Text style={styles.cardTitle}>
                      {item.reference ? `${item.reference} — ` : ""}
                      {item.title}
                    </Text>
                    <Text style={styles.muted}>
                      {item.site.name} · {humanize(item.obligationType)}
                    </Text>
                  </View>
                  <Status value={item.isOverdue ? "OVERDUE" : item.status} />
                </View>
                <Text style={styles.due}>Due {formatDate(item.dueDate)}</Text>
                <Text style={styles.small}>
                  Owner: {item.owner?.name ?? "Unassigned"} ·{" "}
                  {item.authority ?? "Authority not recorded"}
                </Text>
              </Card>
            </Pressable>
          ))
        ) : (
          <Empty text="No compliance obligations match this view." />
        )
      ) : permits.length ? (
        permits.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedPermitId(item.id)}
          >
            <Card danger={item.isExpired}>
              <View style={styles.titleRow}>
                <View style={styles.grow}>
                  <Text style={styles.cardTitle}>
                    {item.number} — {item.name}
                  </Text>
                  <Text style={styles.muted}>
                    {item.site.name} · {item.authority ?? "Authority pending"}
                  </Text>
                </View>
                <Status value={item.isExpired ? "EXPIRED" : item.status} />
              </View>
              <Text style={styles.due}>
                {item.expirationDate
                  ? `Expires ${formatDate(item.expirationDate)}`
                  : "No expiration date recorded"}
              </Text>
            </Card>
          </Pressable>
        ))
      ) : (
        <Empty text="No permits match this view." />
      )}
    </>
  );
}

function ObligationDetail(
  props: Props & {
    obligation: MobileComplianceObligation;
    onBack: () => void;
  }
) {
  const [compliant, setCompliant] = useState(true);
  const [findings, setFindings] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const item = props.obligation;

  const evaluate = async () => {
    if (!props.online) {
      setError(
        "Connect to the internet before recording a formal compliance evaluation."
      );
      return;
    }
    if (!compliant && findings.trim().length < 3) {
      setError("Describe the noncompliance finding.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await mobileApi("/api/mobile/compliance-documents", {
        method: "POST",
        body: JSON.stringify({
          action: "EVALUATE_OBLIGATION",
          complianceItemId: item.id,
          isCompliant: compliant,
          findings: findings.trim() || undefined,
          evidenceSummary: evidenceSummary.trim() || undefined,
        }),
      });
      await props.onRefresh();
      setFindings("");
      setEvidenceSummary("");
      props.onNotice("Compliance evaluation recorded and audited.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Secondary label="← Back to obligations" onPress={props.onBack} />
      <Text style={styles.detailTitle}>{item.title}</Text>
      <View style={styles.row}>
        <Status value={item.isOverdue ? "OVERDUE" : item.status} />
        <Pill text={humanize(item.obligationType)} />
      </View>
      <Card>
        <Detail label="Reference" value={item.reference} />
        <Detail label="Site" value={item.site.name} />
        <Detail label="Owner" value={item.owner?.name} />
        <Detail label="Due date" value={formatDate(item.dueDate)} />
        <Detail label="Authority" value={item.authority} />
        <Detail label="Jurisdiction" value={item.jurisdiction} />
        <Detail label="Legal reference" value={item.legalReference} />
        <Detail label="Applicability" value={item.applicability} />
        <Detail
          label="Recurrence"
          value={`${humanize(item.recurrence)} · every ${item.intervalValue}`}
        />
        <Detail label="Evidence required" value={item.evidenceRequired} />
        <Detail label="Description" value={item.description} />
      </Card>
      <Section title="Evaluation history">
        {item.evaluations.length ? (
          item.evaluations.map((evaluation) => (
            <Card key={evaluation.id}>
              <View style={styles.titleRow}>
                <Status
                  value={
                    evaluation.isCompliant ? "COMPLIANT" : "NONCOMPLIANT"
                  }
                />
                <Text style={styles.small}>
                  {formatDate(evaluation.evaluatedAt)}
                </Text>
              </View>
              <Text style={styles.muted}>
                {evaluation.evaluatedBy.name}
              </Text>
              {evaluation.findings ? (
                <Text style={styles.body}>{evaluation.findings}</Text>
              ) : null}
              {evaluation.evidenceSummary ? (
                <Text style={styles.small}>
                  Evidence: {evaluation.evidenceSummary}
                </Text>
              ) : null}
            </Card>
          ))
        ) : (
          <Empty text="No formal evaluations have been recorded." />
        )}
      </Section>
      {props.workspace.complianceDocumentCapabilities.canManageCompliance ? (
        <Section
          title="Record formal evaluation"
          detail="Online-only governance action"
        >
          <View style={styles.row}>
            <Chip
              label="Compliant"
              active={compliant}
              onPress={() => setCompliant(true)}
            />
            <Chip
              label="Noncompliant"
              active={!compliant}
              onPress={() => setCompliant(false)}
            />
          </View>
          <Field label={compliant ? "Findings / notes" : "Finding *"}>
            <Input
              value={findings}
              onChangeText={setFindings}
              placeholder="Record the evaluation determination"
              multiline
            />
          </Field>
          <Field label="Evidence summary">
            <Input
              value={evidenceSummary}
              onChangeText={setEvidenceSummary}
              placeholder="Reference controlled evidence and supporting records"
              multiline
            />
          </Field>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Primary
            label={saving ? "Recording…" : "Record evaluation"}
            disabled={saving || !props.online}
            onPress={() => {
              void evaluate();
            }}
          />
        </Section>
      ) : null}
    </>
  );
}

function PermitDetail({
  permit,
  onBack,
}: {
  permit: MobileCompliancePermit;
  onBack: () => void;
}) {
  return (
    <>
      <Secondary label="← Back to permits" onPress={onBack} />
      <Text style={styles.detailTitle}>
        {permit.number} — {permit.name}
      </Text>
      <View style={styles.row}>
        <Status value={permit.isExpired ? "EXPIRED" : permit.status} />
        {permit.expiresWithin60Days ? <Pill text="DUE WITHIN 60 DAYS" /> : null}
      </View>
      <Card>
        <Detail label="Site" value={permit.site.name} />
        <Detail label="Owner" value={permit.owner?.name} />
        <Detail label="Authority" value={permit.authority} />
        <Detail label="Permit type" value={permit.permitType} />
        <Detail
          label="Effective date"
          value={formatDate(permit.effectiveDate)}
        />
        <Detail
          label="Expiration date"
          value={formatDate(permit.expirationDate)}
        />
        <Detail
          label="Renewal due"
          value={formatDate(permit.renewalDueDate)}
        />
        <Detail label="Description" value={permit.description} />
        <Detail label="Conditions" value={permit.conditions} />
        <Detail label="Limits" value={permit.limits} />
        <Detail
          label="Reporting requirements"
          value={permit.reportingRequirements}
        />
        <Detail label="Notes" value={permit.notes} />
      </Card>
    </>
  );
}

function DocumentWorkspace(props: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<SelectedEvidence | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<(typeof documentCategories)[number]>("POLICY");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void cachedControlledDocumentIds(props.ownerKey).then((ids) => {
      if (active) setCachedIds(new Set(ids));
    });
    return () => {
      active = false;
    };
  }, [props.ownerKey]);

  const documents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return props.workspace.controlledDocuments.filter(
      (document) =>
        document.status === status &&
        (!normalized ||
          `${document.name} ${document.originalName} ${
            document.description ?? ""
          } ${document.category}`
            .toLowerCase()
            .includes(normalized))
    );
  }, [props.workspace.controlledDocuments, query, status]);
  const selected = props.workspace.controlledDocuments.find(
    (document) => document.id === selectedId
  );

  const pickUpload = async () => {
    setError("");
    try {
      const [file] = await pickEvidenceFiles();
      if (!file) return;
      setUploadFile(file);
      setUploadName(
        file.fileName.replace(/\.[^.]+$/, "").replaceAll("-", " ")
      );
    } catch (reason) {
      setError(messageOf(reason));
    }
  };

  const upload = async () => {
    if (!props.online) {
      setError("Connect to the internet before uploading a document.");
      return;
    }
    if (!uploadFile || uploadName.trim().length < 2) {
      setError("Select a file and enter a controlled-document name.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await uploadPrivateMobileDocument({
        pathname: `mobile-documents/${props.workspace.organization.id}/${uploadFile.id}/${uploadFile.fileName}`,
        body: uploadFile.bytes.buffer as ArrayBuffer,
        contentType: uploadFile.mimeType,
        clientPayload: JSON.stringify({
          localDocumentId: uploadFile.id,
          name: uploadName.trim(),
          description: uploadDescription.trim() || undefined,
          category: uploadCategory,
          fileName: uploadFile.fileName,
          mimeType: uploadFile.mimeType,
          sizeBytes: uploadFile.sizeBytes,
          checksum: uploadFile.checksum,
        }),
      });
      setUploadFile(null);
      setUploadName("");
      setUploadDescription("");
      await props.onRefresh();
      props.onNotice(
        "Controlled document uploaded. Refresh if Blob registration is still completing."
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setUploading(false);
    }
  };

  if (selected) {
    return (
      <DocumentDetail
        {...props}
        document={selected}
        cached={cachedIds.has(selected.id)}
        onBack={() => setSelectedId(null)}
        onCached={(isCached) =>
          setCachedIds((current) => {
            const next = new Set(current);
            if (isCached) next.add(selected.id);
            else next.delete(selected.id);
            return next;
          })
        }
      />
    );
  }

  return (
    <>
      <View style={styles.metricGrid}>
        <Metric
          label="Active"
          value={props.workspace.complianceDocumentMetrics.activeDocuments}
        />
        <Metric
          label="Archived"
          value={props.workspace.complianceDocumentMetrics.archivedDocuments}
        />
        <Metric
          label="Storage"
          value={formatFileSize(
            props.workspace.complianceDocumentMetrics.documentStorageBytes
          )}
        />
        <Metric label="Offline copies" value={cachedIds.size} />
      </View>
      <View style={styles.row}>
        <Chip
          label="Active"
          active={status === "ACTIVE"}
          onPress={() => setStatus("ACTIVE")}
        />
        <Chip
          label="Archived"
          active={status === "ARCHIVED"}
          onPress={() => setStatus("ARCHIVED")}
        />
      </View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search controlled documents"
      />
      {props.workspace.complianceDocumentCapabilities.canUploadDocuments ? (
        <Section
          title="Upload controlled document"
          detail="Online only · private storage · 10 MB mobile limit"
        >
          <Secondary
            label={
              uploadFile
                ? `Selected: ${uploadFile.fileName}`
                : "Choose document"
            }
            onPress={() => {
              void pickUpload();
            }}
          />
          {uploadFile ? (
            <>
              <Field label="Document name *">
                <Input
                  value={uploadName}
                  onChangeText={setUploadName}
                  placeholder="Controlled document title"
                />
              </Field>
              <Field label="Category">
                <View style={styles.row}>
                  {documentCategories.map((category) => (
                    <Chip
                      key={category}
                      label={humanize(category)}
                      active={uploadCategory === category}
                      onPress={() => setUploadCategory(category)}
                    />
                  ))}
                </View>
              </Field>
              <Field label="Description">
                <Input
                  value={uploadDescription}
                  onChangeText={setUploadDescription}
                  placeholder="Purpose, owner, or controlled-record context"
                  multiline
                />
              </Field>
              <Primary
                label={uploading ? "Uploading securely…" : "Upload document"}
                disabled={uploading || !props.online}
                onPress={() => {
                  void upload();
                }}
              />
            </>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Section>
      ) : null}
      <Secondary
        label="Refresh controlled documents"
        disabled={!props.online}
        onPress={() => {
          void props
            .onRefresh()
            .catch((reason) => props.onNotice(messageOf(reason)));
        }}
      />
      {documents.length ? (
        documents.map((document) => (
          <Pressable
            key={document.id}
            onPress={() => setSelectedId(document.id)}
          >
            <Card>
              <View style={styles.titleRow}>
                <View style={styles.grow}>
                  <Text style={styles.cardTitle}>{document.name}</Text>
                  <Text style={styles.muted}>
                    {document.originalName} · {formatFileSize(document.sizeBytes)}
                  </Text>
                </View>
                <Status value={document.status} />
              </View>
              <Text style={styles.small}>
                {humanize(document.category)} · Version {document.version} ·{" "}
                {formatDate(document.createdAt)}
              </Text>
              {cachedIds.has(document.id) ? (
                <Text style={styles.offlineReady}>
                  Encrypted offline copy available
                </Text>
              ) : null}
            </Card>
          </Pressable>
        ))
      ) : (
        <Empty text="No controlled documents match this view." />
      )}
    </>
  );
}

function DocumentDetail(
  props: Props & {
    document: MobileControlledDocument;
    cached: boolean;
    onBack: () => void;
    onCached: (cached: boolean) => void;
  }
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const document = props.document;

  const download = async () => {
    if (!props.online) {
      setError("Connect to authorize and download this controlled document.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const file = await mobileBinary(
        `/api/mobile/documents/${encodeURIComponent(document.id)}/file`
      );
      if (!file.bytes.byteLength) {
        throw new Error("The downloaded document is empty.");
      }
      if (
        document.sizeBytes > 0 &&
        file.bytes.byteLength !== document.sizeBytes
      ) {
        throw new Error(
          "The downloaded document size did not match its controlled record."
        );
      }
      if (document.checksum) {
        const digest = new Uint8Array(
          await Crypto.digest(
            Crypto.CryptoDigestAlgorithm.SHA256,
            file.bytes
          )
        );
        const checksum = Array.from(digest, (value) =>
          value.toString(16).padStart(2, "0")
        ).join("");
        if (checksum !== document.checksum) {
          throw new Error(
            "The downloaded document failed its integrity check."
          );
        }
      }
      await cacheControlledDocument(props.ownerKey, {
        documentId: document.id,
        fileName: document.originalName,
        mimeType: file.contentType || document.mimeType,
        checksum: document.checksum,
        bytes: file.bytes,
      });
      props.onCached(true);
      props.onNotice(
        "Document verified and stored in the encrypted offline workspace."
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setBusy(true);
    setError("");
    let temporary: File | null = null;
    try {
      const cached = await readCachedControlledDocument(
        props.ownerKey,
        document.id
      );
      if (!cached) {
        throw new Error(
          "Download an encrypted offline copy before opening this document."
        );
      }
      if (
        document.checksum &&
        cached.checksum &&
        cached.checksum !== document.checksum
      ) {
        await removeCachedControlledDocument(props.ownerKey, document.id);
        props.onCached(false);
        throw new Error(
          "This offline copy is not the current controlled version. Download it again."
        );
      }
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Document preview is not available on this device.");
      }
      temporary = new File(
        Paths.cache,
        `${document.id}-${safeFileName(cached.file_name)}`
      );
      if (temporary.exists) temporary.delete();
      temporary.write(
        cached.bytes instanceof Uint8Array
          ? cached.bytes
          : new Uint8Array(cached.bytes)
      );
      await Sharing.shareAsync(temporary.uri, {
        mimeType: cached.mime_type,
        dialogTitle: document.name,
      });
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      try {
        if (temporary?.exists) temporary.delete();
      } catch {
        // The operating system may retain the handoff file briefly.
      }
      setBusy(false);
    }
  };

  const remove = async () => {
    await removeCachedControlledDocument(props.ownerKey, document.id);
    props.onCached(false);
    props.onNotice("The encrypted offline document copy was removed.");
  };

  const changeStatus = async () => {
    if (!props.online) {
      setError("Connect before changing controlled-document status.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mobileApi("/api/mobile/compliance-documents", {
        method: "POST",
        body: JSON.stringify({
          action:
            document.status === "ACTIVE"
              ? "ARCHIVE_DOCUMENT"
              : "RESTORE_DOCUMENT",
          documentId: document.id,
        }),
      });
      await props.onRefresh();
      props.onNotice(
        document.status === "ACTIVE"
          ? "Document archived and audited."
          : "Document restored and audited."
      );
      props.onBack();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Secondary label="← Back to documents" onPress={props.onBack} />
      <Text style={styles.detailTitle}>{document.name}</Text>
      <View style={styles.row}>
        <Status value={document.status} />
        <Pill text={humanize(document.category)} />
        {props.cached ? <Pill text="OFFLINE READY" /> : null}
      </View>
      <Card>
        <Detail label="Filename" value={document.originalName} />
        <Detail label="Version" value={String(document.version)} />
        <Detail label="Size" value={formatFileSize(document.sizeBytes)} />
        <Detail label="MIME type" value={document.mimeType} />
        <Detail label="Uploaded" value={formatDate(document.createdAt)} />
        <Detail label="Uploaded by" value={document.uploadedBy?.name} />
        <Detail label="Record type" value={humanize(document.entityType)} />
        <Detail label="Description" value={document.description} />
      </Card>
      <View style={styles.row}>
        <Primary
          label={
            busy
              ? "Working securely…"
              : props.cached
                ? "Refresh encrypted copy"
                : "Download encrypted copy"
          }
          disabled={busy || !props.online}
          onPress={() => {
            void download();
          }}
        />
        {props.cached ? (
          <>
            <Secondary
              label="Open / share"
              disabled={busy}
              onPress={() => {
                void open();
              }}
            />
            <Secondary
              label="Remove offline copy"
              disabled={busy}
              onPress={() => {
                void remove();
              }}
            />
          </>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Section title="Version history">
        {document.versions.map((version) => (
          <Card key={version.id}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>Version {version.version}</Text>
              {version.isLatest ? <Status value="CURRENT" /> : null}
            </View>
            <Text style={styles.muted}>
              {version.originalName} · {formatFileSize(version.sizeBytes)}
            </Text>
            <Text style={styles.small}>
              {formatDate(version.createdAt)} ·{" "}
              {version.uploadedBy?.name ?? "System"}
            </Text>
          </Card>
        ))}
      </Section>
      <Section
        title="Document lifecycle"
        detail="Online-only and written to the tenant activity log"
      >
        <Secondary
          label={document.status === "ACTIVE" ? "Archive document" : "Restore document"}
          disabled={busy || !props.online}
          onPress={() => {
            void changeStatus();
          }}
        />
      </Section>
    </>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

function Header({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.back}>← Workspace</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{title}</Text>
    </View>
  );
}

function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.small}>{detail}</Text> : null}
      {children}
    </View>
  );
}

function Card({
  children,
  danger = false,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <View style={[styles.card, danger && styles.dangerCard]}>{children}</View>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <View style={[styles.metric, danger && styles.dangerCard]}>
      <Text style={[styles.metricValue, danger && styles.dangerText]}>
        {value}
      </Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function Banner({ text, warning = false }: { text: string; warning?: boolean }) {
  return (
    <View style={[styles.banner, warning && styles.warningBanner]}>
      <Text style={warning ? styles.warningText : styles.bannerText}>
        {text}
      </Text>
    </View>
  );
}

function Status({ value }: { value: string }) {
  const danger = /OVERDUE|EXPIRED|NONCOMPLIANT|REJECTED/.test(value);
  return (
    <View style={[styles.status, danger && styles.dangerStatus]}>
      <Text style={[styles.statusText, danger && styles.dangerText]}>
        {humanize(value)}
      </Text>
    </View>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Input({
  multiline = false,
  ...props
}: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor="#64748b"
      style={[styles.input, multiline && styles.multiline, props.style]}
    />
  );
}

function Primary({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.primary, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function Secondary({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.secondary, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.detail}>
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.body}>{value || "Not specified"}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not specified";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not specified" : date.toLocaleString();
}

function formatFileSize(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  if (value < 1_073_741_824)
    return `${(value / 1_048_576).toFixed(1)} MB`;
  return `${(value / 1_073_741_824).toFixed(1)} GB`;
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKC")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .slice(0, 140) || "controlled-document"
  );
}

function messageOf(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "The controlled action could not be completed.";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 20, paddingBottom: 140, gap: 14 },
  header: { gap: 8 },
  back: { color: "#67e8f9", fontSize: 14, fontWeight: "700" },
  pageTitle: { color: "#f8fafc", fontSize: 28, fontWeight: "800" },
  detailTitle: { color: "#f8fafc", fontSize: 24, fontWeight: "800" },
  caption: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  section: { gap: 12, marginTop: 8 },
  sectionTitle: { color: "#e2e8f0", fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  titleRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  grow: { flex: 1, gap: 4 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    minWidth: "46%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e3a5f",
    backgroundColor: "#0b1c30",
    padding: 14,
  },
  metricValue: { color: "#67e8f9", fontSize: 22, fontWeight: "900" },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1e3a5f",
    backgroundColor: "#0b1c30",
    padding: 16,
    gap: 9,
  },
  dangerCard: { borderColor: "#fb718566", backgroundColor: "#3f102044" },
  dangerText: { color: "#fda4af" },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  body: { color: "#e2e8f0", fontSize: 14, lineHeight: 21 },
  muted: { color: "#94a3b8", fontSize: 13, lineHeight: 19 },
  small: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  due: { color: "#fbbf24", fontSize: 12, fontWeight: "700" },
  offlineReady: { color: "#6ee7b7", fontSize: 12, fontWeight: "700" },
  banner: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#22d3ee55",
    backgroundColor: "#164e6333",
    padding: 13,
  },
  bannerText: { color: "#a5f3fc", fontSize: 12, lineHeight: 18 },
  warningBanner: {
    borderColor: "#f59e0b55",
    backgroundColor: "#78350f33",
  },
  warningText: { color: "#fde68a", fontSize: 12, lineHeight: 18 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { borderColor: "#22d3ee", backgroundColor: "#164e63" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#cffafe" },
  status: {
    borderRadius: 999,
    backgroundColor: "#164e6355",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dangerStatus: { backgroundColor: "#7f1d1d55" },
  statusText: { color: "#67e8f9", fontSize: 10, fontWeight: "900" },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { color: "#cbd5e1", fontSize: 10, fontWeight: "800" },
  field: { gap: 6 },
  fieldLabel: { color: "#cbd5e1", fontSize: 13, fontWeight: "700" },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  primary: {
    borderRadius: 14,
    backgroundColor: "#22d3ee",
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  primaryText: { color: "#082f49", fontWeight: "900", textAlign: "center" },
  secondary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#38bdf855",
    backgroundColor: "#0c4a6e33",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryText: { color: "#bae6fd", fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.45 },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
  detail: { gap: 3, borderBottomWidth: 1, borderBottomColor: "#1e293b", paddingBottom: 9 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#334155",
    padding: 20,
    alignItems: "center",
  },
});
