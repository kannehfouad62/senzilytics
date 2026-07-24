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
  queueChemicalEvidence,
  queueChemicalForms,
  queueChemicalInventory,
  queueChemicalStatus,
  queueEnvironmentalData,
  queueEnvironmentalEvidence,
  queueEnvironmentalForms,
  queueEnvironmentalReview,
} from "./storage";
import type {
  CapturedAnswer,
  CapturedForm,
  MobileBootstrap,
  MobileChemical,
  MobileEnvironmentalDataPoint,
  MobileEnvironmentalMetric,
  RuntimeForm,
} from "./types";

export type ChemicalEnvironmentalView = "chemicals" | "environmental";
type FieldValue = string | boolean | string[];
type Shared = {
  ownerKey: string;
  online: boolean;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
};

export function ChemicalEnvironmentalScreen({
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
  initialView: ChemicalEnvironmentalView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const capabilities = workspace.chemicalEnvironmentalCapabilities;
  const availableViews = [
    ...(capabilities.canViewChemicals
      ? [{ value: "chemicals" as const, label: "Chemicals & SDS" }]
      : []),
    ...(capabilities.canViewEnvironmental
      ? [{ value: "environmental" as const, label: "Environmental" }]
      : []),
  ];
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [chemicalId, setChemicalId] = useState<string | null>(null);
  const [metricId, setMetricId] = useState<string | null>(null);
  const activeView = availableViews.some((item) => item.value === view)
    ? view
    : availableViews[0]?.value;
  const chemical = workspace.chemicals.find((item) => item.id === chemicalId);
  const metric = workspace.environmentalMetrics.find(
    (item) => item.id === metricId
  );
  const shared = { ownerKey, online, onQueued, onSync };

  if (!activeView) {
    return (
      <Page>
        <Header title="Access restricted" onBack={onBack} />
        <Text style={styles.muted}>
          Your role does not include Chemicals or Environmental access.
        </Text>
      </Page>
    );
  }
  if (chemical) {
    return (
      <ChemicalDetail
        chemical={chemical}
        workspace={workspace}
        canManage={capabilities.canManageChemicals}
        onBack={() => setChemicalId(null)}
        {...shared}
      />
    );
  }
  if (metric) {
    return (
      <EnvironmentalDetail
        metric={metric}
        workspace={workspace}
        canManage={capabilities.canManageEnvironmental}
        onBack={() => setMetricId(null)}
        {...shared}
      />
    );
  }
  const normalized = query.trim().toLowerCase();
  const chemicals = workspace.chemicals.filter(
    (item) =>
      !normalized ||
      `${item.productName} ${item.productCode ?? ""} ${item.casNumber ?? ""} ${item.manufacturer ?? ""}`
        .toLowerCase()
        .includes(normalized)
  );
  const metrics = workspace.environmentalMetrics.filter(
    (item) =>
      !normalized ||
      `${item.name} ${item.code} ${item.type}`.toLowerCase().includes(normalized)
  );

  return (
    <Page>
      <Header title="Chemical & environmental field" onBack={onBack} />
      {availableViews.length > 1 ? (
        <View style={styles.row}>
          {availableViews.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={activeView === item.value}
              onPress={() => {
                setView(item.value);
                setQuery("");
              }}
            />
          ))}
        </View>
      ) : null}
      {!online ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Authorized records and evidence remain encrypted on this device
            until secure synchronization is available.
          </Text>
        </View>
      ) : null}
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={
          activeView === "chemicals"
            ? "Search product, code, CAS, or manufacturer"
            : "Search metric, code, or category"
        }
      />
      {activeView === "chemicals" ? (
        <>
          <Summary
            items={[
              ["Products", chemicals.length],
              [
                "SDS overdue",
                chemicals.filter((item) => item.sdsReviewOverdue).length,
              ],
              [
                "Limits exceeded",
                chemicals.reduce(
                  (count, item) =>
                    count +
                    item.inventories.filter(
                      (inventory) => inventory.limitExceeded
                    ).length,
                  0
                ),
              ],
            ]}
          />
          {chemicals.map((item) => (
            <Pressable key={item.id} onPress={() => setChemicalId(item.id)}>
              <Card alert={item.sdsReviewOverdue}>
                <Text style={styles.cardTitle}>{item.productName}</Text>
                <Text style={styles.muted}>
                  {item.productCode || item.casNumber || "No product code"} ·{" "}
                  {humanize(item.status)}
                </Text>
                <Text style={styles.meta}>
                  {item.signalWord} · {item.inventories.length} inventory
                  location(s)
                </Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <Summary
            items={[
              ["Metrics", metrics.length],
              [
                "Draft data",
                metrics.reduce(
                  (count, item) =>
                    count +
                    item.dataPoints.filter((point) => point.status === "DRAFT")
                      .length,
                  0
                ),
              ],
              ["Targets", workspace.environmentalTargets.length],
            ]}
          />
          {metrics.map((item) => (
            <Pressable key={item.id} onPress={() => setMetricId(item.id)}>
              <Card>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.muted}>
                  {item.code} · {humanize(item.type)}
                </Text>
                <Text style={styles.meta}>
                  {humanize(item.reportingFrequency)} · {item.dataPoints.length}{" "}
                  recent record(s)
                </Text>
              </Card>
            </Pressable>
          ))}
        </>
      )}
      {!chemicals.length && activeView === "chemicals" ? (
        <Text style={styles.muted}>No authorized chemical matches this search.</Text>
      ) : null}
      {!metrics.length && activeView === "environmental" ? (
        <Text style={styles.muted}>No authorized metric matches this search.</Text>
      ) : null}
    </Page>
  );
}

function ChemicalDetail({
  chemical,
  workspace,
  canManage,
  onBack,
  ...shared
}: {
  chemical: MobileChemical;
  workspace: MobileBootstrap;
  canManage: boolean;
  onBack: () => void;
} & Shared) {
  const forms = workspace.chemicalForms.filter((form) =>
    chemical.missingFormDefinitionIds.includes(form.id)
  );
  return (
    <Page>
      <Header title={chemical.productName} onBack={onBack} />
      <Card alert={chemical.sdsReviewOverdue}>
        <Text style={styles.kicker}>HAZARD & SDS PROFILE</Text>
        <Detail label="Status" value={humanize(chemical.status)} />
        <Detail label="Signal word" value={chemical.signalWord} />
        <Detail label="CAS number" value={chemical.casNumber} />
        <Detail label="Manufacturer" value={chemical.manufacturer} />
        <Detail label="Hazards" value={chemical.hazardClassifications} />
        <Detail label="Exposure limits" value={chemical.exposureLimits} />
        <Detail label="Required PPE" value={chemical.requiredPpe} />
        <Detail label="First aid" value={chemical.firstAidMeasures} />
        <Detail label="Spill response" value={chemical.spillResponse} />
        <Detail label="Storage" value={chemical.storageRequirements} />
        <Detail label="Incompatibilities" value={chemical.incompatibilities} />
        <Detail
          label="SDS review due"
          value={
            chemical.sdsReviewDueDate
              ? formatDate(chemical.sdsReviewDueDate)
              : null
          }
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Site inventory</Text>
        {chemical.inventories.map((inventory) => (
          <View key={inventory.id} style={styles.record}>
            <Text style={styles.detailValue}>
              {inventory.site.name} · {inventory.storageLocation}
            </Text>
            <Text
              style={inventory.limitExceeded ? styles.alertText : styles.meta}
            >
              {inventory.quantity} {inventory.unit}
              {inventory.maximumAllowed !== null
                ? ` / maximum ${inventory.maximumAllowed}`
                : ""}
            </Text>
          </View>
        ))}
        {!chemical.inventories.length ? (
          <Text style={styles.muted}>No inventory counts recorded.</Text>
        ) : null}
      </Card>
      {canManage ? (
        <>
          <ChemicalInventoryForm chemical={chemical} workspace={workspace} {...shared} />
          {chemical.nextStatuses.length ? (
            <ChemicalStatusForm chemical={chemical} {...shared} />
          ) : null}
          {forms.length ? (
            <RuntimeFormsAction
              title="Required chemical forms"
              forms={forms}
              onSave={(customForms) =>
                queueChemicalForms(shared.ownerKey, {
                  chemicalId: chemical.id,
                  customForms,
                })
              }
              {...shared}
            />
          ) : null}
          <DirectEvidence
            title="SDS and chemical evidence"
            help="Attach the current SDS, approved specification, label, or storage photo."
            onSave={(files) =>
              queueChemicalEvidence(
                shared.ownerKey,
                chemical.id,
                files,
                `Chemical evidence: ${chemical.productName}`,
                chemical.hazardClassifications || undefined
              )
            }
            {...shared}
          />
        </>
      ) : (
        <Text style={styles.muted}>
          This is a read-only hazard and SDS view for your role.
        </Text>
      )}
    </Page>
  );
}

function ChemicalInventoryForm({
  chemical,
  workspace,
  ...shared
}: { chemical: MobileChemical; workspace: MobileBootstrap } & Shared) {
  const [siteId, setSiteId] = useState(workspace.sites[0]?.id || "");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [maximum, setMaximum] = useState("");
  const [container, setContainer] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    try {
      setError("");
      const parsedQuantity = Number(quantity);
      const parsedMaximum = maximum ? Number(maximum) : undefined;
      if (
        !siteId ||
        location.trim().length < 1 ||
        unit.trim().length < 1 ||
        !Number.isFinite(parsedQuantity) ||
        parsedQuantity < 0 ||
        (parsedMaximum !== undefined &&
          (!Number.isFinite(parsedMaximum) || parsedMaximum < 0))
      ) {
        throw new Error(
          "Select a site and enter a valid location, quantity, and unit."
        );
      }
      await queueChemicalInventory(shared.ownerKey, {
        chemicalId: chemical.id,
        siteId,
        storageLocation: location.trim(),
        quantity: parsedQuantity,
        unit: unit.trim(),
        maximumAllowed: parsedMaximum,
        containerType: container.trim() || undefined,
        storageNotes: notes.trim() || undefined,
      });
      await queued(shared, "Chemical inventory count");
      setQuantity("");
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Record inventory count</Text>
      <View style={styles.row}>
        {workspace.sites.map((site) => (
          <Chip
            key={site.id}
            label={site.name}
            active={siteId === site.id}
            onPress={() => setSiteId(site.id)}
          />
        ))}
      </View>
      <Input value={location} onChangeText={setLocation} placeholder="Storage location *" />
      <Input value={quantity} onChangeText={setQuantity} placeholder="Quantity *" keyboardType="decimal-pad" />
      <Input value={unit} onChangeText={setUnit} placeholder="Unit * (L, kg, containers)" />
      <Input value={maximum} onChangeText={setMaximum} placeholder="Maximum allowed (optional)" keyboardType="decimal-pad" />
      <Input value={container} onChangeText={setContainer} placeholder="Container type" />
      <Input value={notes} onChangeText={setNotes} placeholder="Storage notes" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={shared.online ? "Save and synchronize" : "Save encrypted offline"}
        onPress={() => void save()}
      />
    </Card>
  );
}

function ChemicalStatusForm({
  chemical,
  ...shared
}: { chemical: MobileChemical } & Shared) {
  const [status, setStatus] = useState(chemical.nextStatuses[0]);
  const save = async () => {
    await queueChemicalStatus(shared.ownerKey, {
      chemicalId: chemical.id,
      status,
    });
    await queued(shared, "Chemical approval status");
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Governed approval lifecycle</Text>
      <View style={styles.row}>
        {chemical.nextStatuses.map((value) => (
          <Chip
            key={value}
            label={humanize(value)}
            active={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>
      <PrimaryButton label={`Apply ${humanize(status)}`} onPress={() => void save()} />
    </Card>
  );
}

function EnvironmentalDetail({
  metric,
  workspace,
  canManage,
  onBack,
  ...shared
}: {
  metric: MobileEnvironmentalMetric;
  workspace: MobileBootstrap;
  canManage: boolean;
  onBack: () => void;
} & Shared) {
  const targets = workspace.environmentalTargets.filter(
    (target) => target.metricId === metric.id
  );
  return (
    <Page>
      <Header title={metric.name} onBack={onBack} />
      <Card>
        <Text style={styles.kicker}>{metric.code} · {humanize(metric.type)}</Text>
        <Detail label="Source unit" value={metric.sourceUnit} />
        <Detail label="Reporting unit" value={metric.reportingUnit} />
        <Detail label="Frequency" value={humanize(metric.reportingFrequency)} />
        <Detail label="Methodology" value={metric.methodology} />
      </Card>
      {targets.length ? (
        <Card>
          <Text style={styles.cardTitle}>Active targets</Text>
          {targets.map((target) => (
            <View key={target.id} style={styles.record}>
              <Text style={styles.detailValue}>{target.name}</Text>
              <Text style={styles.meta}>
                {target.baselineYear}: {target.baselineValue} →{" "}
                {target.targetYear}: {target.targetValue}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      {canManage ? (
        <EnvironmentalDataForm metric={metric} workspace={workspace} {...shared} />
      ) : null}
      <Text style={styles.sectionTitle}>Recent records</Text>
      {metric.dataPoints.map((point) => (
        <EnvironmentalPoint
          key={point.id}
          point={point}
          forms={workspace.environmentalForms.filter((form) =>
            point.missingFormDefinitionIds.includes(form.id)
          )}
          canManage={canManage}
          {...shared}
        />
      ))}
      {!metric.dataPoints.length ? (
        <Text style={styles.muted}>No recent environmental data.</Text>
      ) : null}
    </Page>
  );
}

function EnvironmentalDataForm({
  metric,
  workspace,
  ...shared
}: { metric: MobileEnvironmentalMetric; workspace: MobileBootstrap } & Shared) {
  const [siteId, setSiteId] = useState(workspace.sites[0]?.id || "");
  const [value, setValue] = useState("");
  const [quality, setQuality] =
    useState<"MEASURED" | "CALCULATED" | "ESTIMATED" | "SUPPLIER_PROVIDED">(
      "MEASURED"
    );
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [error, setError] = useState("");
  const save = async () => {
    try {
      setError("");
      const numericValue = Number(value);
      if (
        !siteId ||
        !Number.isFinite(numericValue) ||
        !validDate(periodStart) ||
        !validDate(periodEnd) ||
        periodEnd < periodStart
      ) {
        throw new Error("Enter a site, finite value, and valid reporting period.");
      }
      await queueEnvironmentalData(
        shared.ownerKey,
        {
          metricId: metric.id,
          siteId,
          value: numericValue,
          quality,
          periodStart,
          periodEnd,
          evidenceSummary: evidenceSummary.trim() || undefined,
          notes: notes.trim() || undefined,
          customForms: buildCapturedForms(
            workspace.environmentalForms,
            answers
          ),
        },
        evidence
      );
      await queued(shared, "Environmental data");
      setValue("");
      setEvidence([]);
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Capture environmental data</Text>
      <View style={styles.row}>
        {workspace.sites.map((site) => (
          <Chip key={site.id} label={site.name} active={siteId === site.id} onPress={() => setSiteId(site.id)} />
        ))}
      </View>
      <Input value={value} onChangeText={setValue} placeholder={`Value in ${metric.sourceUnit} *`} keyboardType="decimal-pad" />
      <View style={styles.row}>
        {(["MEASURED", "CALCULATED", "ESTIMATED", "SUPPLIER_PROVIDED"] as const).map((item) => (
          <Chip key={item} label={humanize(item)} active={quality === item} onPress={() => setQuality(item)} />
        ))}
      </View>
      <Input value={periodStart} onChangeText={setPeriodStart} placeholder="Period start YYYY-MM-DD *" />
      <Input value={periodEnd} onChangeText={setPeriodEnd} placeholder="Period end YYYY-MM-DD *" />
      <Input value={evidenceSummary} onChangeText={setEvidenceSummary} placeholder="Evidence summary" multiline />
      <Input value={notes} onChangeText={setNotes} placeholder="Data notes" multiline />
      {workspace.environmentalForms.map((form) => (
        <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />
      ))}
      <EvidencePicker value={evidence} onChange={setEvidence} help="Attach meter readings, invoices, manifests, laboratory reports, or field photos." />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={shared.online ? "Save and synchronize" : "Save encrypted offline"}
        onPress={() => void save()}
      />
    </Card>
  );
}

function EnvironmentalPoint({
  point,
  forms,
  canManage,
  ...shared
}: {
  point: MobileEnvironmentalDataPoint;
  forms: RuntimeForm[];
  canManage: boolean;
} & Shared) {
  return (
    <Card alert={point.status === "REJECTED"}>
      <Text style={styles.cardTitle}>
        {point.value} · {humanize(point.quality)}
      </Text>
      <Text style={styles.muted}>
        {point.site.name} · {formatDate(point.periodStart)}–{formatDate(point.periodEnd)}
      </Text>
      <Text style={styles.meta}>
        {humanize(point.status)} · entered by {point.enteredBy.name}
      </Text>
      {point.evidenceSummary ? <Text style={styles.detailValue}>{point.evidenceSummary}</Text> : null}
      {canManage && point.status === "DRAFT" ? (
        <View style={styles.row}>
          {(["APPROVED", "REJECTED"] as const).map((status) => (
            <SecondaryButton
              key={status}
              label={humanize(status)}
              onPress={() =>
                void queueEnvironmentalReview(shared.ownerKey, {
                  dataPointId: point.id,
                  status,
                }).then(() => queued(shared, "Environmental review"))
              }
            />
          ))}
        </View>
      ) : null}
      {canManage && forms.length ? (
        <RuntimeFormsAction
          title="Complete required forms"
          forms={forms}
          onSave={(customForms) =>
            queueEnvironmentalForms(shared.ownerKey, {
              dataPointId: point.id,
              customForms,
            })
          }
          {...shared}
        />
      ) : null}
      {canManage ? (
        <DirectEvidence
          title="Additional evidence"
          help="Attach supporting environmental evidence to this record."
          onSave={(files) =>
            queueEnvironmentalEvidence(
              shared.ownerKey,
              point.id,
              files,
              "Environmental data evidence",
              point.evidenceSummary || undefined
            )
          }
          compact
          {...shared}
        />
      ) : null}
    </Card>
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
    <View style={styles.actionPanel}>
      <Text style={styles.cardTitle}>{title}</Text>
      {forms.map((form) => (
        <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SecondaryButton label="Save forms" onPress={() => void save()} />
    </View>
  );
}

function DirectEvidence({
  title,
  help,
  onSave,
  compact = false,
  ...shared
}: {
  title: string;
  help: string;
  onSave: (files: SelectedEvidence[]) => Promise<unknown>;
  compact?: boolean;
} & Shared) {
  const [files, setFiles] = useState<SelectedEvidence[]>([]);
  const [error, setError] = useState("");
  const body = (
    <>
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
    </>
  );
  return compact ? <View style={styles.actionPanel}>{body}</View> : <Card>{body}</Card>;
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
            ? await pickPhotoEvidence(MAX_EVIDENCE_FILES_PER_RECORD - value.length)
            : await pickEvidenceFiles();
      if (value.length + selected.length > MAX_EVIDENCE_FILES_PER_RECORD) {
        throw new Error(`Attach no more than ${MAX_EVIDENCE_FILES_PER_RECORD} files.`);
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
        <SecondaryButton label="Documents" onPress={() => void add("files")} />
      </View>
      {value.map((file) => (
        <Pressable key={file.id} onPress={() => onChange(value.filter((item) => item.id !== file.id))}>
          <Text style={styles.meta}>{file.fileName} · tap to remove</Text>
        </Pressable>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
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
          ? field.options.filter((item): item is string => typeof item === "string")
          : [];
        if (field.fieldType === "FILE") {
          return <Text key={field.id} style={styles.help}>{field.label}: use private evidence above.</Text>;
        }
        if (field.fieldType === "BOOLEAN") {
          return (
            <Chip
              key={field.id}
              label={`${field.label}${field.isRequired ? " *" : ""}`}
              active={value === true}
              onPress={() => setAnswers((current) => ({ ...current, [field.id]: value !== true }))}
            />
          );
        }
        if (field.fieldType === "SINGLE_SELECT" || field.fieldType === "MULTI_SELECT") {
          const selected = Array.isArray(value) ? value : [];
          return (
            <View key={field.id} style={styles.row}>
              {options.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={field.fieldType === "MULTI_SELECT" ? selected.includes(option) : value === option}
                  onPress={() => setAnswers((current) => ({
                    ...current,
                    [field.id]: field.fieldType === "MULTI_SELECT"
                      ? selected.includes(option)
                        ? selected.filter((item) => item !== option)
                        : [...selected, option]
                      : option,
                  }))}
                />
              ))}
            </View>
          );
        }
        return (
          <Input
            key={field.id}
            value={typeof value === "string" ? value : ""}
            onChangeText={(next) => setAnswers((current) => ({ ...current, [field.id]: next }))}
            placeholder={`${field.label}${field.isRequired ? " *" : ""}`}
            multiline={field.fieldType === "LONG_TEXT"}
            keyboardType={field.fieldType === "NUMBER" ? "decimal-pad" : "default"}
          />
        );
      })}
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View>
      <Pressable onPress={onBack}><Text style={styles.back}>← Field workspace</Text></Pressable>
      <Text style={styles.kicker}>GOVERNED FIELD DATA</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Card({ children, alert = false }: { children: React.ReactNode; alert?: boolean }) {
  return <View style={[styles.card, alert && styles.alertCard]}>{children}</View>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} placeholderTextColor="#64748b" style={[styles.input, props.multiline && styles.multiline]} />;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.primary, disabled && styles.disabled]}><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.secondary, disabled && styles.disabled]}><Text style={styles.secondaryText}>{label}</Text></Pressable>;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <View style={styles.detail}><Text style={styles.meta}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function Summary({ items }: { items: Array<[string, number]> }) {
  return <View style={styles.summary}>{items.map(([label, value]) => <View key={label} style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.meta}>{label}</Text></View>)}</View>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime());
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : "The action could not be saved.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  back: { color: "#67e8f9", fontWeight: "700", marginBottom: 18 },
  kicker: { color: "#22d3ee", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "800", marginTop: 6 },
  card: { borderColor: "#1e293b", borderWidth: 1, borderRadius: 18, backgroundColor: "#0f1b2d", padding: 16, gap: 10 },
  alertCard: { borderColor: "#fb7185" },
  cardTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "800" },
  sectionTitle: { color: "#e2e8f0", fontSize: 18, fontWeight: "800", marginTop: 8 },
  muted: { color: "#94a3b8", lineHeight: 20 },
  meta: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  detail: { borderTopColor: "#1e293b", borderTopWidth: 1, paddingTop: 8 },
  detailValue: { color: "#e2e8f0", lineHeight: 20 },
  record: { borderTopColor: "#1e293b", borderTopWidth: 1, paddingTop: 10, gap: 3 },
  alertText: { color: "#fda4af", fontWeight: "700" },
  error: { color: "#fda4af", lineHeight: 20 },
  help: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  input: { backgroundColor: "#07111f", borderColor: "#334155", borderWidth: 1, borderRadius: 12, color: "#f8fafc", minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderColor: "#334155", borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: "#164e63", borderColor: "#22d3ee" },
  chipText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#cffafe" },
  primary: { backgroundColor: "#67e8f9", borderRadius: 12, padding: 13, alignItems: "center" },
  primaryText: { color: "#07111f", fontWeight: "900" },
  secondary: { borderColor: "#22d3ee", borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  secondaryText: { color: "#a5f3fc", fontWeight: "800", fontSize: 12 },
  disabled: { opacity: 0.4 },
  banner: { backgroundColor: "#3f2c09", borderColor: "#a16207", borderWidth: 1, borderRadius: 14, padding: 12 },
  bannerText: { color: "#fde68a", lineHeight: 19 },
  summary: { flexDirection: "row", gap: 8 },
  summaryItem: { flex: 1, borderColor: "#1e293b", borderWidth: 1, borderRadius: 14, backgroundColor: "#0f1b2d", padding: 12 },
  summaryValue: { color: "#67e8f9", fontSize: 22, fontWeight: "900" },
  actionPanel: { borderColor: "#334155", borderWidth: 1, borderRadius: 14, padding: 12, gap: 9 },
});
