import { useMemo, useState } from "react";
import {
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
  resolveNativeRecordTarget,
  resolveWorkflowNativeTarget,
  type NativeRecordTarget,
} from "./native-routing";
import { queueCapaStatus } from "./storage";
import type {
  MobileBootstrap,
  MobileCorrectiveAction,
  MobileCorrectiveActionStatus,
} from "./types";

export type ActionCenterView = "tasks" | "capa" | "alerts";

export function ActionCenterScreen({
  workspace,
  ownerKey,
  online,
  view,
  onViewChange,
  onQueued,
  onSync,
  initialRecordId = null,
  onReadNotification,
  onOpenNativeTarget,
  onWorkflowDecision,
}: {
  workspace: MobileBootstrap;
  ownerKey: string;
  online: boolean;
  view: ActionCenterView;
  onViewChange: (view: ActionCenterView) => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
  initialRecordId?: string | null;
  onReadNotification: (id: string) => Promise<void>;
  onOpenNativeTarget: (target: NativeRecordTarget) => void;
  onWorkflowDecision: (
    task: MobileBootstrap["tasks"][number],
    decision: "APPROVE" | "REJECT",
    comments: string
  ) => Promise<void>;
}) {
  const [selectedCapaId, setSelectedCapaId] = useState<string | null>(
    view === "capa" ? initialRecordId : null
  );
  const selected = (workspace.correctiveActions ?? []).find(
    (action) => action.id === selectedCapaId
  ) ?? null;
  const unread = workspace.notifications.filter((item) => !item.readAt).length;
  const overdue = (workspace.correctiveActions ?? []).filter(
    (action) =>
      action.isAssignedToCurrentUser &&
      !["COMPLETED", "CLOSED"].includes(action.status) &&
      new Date(action.dueDate) < new Date()
  ).length;

  if (selected) {
    return (
      <CapaEditor
        key={`${selected.id}:${selected.status}`}
        action={selected}
        workspace={workspace}
        ownerKey={ownerKey}
        online={online}
        onBack={() => setSelectedCapaId(null)}
        onQueued={onQueued}
        onSync={onSync}
      />
    );
  }

  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentInner}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>NATIVE ACTION CENTER</Text>
      <Text style={styles.pageTitle}>My assigned work</Text>
      <Text style={styles.muted}>
        Review workflow steps, execute corrective actions, and read tenant
        notifications from one role-aware workspace.
      </Text>
      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            You are offline. CAPA progress and evidence remain encrypted on this
            device until secure synchronization succeeds.
          </Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip
          label={`Tasks ${workspace.tasks.length}`}
          active={view === "tasks"}
          onPress={() => onViewChange("tasks")}
        />
        <Chip
          label={`CAPA ${workspace.correctiveActions?.length ?? 0}${overdue ? ` · ${overdue} overdue` : ""}`}
          active={view === "capa"}
          onPress={() => onViewChange("capa")}
        />
        <Chip
          label={`Alerts ${unread}`}
          active={view === "alerts"}
          onPress={() => onViewChange("alerts")}
        />
      </View>

      {view === "tasks" ? (
        <TaskInbox
          workspace={workspace}
          onOpenNativeTarget={onOpenNativeTarget}
          onWorkflowDecision={onWorkflowDecision}
        />
      ) : null}
      {view === "capa" ? (
        <CapaInbox
          actions={workspace.correctiveActions ?? []}
          onSelect={setSelectedCapaId}
        />
      ) : null}
      {view === "alerts" ? (
        <AlertInbox
          workspace={workspace}
          online={online}
          onRead={onReadNotification}
          onOpenNativeTarget={onOpenNativeTarget}
        />
      ) : null}
    </ScrollView>
  );
}

function TaskInbox({
  workspace,
  onOpenNativeTarget,
  onWorkflowDecision,
}: {
  workspace: MobileBootstrap;
  onOpenNativeTarget: (target: NativeRecordTarget) => void;
  onWorkflowDecision: (
    task: MobileBootstrap["tasks"][number],
    decision: "APPROVE" | "REJECT",
    comments: string
  ) => Promise<void>;
}) {
  const [decisionTaskId, setDecisionTaskId] = useState<string | null>(null);
  const [decisionComments, setDecisionComments] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "decision" | "overdue">("all");
  const normalized = query.trim().toLowerCase();
  const visibleTasks = workspace.tasks.filter((task) => {
    const overdue = Boolean(task.dueAt && new Date(task.dueAt) < new Date());
    if (scope === "decision" && !task.canDecide) return false;
    if (scope === "overdue" && !overdue) return false;
    if (!normalized) return true;
    return [task.name, task.stepType, task.instance.entityType, task.instance.template.name]
      .some((value) => value.toLowerCase().includes(normalized));
  });
  if (!workspace.tasks.length) {
    return <Empty text="No active workflow steps are assigned to you." />;
  }
  return (
    <View style={styles.section}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search tasks, workflows, or record types"
        placeholderTextColor="#64748b"
        style={styles.searchInput}
      />
      <View style={styles.chips}>
        <Chip label="All" active={scope === "all"} onPress={() => setScope("all")} />
        <Chip label="Decision required" active={scope === "decision"} onPress={() => setScope("decision")} />
        <Chip label="Overdue" active={scope === "overdue"} onPress={() => setScope("overdue")} />
      </View>
      {visibleTasks.map((task) => {
        const overdue = Boolean(task.dueAt && new Date(task.dueAt) < new Date());
        const target = resolveWorkflowNativeTarget(
          task.instance.entityType,
          task.instance.entityId,
          task.href
        );
        return (
          <Pressable
            key={task.id}
            disabled={!target}
            onPress={() => target && onOpenNativeTarget(target)}
          >
          <Card accent={overdue}>
            <Text style={styles.questionNumber}>
              {humanize(task.stepType)} · {humanize(task.instance.entityType)}
            </Text>
            <Text style={styles.cardTitle}>{task.name}</Text>
            <Text style={styles.muted}>{task.instance.template.name}</Text>
            <Text style={overdue ? styles.overdue : styles.due}>
              {task.dueAt
                ? `${overdue ? "Overdue" : "Due"} ${formatDate(task.dueAt)}`
                : "No due date"}
            </Text>
            <Text style={styles.fieldHelp}>
              {target
                ? "Tap to open this assigned record in the native app."
                : "No native destination is available for this workflow step."}
            </Text>
            {task.canDecide && decisionTaskId === task.id ? (
              <View style={styles.section}>
                <FieldLabel text="Decision comments" />
                <TextInput
                  value={decisionComments}
                  onChangeText={setDecisionComments}
                  placeholder="Add context for this workflow decision"
                  multiline
                />
                <View style={styles.row}>
                  <SecondaryButton
                    label={deciding ? "Saving…" : "Approve"}
                    disabled={deciding}
                    onPress={() => {
                      setDeciding(true);
                      void onWorkflowDecision(task, "APPROVE", decisionComments)
                        .then(() => {
                          setDecisionTaskId(null);
                          setDecisionComments("");
                        })
                        .finally(() => setDeciding(false));
                    }}
                  />
                  <SecondaryButton
                    label={deciding ? "Saving…" : "Reject"}
                    disabled={deciding}
                    onPress={() => {
                      setDeciding(true);
                      void onWorkflowDecision(task, "REJECT", decisionComments)
                        .then(() => {
                          setDecisionTaskId(null);
                          setDecisionComments("");
                        })
                        .finally(() => setDeciding(false));
                    }}
                  />
                </View>
              </View>
            ) : task.canDecide ? (
              <SecondaryButton
                label="Make workflow decision"
                onPress={() => {
                  setDecisionTaskId(task.id);
                  setDecisionComments("");
                }}
              />
            ) : (
              <Text style={styles.fieldHelp}>
                This assigned workflow step does not require an approve/reject decision.
              </Text>
            )}
          </Card>
          </Pressable>
        );
      })}
      {!visibleTasks.length ? <Empty text="No workflow tasks match this search or filter." /> : null}
    </View>
  );
}

function CapaInbox({
  actions,
  onSelect,
}: {
  actions: MobileCorrectiveAction[];
  onSelect: (id: string) => void;
}) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "overdue" | "completed">("all");
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return actions.filter((action) => {
      if (scope === "mine" && !action.isAssignedToCurrentUser) return false;
      const overdue = !["COMPLETED", "CLOSED"].includes(action.status) && new Date(action.dueDate) < new Date();
      if (statusFilter === "open" && ["COMPLETED", "CLOSED"].includes(action.status)) return false;
      if (statusFilter === "overdue" && !overdue) return false;
      if (statusFilter === "completed" && !["COMPLETED", "CLOSED"].includes(action.status)) return false;
      if (!normalized) return true;
      return [
        action.title,
        action.description ?? "",
        action.source.type,
        action.source.label,
        action.assignedTo.name,
        action.riskLevel,
        action.status,
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [actions, query, scope, statusFilter]);
  return (
    <View style={styles.section}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search CAPA, source, assignee, risk, or status"
        placeholderTextColor="#64748b"
        style={styles.searchInput}
      />
      <View style={styles.chips}>
        <Chip
          label="Assigned to me"
          active={scope === "mine"}
          onPress={() => setScope("mine")}
        />
        <Chip
          label="All authorized"
          active={scope === "all"}
          onPress={() => setScope("all")}
        />
      </View>
      <View style={styles.chips}>
        <Chip label="Any status" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
        <Chip label="Open" active={statusFilter === "open"} onPress={() => setStatusFilter("open")} />
        <Chip label="Overdue" active={statusFilter === "overdue"} onPress={() => setStatusFilter("overdue")} />
        <Chip label="Completed" active={statusFilter === "completed"} onPress={() => setStatusFilter("completed")} />
      </View>
      {visible.map((action) => {
        const overdue =
          !["COMPLETED", "CLOSED"].includes(action.status) &&
          new Date(action.dueDate) < new Date();
        return (
          <Pressable key={action.id} onPress={() => onSelect(action.id)}>
            <Card accent={overdue}>
              <Text style={styles.questionNumber}>
                {action.riskLevel} · {humanize(action.status)}
              </Text>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.muted} numberOfLines={2}>
                {action.description || "No description provided."}
              </Text>
              <Text style={styles.fieldHelp}>
                {action.source.type}: {action.source.label}
              </Text>
              <Text style={overdue ? styles.overdue : styles.due}>
                {overdue ? "Overdue" : "Due"} {formatDate(action.dueDate)}
                {" · "}
                {action.assignedTo.name}
              </Text>
            </Card>
          </Pressable>
        );
      })}
      {!visible.length ? (
        <Empty
          text={
            query.trim() || statusFilter !== "all"
              ? "No corrective actions match this search or filter."
              : scope === "mine"
                ? "No corrective actions are currently assigned to you."
                : "No corrective actions are available to your role."
          }
        />
      ) : null}
    </View>
  );
}

function CapaEditor({
  action,
  workspace,
  ownerKey,
  online,
  onBack,
  onQueued,
  onSync,
}: {
  action: MobileCorrectiveAction;
  workspace: MobileBootstrap;
  ownerKey: string;
  online: boolean;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const capabilities = workspace.capaCapabilities;
  const [status, setStatus] = useState<MobileCorrectiveActionStatus>(
    action.status
  );
  const [comments, setComments] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");
  const statuses = capabilities?.allowedStatuses ?? [];
  const canEdit = Boolean(capabilities?.canUpdate || capabilities?.canClose);
  const statusOptions = statuses.includes(action.status)
    ? statuses
    : [action.status, ...statuses];

  const save = async () => {
    setError("");
    if (!canEdit || !statuses.includes(status)) {
      setError("Your role cannot record this corrective-action status.");
      return;
    }
    if (
      (status === "COMPLETED" || status === "CLOSED") &&
      !capabilities.canClose
    ) {
      setError("Formal completion and closure require CAPA close permission.");
      return;
    }
    if (status === action.status && !comments.trim() && !evidence.length) {
      setError("Change the status or add a progress note or evidence.");
      return;
    }
    setSaving(true);
    try {
      await queueCapaStatus(
        ownerKey,
        {
          actionId: action.id,
          status,
          comments: comments.trim() || undefined,
        },
        evidence
      );
      setComments("");
      setEvidence([]);
      setQueued(true);
      await onQueued(
        online
          ? "Corrective-action update queued. Evidence will synchronize before the status change."
          : "Corrective-action progress is encrypted on this device and will synchronize when connectivity returns."
      );
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentInner}
      keyboardShouldPersistTaps="handled"
    >
      <SecondaryButton label="← Back to Action Center" onPress={onBack} />
      <Text style={styles.eyebrow}>
        {online ? "CAPA EXECUTION" : "OFFLINE CAPA EXECUTION"}
      </Text>
      <Text style={styles.pageTitle}>{action.title}</Text>
      <Text style={styles.muted}>
        {action.description || "No description provided."}
      </Text>
      <View style={styles.metricGrid}>
        <Metric label="Risk" value={action.riskLevel} />
        <Metric label="Status" value={humanize(action.status)} />
        <Metric label="Owner" value={action.assignedTo.name} />
        <Metric label="Due" value={formatDate(action.dueDate)} />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Source traceability</Text>
        <Text style={styles.muted}>
          {action.source.type}: {action.source.label}
        </Text>
        <Text style={styles.fieldHelp}>Source traceability is retained in this native record without opening a web workspace.</Text>
      </Card>
      {canEdit ? (
        <Card accent>
          <Text style={styles.cardTitle}>Record progress</Text>
          <Text style={styles.muted}>
            Updates use the same governed CAPA lifecycle as the web workspace.
            Completion and closure remain restricted to authorized roles.
          </Text>
          <FieldLabel text="Lifecycle status" />
          <View style={styles.chips}>
            {statusOptions.map((value) => (
              <Chip
                key={value}
                label={humanize(value)}
                active={status === value}
                disabled={!statuses.includes(value)}
                onPress={() => setStatus(value)}
              />
            ))}
          </View>
          <FieldLabel text="Progress, completion, or verification note" />
          <TextInput
            value={comments}
            onChangeText={setComments}
            placeholder="Describe work completed, results, verification, or remaining actions"
            placeholderTextColor="#64748b"
            multiline
            style={[styles.input, styles.multiline]}
          />
          <EvidencePicker value={evidence} onChange={setEvidence} />
          {queued ? (
            <Text style={styles.success}>
              Saved to the encrypted synchronization queue.
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={
              saving
                ? "Saving securely…"
                : online
                  ? "Save and synchronize"
                  : "Save offline"
            }
            disabled={saving}
            onPress={save}
          />
        </Card>
      ) : (
        <Card>
          <Text style={styles.cardTitle}>Read-only CAPA access</Text>
          <Text style={styles.muted}>
            Your role can review this corrective action but cannot change its
            lifecycle status. Contact an authorized CAPA manager if action is
            required.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

function AlertInbox({
  workspace,
  online,
  onRead,
  onOpenNativeTarget,
}: {
  workspace: MobileBootstrap;
  online: boolean;
  onRead: (id: string) => Promise<void>;
  onOpenNativeTarget: (target: NativeRecordTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"unread" | "all">("unread");
  const normalized = query.trim().toLowerCase();
  const visibleNotifications = workspace.notifications.filter((item) => {
    if (scope === "unread" && item.readAt) return false;
    if (!normalized) return true;
    return [item.title, item.message, item.type]
      .some((value) => value.toLowerCase().includes(normalized));
  });
  if (!workspace.notifications.length) {
    return <Empty text="You have no notifications." />;
  }
  return (
    <View style={styles.section}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search notification title, message, or type"
        placeholderTextColor="#64748b"
        style={styles.searchInput}
      />
      <View style={styles.chips}>
        <Chip label="Unread" active={scope === "unread"} onPress={() => setScope("unread")} />
        <Chip label="All" active={scope === "all"} onPress={() => setScope("all")} />
      </View>
      {visibleNotifications.map((item) => {
        const target = resolveNativeRecordTarget(item.link);
        return (
        <Card key={item.id} accent={!item.readAt}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.muted}>{item.message}</Text>
          <Text style={styles.due}>
            {formatDate(item.createdAt)}
            {item.readAt ? "" : " · New"}
          </Text>
          <View style={styles.row}>
            {!item.readAt ? (
              <SecondaryButton
                label={online ? "Mark read" : "Read status needs connection"}
                disabled={!online}
                onPress={() => {
                  void onRead(item.id);
                }}
              />
            ) : null}
            {target ? (
              <SecondaryButton
                label="Open linked record"
                onPress={() => onOpenNativeTarget(target)}
              />
            ) : null}
          </View>
        </Card>
        );
      })}
    </View>
  );
}

function EvidencePicker({
  value,
  onChange,
}: {
  value: SelectedEvidence[];
  onChange: (value: SelectedEvidence[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (source: "camera" | "photos" | "files") => {
    setBusy(true);
    setError("");
    try {
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
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.evidencePanel}>
      <FieldLabel text="Corrective-action evidence" />
      <Text style={styles.fieldHelp}>
        Photos and documents are encrypted offline and uploaded privately before
        the related CAPA status change.
      </Text>
      <View style={styles.row}>
        <SecondaryButton
          label={busy ? "Opening…" : "Take photo"}
          disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD}
          onPress={() => {
            void add("camera");
          }}
        />
        <SecondaryButton
          label={busy ? "Opening…" : "Choose photos"}
          disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD}
          onPress={() => {
            void add("photos");
          }}
        />
        <SecondaryButton
          label={busy ? "Opening…" : "Choose document"}
          disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD}
          onPress={() => {
            void add("files");
          }}
        />
      </View>
      {value.map((file) => (
        <View key={file.id} style={styles.fileRow}>
          <View style={styles.fileCopy}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.fileName}
            </Text>
            <Text style={styles.fieldHelp}>
              {humanize(file.kind)} · {formatFileSize(file.sizeBytes)}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              onChange(value.filter((candidate) => candidate.id !== file.id))
            }
          >
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Card({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return <View style={[styles.card, accent && styles.cardAccent]}>{children}</View>;
}

function Chip({
  label,
  active,
  disabled = false,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[styles.chip, active && styles.chipOn, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({
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
      disabled={disabled}
      style={[styles.primaryButton, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
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
      disabled={disabled}
      style={[styles.secondaryButton, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(value: number) {
  return value >= 1024 * 1024
    ? `${(value / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value / 1024))} KB`;
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  searchInput: {
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#ffffff20",
    borderRadius: 14,
    backgroundColor: "#020617aa",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contentInner: { padding: 20, paddingBottom: 120, gap: 14 },
  section: { gap: 12 },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  pageTitle: {
    color: "#f8fafc",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
  },
  muted: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  fieldHelp: { color: "#64748b", fontSize: 12, lineHeight: 17 },
  card: {
    borderRadius: 18,
    padding: 17,
    gap: 8,
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#172a43",
  },
  cardAccent: { borderColor: "#22d3ee" },
  cardTitle: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
  questionNumber: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  due: { color: "#67e8f9", fontSize: 12, marginTop: 3 },
  overdue: { color: "#fda4af", fontSize: 12, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263a55",
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#091525",
  },
  chipOn: { borderColor: "#67e8f9", backgroundColor: "#123047" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: "#cffafe" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 7 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 8,
  },
  primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2d4964",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },
  offlineBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f59e0b55",
    backgroundColor: "#78350f33",
    padding: 14,
  },
  offlineBannerText: { color: "#fde68a", fontSize: 13, lineHeight: 19 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    width: "48%",
    minHeight: 100,
    borderRadius: 18,
    padding: 16,
    justifyContent: "space-between",
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#172a43",
  },
  metricValue: { color: "#f8fafc", fontSize: 17, fontWeight: "800" },
  metricLabel: { color: "#94a3b8", fontSize: 13 },
  fieldLabel: {
    color: "#dbeafe",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 6,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#263a55",
    backgroundColor: "#091525",
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: { minHeight: 104, textAlignVertical: "top" },
  evidencePanel: {
    gap: 7,
    marginTop: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#263a55",
    backgroundColor: "#091525",
    padding: 13,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 10,
  },
  fileCopy: { flex: 1 },
  fileName: { color: "#dbeafe", fontSize: 13, fontWeight: "700" },
  remove: { color: "#fda4af", fontSize: 12, fontWeight: "700" },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19, marginTop: 8 },
  success: { color: "#6ee7b7", fontSize: 13, lineHeight: 18 },
  empty: {
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
    borderRadius: 18,
    padding: 24,
  },
});
