import { useState, type ComponentProps, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  MAX_EVIDENCE_FILES_PER_RECORD,
  pickEvidenceFiles,
  pickPhotoEvidence,
  type SelectedEvidence,
} from "./evidence";
import {
  queueRegulatoryAssessmentReview,
  queueRegulatoryChangeClose,
  queueRegulatoryChangeReview,
  queueRegulatoryImpactAssessment,
  queueRegulatoryImplementation,
  queueRegulatorySourceReview,
} from "./storage";
import type {
  MobileBootstrap,
  MobileRegulatoryChange,
  MobileRegulatorySource,
  RegulatoryImpactAssessmentPayload,
} from "./types";

type Props = {
  workspace: MobileBootstrap;
  ownerKey: string;
  online: boolean;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
};

export function RegulatoryIntelligenceScreen(props: Props) {
  const [view, setView] = useState<"sources" | "changes">("changes");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [changeId, setChangeId] = useState<string | null>(null);
  const source = props.workspace.regulatorySources?.find(
    (item) => item.id === sourceId
  );
  const change = props.workspace.regulatoryChanges?.find(
    (item) => item.id === changeId
  );
  if (source) {
    return (
      <SourceDetail
        {...props}
        source={source}
        onBack={() => setSourceId(null)}
      />
    );
  }
  if (change) {
    return (
      <ChangeDetail
        {...props}
        change={change}
        onBack={() => setChangeId(null)}
      />
    );
  }
  const metrics = props.workspace.regulatoryMetrics;
  return (
    <Page>
      <Header title="Regulatory intelligence" onBack={props.onBack} />
      <Text style={styles.caption}>
        Official-source monitoring, human applicability decisions, implementation
        governance, and legal-register traceability.
      </Text>
      <Banner
        text={
          props.online
            ? "Senzilytics supports review governance. Your organization remains responsible for authoritative legal interpretation."
            : "Offline mode: authorized reviews remain encrypted on this device and synchronize idempotently."
        }
      />
      {metrics ? (
        <View style={styles.metrics}>
          <Metric label="Active sources" value={metrics.activeSources} />
          <Metric label="Open changes" value={metrics.openChanges} />
          <Metric label="Assessments overdue" value={metrics.assessmentsOverdue} />
          <Metric label="Open actions" value={metrics.implementationActionsOpen} />
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip
          label="Regulatory changes"
          active={view === "changes"}
          onPress={() => setView("changes")}
        />
        <Chip
          label="Legal sources"
          active={view === "sources"}
          onPress={() => setView("sources")}
        />
      </View>
      {view === "changes" ? (
        <ChangeList
          changes={props.workspace.regulatoryChanges ?? []}
          onOpen={setChangeId}
        />
      ) : (
        <SourceList
          sources={props.workspace.regulatorySources ?? []}
          onOpen={setSourceId}
        />
      )}
    </Page>
  );
}

function ChangeList({
  changes,
  onOpen,
}: {
  changes: MobileRegulatoryChange[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = changes.filter(
    (item) =>
      !normalized ||
      `${item.reference} ${item.title} ${item.source.name} ${item.status}`
        .toLowerCase()
        .includes(normalized)
  );
  return (
    <>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search changes, references, or sources"
      />
      {filtered.map((item) => (
        <Pressable key={item.id} onPress={() => onOpen(item.id)}>
          <Card accent={item.isAssessmentOverdue || item.significance === "CRITICAL"}>
            <View style={styles.between}>
              <Text style={styles.reference}>{item.reference}</Text>
              <Badge text={humanize(item.status)} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.caption}>
              {item.source.authority} · {item.source.jurisdiction}
            </Text>
            <Text style={styles.meta}>
              {humanize(item.significance)} significance · Assessment due{" "}
              {formatDate(item.assessmentDueAt)}
            </Text>
            {item.isAssessmentOverdue ? (
              <Text style={styles.alert}>Impact assessment overdue</Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
      {!filtered.length ? <Empty text="No regulatory changes match this view." /> : null}
    </>
  );
}

function SourceList({
  sources,
  onOpen,
}: {
  sources: MobileRegulatorySource[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = sources.filter(
    (item) =>
      !normalized ||
      `${item.code} ${item.name} ${item.authority} ${item.jurisdiction}`
        .toLowerCase()
        .includes(normalized)
  );
  return (
    <>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search legal sources or authorities"
      />
      {filtered.map((item) => (
        <Pressable key={item.id} onPress={() => onOpen(item.id)}>
          <Card accent={item.isReviewOverdue}>
            <View style={styles.between}>
              <Text style={styles.reference}>{item.code}</Text>
              <Badge text={humanize(item.status)} />
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.caption}>
              {item.authority} · {item.jurisdiction}
            </Text>
            <Text style={styles.meta}>
              {item.changeCount} changes · {item.obligationCount} obligations ·
              Next review {formatDate(item.nextReviewAt)}
            </Text>
            {item.isReviewOverdue ? (
              <Text style={styles.alert}>Source review overdue</Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
      {!filtered.length ? <Empty text="No regulatory sources match this view." /> : null}
    </>
  );
}

function SourceDetail({
  source,
  ownerKey,
  online,
  onBack,
  onQueued,
  onSync,
}: Props & { source: MobileRegulatorySource }) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (notes.trim().length < 2) {
      setError("Record what was reviewed and whether the source changed.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await queueRegulatorySourceReview(ownerKey, {
        sourceId: source.id,
        notes: notes.trim(),
      });
      setNotes("");
      await onQueued("Source review saved securely.");
      if (online) onSync();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page>
      <Header title={source.code} onBack={onBack} />
      <Card accent={source.isReviewOverdue}>
        <Badge text={humanize(source.status)} />
        <Text style={styles.title}>{source.name}</Text>
        <Text style={styles.caption}>{source.description || "No description recorded."}</Text>
        <Fact label="Authority" value={source.authority} />
        <Fact label="Jurisdiction" value={source.jurisdiction} />
        <Fact label="Owner" value={source.owner.name} />
        <Fact label="Review cadence" value={`${source.reviewCadenceDays} days`} />
        <Fact label="Next review" value={formatDate(source.nextReviewAt)} />
        <Button label="Open official source" onPress={() => void Linking.openURL(source.sourceUrl)} />
      </Card>
      {source.canReview ? (
        <Card>
          <Text style={styles.cardTitle}>Record source review</Text>
          <Text style={styles.caption}>
            Verify the official publication and document the result. This does
            not replace qualified legal review.
          </Text>
          <Label text="Review notes *" />
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Source checked, changes identified, and follow-up needed"
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={saving ? "Saving securely…" : "Save source review"}
            disabled={saving}
            onPress={() => void save()}
          />
        </Card>
      ) : null}
    </Page>
  );
}

function ChangeDetail(props: Props & { change: MobileRegulatoryChange }) {
  const { change, onBack } = props;
  const assessment = change.latestAssessment;
  return (
    <Page>
      <Header title={change.reference} onBack={onBack} />
      <Card accent={change.isAssessmentOverdue}>
        <View style={styles.between}>
          <Badge text={humanize(change.status)} />
          <Badge text={`${humanize(change.significance)} significance`} />
        </View>
        <Text style={styles.title}>{change.title}</Text>
        <Text style={styles.caption}>{change.summary}</Text>
        <Fact label="Source" value={`${change.source.code} · ${change.source.name}`} />
        <Fact label="Authority" value={change.source.authority} />
        <Fact label="Owner" value={change.owner.name} />
        <Fact label="Published" value={formatDate(change.publishedAt)} />
        <Fact label="Effective" value={formatDate(change.effectiveAt)} />
        <Fact label="Assessment due" value={formatDate(change.assessmentDueAt)} />
        {change.citation ? <Fact label="Citation" value={change.citation} /> : null}
        <Button label="Open official publication" onPress={() => void Linking.openURL(change.sourceUrl)} />
      </Card>
      {assessment ? (
        <Card>
          <Text style={styles.cardTitle}>Latest impact assessment</Text>
          <Fact label="Status" value={humanize(assessment.status)} />
          <Fact label="Decision" value={humanize(assessment.decision)} />
          <Fact label="Rationale" value={assessment.applicabilityRationale} />
          {assessment.impactSummary ? <Fact label="Impact" value={assessment.impactSummary} /> : null}
          {assessment.gapSummary ? <Fact label="Gaps" value={assessment.gapSummary} /> : null}
          {assessment.requiredActions ? <Fact label="Required actions" value={assessment.requiredActions} /> : null}
          {assessment.reviewNotes ? <Fact label="Review notes" value={assessment.reviewNotes} /> : null}
        </Card>
      ) : null}
      <Card>
        <Text style={styles.cardTitle}>Traceability</Text>
        <Fact label="Linked obligations" value={String(change.obligationCount)} />
        <Fact label="Linked corrective actions" value={String(change.actions.length)} />
        {change.actions.map((action) => (
          <View key={action.id} style={styles.action}>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.meta}>
              {humanize(action.status)} · {humanize(action.riskLevel)} · Due{" "}
              {formatDate(action.dueDate)}
            </Text>
          </View>
        ))}
      </Card>
      {props.workspace.regulatoryCapabilities.canManage ? (
        <LifecycleAction {...props} />
      ) : (
        <Banner text="Your role has read-only regulatory intelligence access." />
      )}
    </Page>
  );
}

function LifecycleAction(props: Props & { change: MobileRegulatoryChange }) {
  const { change } = props;
  if (change.canStartReview) return <StartReview {...props} />;
  if (change.canSubmitAssessment) return <ImpactAssessment {...props} />;
  if (change.canReviewAssessment && change.latestAssessment) {
    return <AssessmentReview {...props} assessmentId={change.latestAssessment.id} />;
  }
  if (change.canImplement) return <Implementation {...props} />;
  if (change.canClose) return <CloseChange {...props} />;
  return (
    <Banner text="No lifecycle action is currently available. Complete the preceding governed step or resolve linked obligations and corrective actions." />
  );
}

function StartReview(props: Props & { change: MobileRegulatoryChange }) {
  const [note, setNote] = useState("");
  return (
    <ActionForm
      title="Start formal review"
      label="Review note *"
      value={note}
      onChange={setNote}
      placeholder="Scope, reviewer, and immediate review focus"
      button="Start review"
      validate={() => note.trim().length >= 2 ? "" : "Record the review scope."}
      save={() =>
        queueRegulatoryChangeReview(props.ownerKey, {
          changeId: props.change.id,
          note: note.trim(),
        })
      }
      {...props}
    />
  );
}

function ImpactAssessment(props: Props & { change: MobileRegulatoryChange }) {
  const [decision, setDecision] =
    useState<RegulatoryImpactAssessmentPayload["decision"]>("APPLICABLE");
  const [rationale, setRationale] = useState("");
  const [impact, setImpact] = useState("");
  const [gaps, setGaps] = useState("");
  const [actions, setActions] = useState("");
  const [due, setDue] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (rationale.trim().length < 2) return setError("Record the applicability rationale.");
    const implementationDueAt = /^\d{4}-\d{2}-\d{2}$/.test(due)
      ? new Date(`${due}T12:00:00.000Z`)
      : null;
    if (
      decision === "APPLICABLE" &&
      (
        !impact.trim() ||
        !actions.trim() ||
        !implementationDueAt ||
        Number.isNaN(implementationDueAt.getTime()) ||
        implementationDueAt <= new Date()
      )
    ) {
      return setError("Applicable changes require impact, actions, and a future YYYY-MM-DD implementation due date.");
    }
    setSaving(true);
    setError("");
    try {
      await queueRegulatoryImpactAssessment(
        props.ownerKey,
        {
          changeId: props.change.id,
          decision,
          applicabilityRationale: rationale.trim(),
          impactSummary: impact.trim() || undefined,
          gapSummary: gaps.trim() || undefined,
          requiredActions: actions.trim() || undefined,
          implementationDueAt:
            decision === "APPLICABLE" && implementationDueAt
              ? implementationDueAt.toISOString()
              : undefined,
        },
        evidence
      );
      await props.onQueued("Impact assessment saved securely for governed synchronization.");
      if (props.online) props.onSync();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Document impact assessment</Text>
      <Text style={styles.caption}>
        A qualified human reviewer must determine applicability and approve the
        assessment before implementation.
      </Text>
      <View style={styles.chips}>
        <Chip label="Applicable" active={decision === "APPLICABLE"} onPress={() => setDecision("APPLICABLE")} />
        <Chip label="Not applicable" active={decision === "NOT_APPLICABLE"} onPress={() => setDecision("NOT_APPLICABLE")} />
      </View>
      <Label text="Applicability rationale *" />
      <Input value={rationale} onChangeText={setRationale} multiline placeholder="Legal, operational, site, and activity basis" />
      {decision === "APPLICABLE" ? (
        <>
          <Label text="Business and EHS impact *" />
          <Input value={impact} onChangeText={setImpact} multiline placeholder="What changes for the organization?" />
          <Label text="Gap summary" />
          <Input value={gaps} onChangeText={setGaps} multiline placeholder="Current-state gaps" />
          <Label text="Required actions *" />
          <Input value={actions} onChangeText={setActions} multiline placeholder="Implementation actions and accountable functions" />
          <Label text="Implementation due date *" />
          <Input value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" />
        </>
      ) : null}
      <EvidencePicker value={evidence} onChange={setEvidence} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={saving ? "Saving securely…" : "Submit for approval"} disabled={saving} onPress={() => void save()} />
    </Card>
  );
}

function AssessmentReview(
  props: Props & { change: MobileRegulatoryChange; assessmentId: string }
) {
  const [approved, setApproved] = useState(true);
  const [notes, setNotes] = useState("");
  return (
    <Card>
      <Text style={styles.cardTitle}>Human approval decision</Text>
      <View style={styles.chips}>
        <Chip label="Approve" active={approved} onPress={() => setApproved(true)} />
        <Chip label="Reject" active={!approved} onPress={() => setApproved(false)} />
      </View>
      <ActionFormBody
        label="Review notes *"
        value={notes}
        onChange={setNotes}
        placeholder="Decision basis and required revisions"
        button={approved ? "Approve assessment" : "Reject assessment"}
        validate={() => notes.trim().length >= 2 ? "" : "Record the decision basis."}
        save={() =>
          queueRegulatoryAssessmentReview(props.ownerKey, {
            assessmentId: props.assessmentId,
            approved,
            reviewNotes: notes.trim(),
          })
        }
        {...props}
      />
    </Card>
  );
}

function Implementation(props: Props & { change: MobileRegulatoryChange }) {
  const [summary, setSummary] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  return (
    <Card>
      <Text style={styles.cardTitle}>Confirm implementation</Text>
      <Text style={styles.caption}>
        Closure is blocked until the change has a linked legal obligation and
        all linked corrective actions are closed.
      </Text>
      <ActionFormBody
        label="Implementation summary *"
        value={summary}
        onChange={setSummary}
        placeholder="Controls, documents, training, systems, and verification completed"
        button="Mark implemented"
        validate={() => summary.trim().length >= 2 ? "" : "Record the implementation evidence summary."}
        save={() =>
          queueRegulatoryImplementation(
            props.ownerKey,
            { changeId: props.change.id, implementationSummary: summary.trim() },
            evidence
          )
        }
        beforeButton={<EvidencePicker value={evidence} onChange={setEvidence} />}
        {...props}
      />
    </Card>
  );
}

function CloseChange(props: Props & { change: MobileRegulatoryChange }) {
  const [rationale, setRationale] = useState("");
  return (
    <ActionForm
      title="Close governed change"
      label="Closure rationale *"
      value={rationale}
      onChange={setRationale}
      placeholder="Why the change can be closed and where evidence is retained"
      button="Close change"
      validate={() => rationale.trim().length >= 2 ? "" : "Record the closure rationale."}
      save={() =>
        queueRegulatoryChangeClose(props.ownerKey, {
          changeId: props.change.id,
          rationale: rationale.trim(),
        })
      }
      {...props}
    />
  );
}

function ActionForm(
  props: Props & {
    title: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    button: string;
    validate: () => string;
    save: () => Promise<unknown>;
  }
) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{props.title}</Text>
      <ActionFormBody {...props} />
    </Card>
  );
}

function ActionFormBody({
  label,
  value,
  onChange,
  placeholder,
  button,
  validate,
  save,
  beforeButton,
  online,
  onQueued,
  onSync,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  button: string;
  validate: () => string;
  save: () => Promise<unknown>;
  beforeButton?: ReactNode;
  online: boolean;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const invalid = validate();
    if (invalid) return setError(invalid);
    setSaving(true);
    setError("");
    try {
      await save();
      await onQueued(`${button} saved securely.`);
      if (online) onSync();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Label text={label} />
      <Input value={value} onChangeText={onChange} placeholder={placeholder} multiline />
      {beforeButton}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={saving ? "Saving securely…" : button} disabled={saving} onPress={() => void submit()} />
    </>
  );
}

function EvidencePicker({
  value,
  onChange,
}: {
  value: SelectedEvidence[];
  onChange: (value: SelectedEvidence[]) => void;
}) {
  const add = async (mode: "photo" | "file") => {
    const remaining = MAX_EVIDENCE_FILES_PER_RECORD - value.length;
    if (remaining <= 0) return;
    const picked =
      mode === "photo"
        ? await pickPhotoEvidence(remaining)
        : await pickEvidenceFiles();
    onChange([...value, ...picked].slice(0, MAX_EVIDENCE_FILES_PER_RECORD));
  };
  return (
    <>
      <Label text="Private supporting evidence" />
      <View style={styles.chips}>
        <Chip label="Add photo" active={false} onPress={() => void add("photo")} />
        <Chip label="Add file" active={false} onPress={() => void add("file")} />
      </View>
      {value.map((file) => (
        <View key={file.id} style={styles.between}>
          <Text style={styles.fileName}>{file.fileName}</Text>
          <Pressable onPress={() => onChange(value.filter((item) => item.id !== file.id))}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </>
  );
}

function Page({ children }: { children: ReactNode }) {
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
    <View style={styles.header}>
      <Pressable onPress={onBack}><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.pageTitle}>{title}</Text>
    </View>
  );
}

function Card({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <View style={[styles.card, accent && styles.cardAccent]}>{children}</View>;
}
function Input(props: ComponentProps<typeof TextInput>) {
  return <TextInput {...props} placeholderTextColor="#64748b" style={[styles.input, props.multiline && styles.multiline]} />;
}
function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[styles.button, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}
function Badge({ text }: { text: string }) { return <Text style={styles.badge}>{text}</Text>; }
function Banner({ text }: { text: string }) { return <View style={styles.banner}><Text style={styles.bannerText}>{text}</Text></View>; }
function Empty({ text }: { text: string }) { return <Text style={styles.empty}>{text}</Text>; }
function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}
function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}
function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "The record could not be saved.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 18, paddingBottom: 120, gap: 14 },
  header: { gap: 8, marginBottom: 2 },
  back: { color: "#67e8f9", fontWeight: "800", fontSize: 15 },
  pageTitle: { color: "#f8fafc", fontSize: 27, fontWeight: "900" },
  title: { color: "#f8fafc", fontSize: 21, fontWeight: "900" },
  card: { backgroundColor: "#0f1d2e", borderColor: "#22354c", borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  cardAccent: { borderColor: "#22d3ee" },
  cardTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "800" },
  caption: { color: "#9fb2c8", fontSize: 14, lineHeight: 20 },
  meta: { color: "#8ba0b8", fontSize: 12, lineHeight: 18 },
  reference: { color: "#67e8f9", fontWeight: "900", fontSize: 13 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  badge: { color: "#bfdbfe", backgroundColor: "#132b45", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "800", overflow: "hidden" },
  alert: { color: "#fda4af", fontWeight: "800", fontSize: 12 },
  banner: { backgroundColor: "#10283a", borderRadius: 14, padding: 13, borderLeftColor: "#22d3ee", borderLeftWidth: 3 },
  bannerText: { color: "#bae6fd", fontSize: 13, lineHeight: 19 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  metric: { width: "47%", backgroundColor: "#0d1b2b", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "#1e344a" },
  metricValue: { color: "#67e8f9", fontSize: 22, fontWeight: "900" },
  metricLabel: { color: "#9fb2c8", fontSize: 11, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderColor: "#334a63", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: "#155e75", borderColor: "#22d3ee" },
  chipText: { color: "#a8bbcf", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#ecfeff" },
  input: { color: "#f8fafc", backgroundColor: "#081522", borderColor: "#2a4058", borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14 },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  label: { color: "#dbeafe", fontWeight: "800", fontSize: 12, marginTop: 4 },
  button: { backgroundColor: "#0891b2", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", marginTop: 3 },
  buttonText: { color: "#ecfeff", fontWeight: "900", fontSize: 13 },
  disabled: { opacity: 0.5 },
  error: { color: "#fda4af", fontWeight: "700", fontSize: 12 },
  empty: { color: "#8ba0b8", textAlign: "center", padding: 24 },
  fact: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#26384b", paddingTop: 8 },
  factLabel: { color: "#7f93aa", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  factValue: { color: "#dbeafe", fontSize: 13, lineHeight: 19, marginTop: 2 },
  action: { backgroundColor: "#091725", borderRadius: 10, padding: 10 },
  actionTitle: { color: "#e2e8f0", fontWeight: "800", fontSize: 12 },
  fileName: { color: "#cbd5e1", fontSize: 12, flex: 1 },
  remove: { color: "#fda4af", fontWeight: "800", fontSize: 12 },
});
