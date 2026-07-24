import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  capturePhotoEvidence,
  MAX_EVIDENCE_FILES_PER_RECORD,
  pickEvidenceFiles,
  pickPhotoEvidence,
  type SelectedEvidence,
} from "./evidence";
import {
  queueEsgData,
  queueEsgDisclosureStatus,
  queueEsgEvidence,
  queueEsgForms,
  queueEsgInitiativeStatus,
} from "./storage";
import type {
  CapturedAnswer,
  CapturedForm,
  MobileBootstrap,
  MobileEsgDataQuality,
  MobileEsgInitiative,
  MobileEsgMetric,
  MobileEsgPeriod,
  RuntimeForm,
} from "./types";

export type EsgView = "disclosures" | "initiatives";
type FieldValue = string | boolean | string[];
type Shared = {
  ownerKey: string;
  online: boolean;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
};

export function EsgScreen({
  workspace,
  ownerKey,
  online,
  initialView,
  onBack,
  onQueued,
  onSync,
}: {
  workspace: MobileBootstrap;
  ownerKey: string;
  online: boolean;
  initialView: EsgView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [view, setView] = useState<EsgView>(initialView);
  const [query, setQuery] = useState("");
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [initiativeId, setInitiativeId] = useState<string | null>(null);
  const shared = { ownerKey, online, onQueued, onSync };
  const period = workspace.esgPeriods.find((item) => item.id === periodId);
  const initiative = workspace.esgInitiatives.find(
    (item) => item.id === initiativeId
  );

  if (!workspace.esgCapabilities.canView) {
    return (
      <Page>
        <Header title="Access restricted" onBack={onBack} />
        <Text style={styles.muted}>
          Your role does not include Sustainability and ESG access.
        </Text>
      </Page>
    );
  }
  if (period) {
    return (
      <PeriodDetail
        period={period}
        workspace={workspace}
        canManage={workspace.esgCapabilities.canManage}
        onBack={() => setPeriodId(null)}
        {...shared}
      />
    );
  }
  if (initiative) {
    return (
      <InitiativeDetail
        initiative={initiative}
        canManage={workspace.esgCapabilities.canManage}
        onBack={() => setInitiativeId(null)}
        {...shared}
      />
    );
  }

  const normalized = query.trim().toLowerCase();
  const periods = workspace.esgPeriods.filter(
    (item) =>
      !normalized ||
      `${item.name} ${item.boundaryDescription} ${item.status}`
        .toLowerCase()
        .includes(normalized)
  );
  const initiatives = workspace.esgInitiatives.filter(
    (item) =>
      !normalized ||
      `${item.name} ${item.description ?? ""} ${item.pillar} ${item.status}`
        .toLowerCase()
        .includes(normalized)
  );

  return (
    <Page>
      <Header title="Sustainability & ESG" onBack={onBack} />
      <View style={styles.row}>
        <Chip
          label="Disclosures"
          active={view === "disclosures"}
          onPress={() => setView("disclosures")}
        />
        <Chip
          label="Initiatives"
          active={view === "initiatives"}
          onPress={() => setView("initiatives")}
        />
      </View>
      {!online ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            ESG records, form responses, and evidence are protected in the
            encrypted device queue until secure synchronization is available.
          </Text>
        </View>
      ) : null}
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={
          view === "disclosures"
            ? "Search disclosure periods"
            : "Search ESG initiatives"
        }
      />
      {view === "disclosures" ? (
        <>
          <Summary
            items={[
              ["Periods", periods.length],
              [
                "In review",
                periods.filter((item) => item.status === "UNDER_REVIEW").length,
              ],
              [
                "Published",
                periods.filter((item) => item.status === "PUBLISHED").length,
              ],
            ]}
          />
          {periods.map((item) => (
            <Pressable key={item.id} onPress={() => setPeriodId(item.id)}>
              <Card alert={item.completenessPercent < 100}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.muted}>
                  {formatDate(item.periodStart)}–{formatDate(item.periodEnd)} ·{" "}
                  {humanize(item.status)}
                </Text>
                <Text style={styles.meta}>
                  {item.completenessPercent}% metric coverage ·{" "}
                  {item.missingFormDefinitionIds.length} form(s) outstanding
                </Text>
              </Card>
            </Pressable>
          ))}
          {!periods.length ? (
            <Text style={styles.muted}>
              No authorized disclosure period matches this search.
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Summary
            items={[
              ["Initiatives", initiatives.length],
              [
                "In progress",
                initiatives.filter((item) => item.status === "IN_PROGRESS")
                  .length,
              ],
              [
                "Completed",
                initiatives.filter((item) => item.status === "COMPLETED")
                  .length,
              ],
            ]}
          />
          {initiatives.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setInitiativeId(item.id)}
            >
              <Card>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.muted}>
                  {humanize(item.pillar)} · {humanize(item.status)}
                </Text>
                <Text style={styles.meta}>
                  {item.owner?.name || "No owner"} ·{" "}
                  {item.targetDate
                    ? `target ${formatDate(item.targetDate)}`
                    : "no target date"}
                </Text>
              </Card>
            </Pressable>
          ))}
          {!initiatives.length ? (
            <Text style={styles.muted}>
              No authorized ESG initiative matches this search.
            </Text>
          ) : null}
        </>
      )}
    </Page>
  );
}

function PeriodDetail({
  period,
  workspace,
  canManage,
  onBack,
  ...shared
}: {
  period: MobileEsgPeriod;
  workspace: MobileBootstrap;
  canManage: boolean;
  onBack: () => void;
} & Shared) {
  const missingForms = workspace.esgForms.filter((form) =>
    period.missingFormDefinitionIds.includes(form.id)
  );
  return (
    <Page>
      <Header title={period.name} onBack={onBack} />
      <Card alert={period.completenessPercent < 100}>
        <Text style={styles.kicker}>GOVERNED ESG DISCLOSURE</Text>
        <Detail label="Status" value={humanize(period.status)} />
        <Detail
          label="Period"
          value={`${formatDate(period.periodStart)}–${formatDate(
            period.periodEnd
          )}`}
        />
        <Detail label="Boundary" value={period.boundaryDescription} />
        <Detail
          label="Metric coverage"
          value={`${period.dataPoints.length}/${workspace.esgMetrics.length} (${period.completenessPercent}%)`}
        />
        <Detail
          label="Approved by"
          value={period.approvedBy?.name || null}
        />
        <Detail
          label="Published by"
          value={period.publishedBy?.name || null}
        />
      </Card>
      {canManage &&
      (period.status === "DATA_COLLECTION" ||
        period.status === "UNDER_REVIEW") ? (
        <EsgDataForm period={period} workspace={workspace} {...shared} />
      ) : null}
      {canManage && missingForms.length ? (
        <RuntimeFormsAction
          title="Required ESG forms"
          forms={missingForms}
          onSave={(customForms) =>
            queueEsgForms(shared.ownerKey, {
              periodId: period.id,
              customForms,
            })
          }
          {...shared}
        />
      ) : null}
      {canManage && period.nextStatuses.length ? (
        <Card>
          <Text style={styles.cardTitle}>Disclosure lifecycle</Text>
          <Text style={styles.help}>
            Review and completeness controls are enforced when the queued
            transition synchronizes.
          </Text>
          <View style={styles.row}>
            {period.nextStatuses.map((status) => (
              <SecondaryButton
                key={status}
                label={humanize(status)}
                onPress={() =>
                  void queueEsgDisclosureStatus(shared.ownerKey, {
                    periodId: period.id,
                    status,
                  }).then(() => queued(shared, "ESG disclosure status"))
                }
              />
            ))}
          </View>
        </Card>
      ) : null}
      {canManage ? (
        <DirectEvidence
          title="Disclosure evidence"
          help="Attach source registers, assurance records, calculations, or other disclosure evidence."
          onSave={(files) =>
            queueEsgEvidence(
              shared.ownerKey,
              period.id,
              files,
              `ESG evidence: ${period.name}`,
              period.boundaryDescription
            )
          }
          {...shared}
        />
      ) : null}
      <Text style={styles.sectionTitle}>Disclosure metrics</Text>
      {workspace.esgMetrics.map((metric) => {
        const point = period.dataPoints.find(
          (item) => item.metricId === metric.id
        );
        const targets = workspace.esgTargets.filter(
          (target) => target.metricId === metric.id
        );
        return (
          <Card key={metric.id} alert={!point}>
            <Text style={styles.cardTitle}>
              {metric.code} · {metric.name}
            </Text>
            <Text style={styles.muted}>
              {humanize(metric.pillar)} · {metric.framework?.code || "Internal"}{" "}
              · {metric.disclosureReference || "No disclosure reference"}
            </Text>
            {point ? (
              <>
                <Text style={styles.metricValue}>
                  {point.value} {metric.unit}
                </Text>
                <Text style={styles.meta}>
                  {humanize(point.quality)} · entered by {point.enteredBy.name}
                  {point.isAutoCalculated
                    ? ` · ${point.sourceRecordCount} source record(s)`
                    : ""}
                </Text>
                {point.evidenceSummary ? (
                  <Text style={styles.detailValue}>
                    {point.evidenceSummary}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.alertText}>Required metric is incomplete.</Text>
            )}
            {targets.map((target) => (
              <Text key={target.id} style={styles.meta}>
                Target: {target.baselineYear} {target.baselineValue} →{" "}
                {target.targetYear} {target.targetValue}
              </Text>
            ))}
          </Card>
        );
      })}
      {!canManage ? (
        <Text style={styles.muted}>
          This is a read-only ESG workspace for your role.
        </Text>
      ) : null}
    </Page>
  );
}

function EsgDataForm({
  period,
  workspace,
  ...shared
}: {
  period: MobileEsgPeriod;
  workspace: MobileBootstrap;
} & Shared) {
  const available = [...workspace.esgMetrics].sort(
    (left, right) =>
      Number(period.missingMetricIds.includes(right.id)) -
      Number(period.missingMetricIds.includes(left.id))
  );
  const [metricId, setMetricId] = useState(available[0]?.id || "");
  const [value, setValue] = useState("");
  const [quality, setQuality] =
    useState<MobileEsgDataQuality>("MEASURED");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [error, setError] = useState("");
  const metric = workspace.esgMetrics.find((item) => item.id === metricId);

  const save = async () => {
    try {
      setError("");
      const numericValue = Number(value);
      if (!metricId || !Number.isFinite(numericValue)) {
        throw new Error("Select an ESG metric and enter a finite value.");
      }
      await queueEsgData(
        shared.ownerKey,
        {
          periodId: period.id,
          metricId,
          value: numericValue,
          quality,
          evidenceSummary: evidenceSummary.trim() || undefined,
          sourceDescription: sourceDescription.trim() || undefined,
        },
        evidence
      );
      await queued(shared, "ESG metric data");
      setValue("");
      setEvidence([]);
    } catch (reason) {
      setError(messageOf(reason));
    }
  };

  return (
    <Card>
      <Text style={styles.cardTitle}>Record ESG metric</Text>
      <Text style={styles.help}>
        Missing metrics are shown first. Existing manual values may be corrected
        during collection or review.
      </Text>
      <View style={styles.row}>
        {available.map((item) => (
          <Chip
            key={item.id}
            label={`${item.code} · ${item.name}`}
            active={metricId === item.id}
            onPress={() => setMetricId(item.id)}
          />
        ))}
      </View>
      <Input
        value={value}
        onChangeText={setValue}
        placeholder={`Value${metric ? ` in ${metric.unit}` : ""} *`}
        keyboardType="decimal-pad"
      />
      <View style={styles.row}>
        {(
          [
            "VERIFIED",
            "MEASURED",
            "CALCULATED",
            "ESTIMATED",
            "EXTERNAL_SOURCE",
          ] as const
        ).map((item) => (
          <Chip
            key={item}
            label={humanize(item)}
            active={quality === item}
            onPress={() => setQuality(item)}
          />
        ))}
      </View>
      <Input
        value={sourceDescription}
        onChangeText={setSourceDescription}
        placeholder="Source and calculation description"
        multiline
      />
      <Input
        value={evidenceSummary}
        onChangeText={setEvidenceSummary}
        placeholder="Evidence summary"
        multiline
      />
      <EvidencePicker
        value={evidence}
        onChange={setEvidence}
        help="Attach controlled source records, calculations, photos, or assurance evidence."
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={
          shared.online ? "Save and synchronize" : "Save encrypted offline"
        }
        onPress={() => void save()}
      />
    </Card>
  );
}

function InitiativeDetail({
  initiative,
  canManage,
  onBack,
  ...shared
}: {
  initiative: MobileEsgInitiative;
  canManage: boolean;
  onBack: () => void;
} & Shared) {
  return (
    <Page>
      <Header title={initiative.name} onBack={onBack} />
      <Card>
        <Text style={styles.kicker}>ESG INITIATIVE</Text>
        <Detail label="Pillar" value={humanize(initiative.pillar)} />
        <Detail label="Status" value={humanize(initiative.status)} />
        <Detail label="Owner" value={initiative.owner?.name || null} />
        <Detail label="Description" value={initiative.description} />
        <Detail
          label="Start date"
          value={
            initiative.startDate ? formatDate(initiative.startDate) : null
          }
        />
        <Detail
          label="Target date"
          value={
            initiative.targetDate ? formatDate(initiative.targetDate) : null
          }
        />
        <Detail
          label="Budget"
          value={
            initiative.budget === null
              ? null
              : initiative.budget.toLocaleString()
          }
        />
        <Detail label="Expected outcome" value={initiative.expectedOutcome} />
      </Card>
      {canManage && initiative.nextStatuses.length ? (
        <Card>
          <Text style={styles.cardTitle}>Initiative lifecycle</Text>
          <View style={styles.row}>
            {initiative.nextStatuses.map((status) => (
              <SecondaryButton
                key={status}
                label={humanize(status)}
                onPress={() =>
                  void queueEsgInitiativeStatus(shared.ownerKey, {
                    initiativeId: initiative.id,
                    status,
                  }).then(() => queued(shared, "ESG initiative status"))
                }
              />
            ))}
          </View>
        </Card>
      ) : null}
      {!canManage ? (
        <Text style={styles.muted}>
          Initiative administration is read-only for your role.
        </Text>
      ) : null}
    </Page>
  );
}

function RuntimeFormsAction({
  title,
  forms,
  onSave,
  ...shared
}: {
  title: string;
  forms: RuntimeForm[];
  onSave: (forms: CapturedForm[]) => Promise<unknown>;
} & Shared) {
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [error, setError] = useState("");
  const save = async () => {
    try {
      setError("");
      await onSave(buildCapturedForms(forms, answers));
      await queued(shared, title);
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      {forms.map((form) => (
        <DynamicForm
          key={form.id}
          form={form}
          answers={answers}
          setAnswers={setAnswers}
        />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SecondaryButton label="Save forms" onPress={() => void save()} />
    </Card>
  );
}

function DynamicForm({
  form,
  answers,
  setAnswers,
}: {
  form: RuntimeForm;
  answers: Record<string, FieldValue>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, FieldValue>>>;
}) {
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.detailValue}>{form.name}</Text>
      {form.version.fields.map((field) => {
        const value = answers[field.id];
        const options = Array.isArray(field.options)
          ? field.options.filter(
              (item): item is string => typeof item === "string"
            )
          : [];
        if (field.fieldType === "FILE") {
          return (
            <Text key={field.id} style={styles.help}>
              {field.label}: use private disclosure evidence.
            </Text>
          );
        }
        if (field.fieldType === "BOOLEAN") {
          return (
            <Chip
              key={field.id}
              label={`${field.label}${field.isRequired ? " *" : ""}`}
              active={value === true}
              onPress={() =>
                setAnswers((current) => ({
                  ...current,
                  [field.id]: value !== true,
                }))
              }
            />
          );
        }
        if (
          field.fieldType === "SINGLE_SELECT" ||
          field.fieldType === "MULTI_SELECT"
        ) {
          const selected = Array.isArray(value) ? value : [];
          return (
            <View key={field.id} style={styles.row}>
              {options.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={
                    field.fieldType === "MULTI_SELECT"
                      ? selected.includes(option)
                      : value === option
                  }
                  onPress={() =>
                    setAnswers((current) => ({
                      ...current,
                      [field.id]:
                        field.fieldType === "MULTI_SELECT"
                          ? selected.includes(option)
                            ? selected.filter((item) => item !== option)
                            : [...selected, option]
                          : option,
                    }))
                  }
                />
              ))}
            </View>
          );
        }
        return (
          <Input
            key={field.id}
            value={typeof value === "string" ? value : ""}
            onChangeText={(next) =>
              setAnswers((current) => ({
                ...current,
                [field.id]: next,
              }))
            }
            placeholder={`${field.label}${field.isRequired ? " *" : ""}`}
            multiline={field.fieldType === "LONG_TEXT"}
            keyboardType={
              field.fieldType === "NUMBER" ? "decimal-pad" : "default"
            }
          />
        );
      })}
    </View>
  );
}

function DirectEvidence({
  title,
  help,
  onSave,
  ...shared
}: {
  title: string;
  help: string;
  onSave: (files: SelectedEvidence[]) => Promise<unknown>;
} & Shared) {
  const [files, setFiles] = useState<SelectedEvidence[]>([]);
  const [error, setError] = useState("");
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <EvidencePicker value={files} onChange={setFiles} help={help} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SecondaryButton
        label="Queue private evidence"
        disabled={!files.length}
        onPress={() =>
          void onSave(files)
            .then(() => {
              setFiles([]);
              return queued(shared, title);
            })
            .catch((reason) => setError(messageOf(reason)))
        }
      />
    </Card>
  );
}

function EvidencePicker({
  value,
  onChange,
  help,
}: {
  value: SelectedEvidence[];
  onChange: (value: SelectedEvidence[]) => void;
  help: string;
}) {
  const [error, setError] = useState("");
  const add = async (source: "camera" | "photos" | "files") => {
    try {
      setError("");
      const selected =
        source === "camera"
          ? await capturePhotoEvidence()
          : source === "photos"
            ? await pickPhotoEvidence(
                MAX_EVIDENCE_FILES_PER_RECORD - value.length
              )
            : await pickEvidenceFiles();
      if (value.length + selected.length > MAX_EVIDENCE_FILES_PER_RECORD) {
        throw new Error(
          `Attach no more than ${MAX_EVIDENCE_FILES_PER_RECORD} files.`
        );
      }
      onChange([...value, ...selected]);
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.help}>{help}</Text>
      <View style={styles.row}>
        <SecondaryButton label="Camera" onPress={() => void add("camera")} />
        <SecondaryButton label="Photos" onPress={() => void add("photos")} />
        <SecondaryButton
          label="Documents"
          onPress={() => void add("files")}
        />
      </View>
      {value.map((file) => (
        <Pressable
          key={file.id}
          onPress={() =>
            onChange(value.filter((item) => item.id !== file.id))
          }
        >
          <Text style={styles.meta}>{file.fileName} · tap to remove</Text>
        </Pressable>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function buildCapturedForms(
  forms: RuntimeForm[],
  answers: Record<string, FieldValue>
): CapturedForm[] {
  return forms.map((form) => {
    const captured: CapturedAnswer[] = [];
    for (const field of form.version.fields) {
      if (field.fieldType === "FILE") continue;
      const value = answers[field.id];
      const empty =
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && !value.length);
      if (
        field.isRequired &&
        (empty || (field.fieldType === "BOOLEAN" && value !== true))
      ) {
        throw new Error(`${field.label} is required.`);
      }
      if (empty) continue;
      if (field.fieldType === "NUMBER") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          throw new Error(`${field.label} must be a valid number.`);
        }
        captured.push({ fieldId: field.id, value: numeric });
      } else {
        captured.push({ fieldId: field.id, value });
      }
    }
    return {
      definitionId: form.id,
      versionId: form.version.id,
      answers: captured,
    };
  });
}

async function queued(shared: Shared, label: string) {
  await shared.onQueued(
    shared.online
      ? `${label} queued for secure synchronization.`
      : `${label} encrypted and saved offline.`
  );
  if (shared.online) shared.onSync();
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Field workspace</Text>
      </Pressable>
      <Text style={styles.kicker}>SUSTAINABILITY INTELLIGENCE</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Card({
  children,
  alert = false,
}: {
  children: React.ReactNode;
  alert?: boolean;
}) {
  return <View style={[styles.card, alert && styles.alertCard]}>{children}</View>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#64748b"
      style={[styles.input, props.multiline && styles.multiline]}
    />
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
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.primary}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.secondary, disabled && styles.disabled]}
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
  value: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.detail}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Summary({ items }: { items: Array<[string, number]> }) {
  return (
    <View style={styles.summary}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{value}</Text>
          <Text style={styles.meta}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function messageOf(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "The ESG action could not be saved.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  back: { color: "#67e8f9", fontWeight: "700", marginBottom: 18 },
  kicker: {
    color: "#22d3ee",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 6,
  },
  card: {
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: "#0f1b2d",
    padding: 16,
    gap: 10,
  },
  alertCard: { borderColor: "#f59e0b" },
  cardTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "800" },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8,
  },
  muted: { color: "#94a3b8", lineHeight: 20 },
  meta: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  detail: { borderTopColor: "#1e293b", borderTopWidth: 1, paddingTop: 8 },
  detailValue: { color: "#e2e8f0", lineHeight: 20 },
  metricValue: { color: "#67e8f9", fontSize: 24, fontWeight: "900" },
  alertText: { color: "#fcd34d", fontWeight: "700" },
  error: { color: "#fda4af", lineHeight: 20 },
  help: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: "#07111f",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    color: "#f8fafc",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#164e63", borderColor: "#22d3ee" },
  chipText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#cffafe" },
  primary: {
    backgroundColor: "#67e8f9",
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
  },
  primaryText: { color: "#07111f", fontWeight: "900" },
  secondary: {
    borderColor: "#22d3ee",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  secondaryText: { color: "#a5f3fc", fontWeight: "800", fontSize: 12 },
  disabled: { opacity: 0.4 },
  banner: {
    backgroundColor: "#3f2c09",
    borderColor: "#a16207",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  bannerText: { color: "#fde68a", lineHeight: 19 },
  summary: { flexDirection: "row", gap: 8 },
  summaryItem: {
    flex: 1,
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "#0f1b2d",
    padding: 12,
  },
  summaryValue: { color: "#67e8f9", fontSize: 22, fontWeight: "900" },
  actionPanel: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 9,
  },
});
