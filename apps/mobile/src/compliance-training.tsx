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
  queueComplianceCompletion,
  queueComplianceReview,
  queueTrainingCompletion,
  queueTrainingProgress,
} from "./storage";
import type {
  MobileBootstrap,
  MobileComplianceOccurrence,
  MobileTrainingAssignment,
} from "./types";

export type ComplianceTrainingView = "calendar" | "training";

export function ComplianceTrainingScreen({
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
  initialView: ComplianceTrainingView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [view, setView] = useState<ComplianceTrainingView>(initialView);
  const [query, setQuery] = useState("");
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const complianceOccurrences = workspace.complianceOccurrences ?? [];
  const trainingAssignments = workspace.trainingAssignments ?? [];
  const capabilities = workspace.complianceTrainingCapabilities ?? {
    canViewCompliance: false,
    canManageCompliance: false,
    canViewTraining: false,
    canManageTraining: false,
  };
  const selectedOccurrence = complianceOccurrences.find(
    (item) => item.id === selectedOccurrenceId
  );
  const selectedTraining = trainingAssignments.find(
    (item) => item.id === selectedTrainingId
  );

  if (selectedOccurrence) {
    return (
      <ComplianceDetail
        occurrence={selectedOccurrence}
        canManage={capabilities.canManageCompliance}
        ownerKey={ownerKey}
        online={online}
        onBack={() => setSelectedOccurrenceId(null)}
        onQueued={onQueued}
        onSync={onSync}
      />
    );
  }
  if (selectedTraining) {
    return (
      <TrainingDetail
        assignment={selectedTraining}
        canManage={capabilities.canManageTraining}
        ownerKey={ownerKey}
        online={online}
        onBack={() => setSelectedTrainingId(null)}
        onQueued={onQueued}
        onSync={onSync}
      />
    );
  }

  const canViewCalendar = capabilities.canViewCompliance;
  const canViewTraining = capabilities.canViewTraining;
  if (!canViewCalendar && !canViewTraining) {
    return (
      <Page>
        <Header
          eyebrow="GOVERNED WORK"
          title="Access restricted"
          onBack={onBack}
        />
        <Empty text="Your role does not include Compliance Calendar or Training access." />
      </Page>
    );
  }

  const activeView =
    (view === "calendar" && canViewCalendar) ||
    (view === "training" && canViewTraining)
      ? view
      : canViewCalendar
        ? "calendar"
        : "training";
  const normalized = query.trim().toLowerCase();
  const occurrences = complianceOccurrences.filter((item) =>
    !normalized ||
    `${item.task.title} ${item.task.category} ${item.site.name} ${item.assignedTo.name} ${item.status}`
      .toLowerCase()
      .includes(normalized)
  );
  const assignments = trainingAssignments.filter((item) =>
    !normalized ||
    `${item.courseName} ${item.course?.code ?? ""} ${item.user.name} ${item.provider ?? ""} ${item.status}`
      .toLowerCase()
      .includes(normalized)
  );

  return (
    <Page>
      <Header
        eyebrow="OFFLINE GOVERNANCE"
        title="Calendar and Training"
        onBack={onBack}
      />
      <Text style={styles.muted}>
        Complete assigned compliance work and manage training from the encrypted,
        role-aware workspace. Authorized updates remain queued without connectivity.
      </Text>
      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline mode · Calendar submissions, reviews, and training progress
            will synchronize automatically.
          </Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        {canViewCalendar ? (
          <Chip
            label={`Calendar ${complianceOccurrences.length}`}
            active={activeView === "calendar"}
            onPress={() => {
              setView("calendar");
              setQuery("");
            }}
          />
        ) : null}
        {canViewTraining ? (
          <Chip
            label={`Training ${trainingAssignments.length}`}
            active={activeView === "training"}
            onPress={() => {
              setView("training");
              setQuery("");
            }}
          />
        ) : null}
      </View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={
          activeView === "calendar"
            ? "Search calendar assignments"
            : "Search training assignments"
        }
      />

      {activeView === "calendar" ? (
        <>
          <Summary
            open={occurrences.filter((item) => isOpenCompliance(item.status)).length}
            overdue={occurrences.filter((item) => item.status === "OVERDUE").length}
            pending={occurrences.filter((item) => item.status === "SUBMITTED").length}
          />
          {occurrences.map((occurrence) => (
            <Pressable
              key={occurrence.id}
              onPress={() => setSelectedOccurrenceId(occurrence.id)}
            >
              <Card accent={occurrence.status === "OVERDUE"}>
                <View style={styles.cardHeading}>
                  <Text style={styles.kicker}>
                    {humanize(occurrence.task.category)} ·{" "}
                    {humanize(occurrence.task.recurrence)}
                  </Text>
                  <StatusBadge status={occurrence.status} />
                </View>
                <Text style={styles.cardTitle}>{occurrence.task.title}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {occurrence.task.description || "No description provided."}
                </Text>
                <Text style={styles.meta}>
                  {occurrence.site.name}
                  {occurrence.department
                    ? ` · ${occurrence.department.name}`
                    : ""}
                  {" · "}
                  {occurrence.assignedTo.name}
                </Text>
                <Due value={occurrence.dueAt} status={occurrence.status} />
              </Card>
            </Pressable>
          ))}
          {!occurrences.length ? (
            <Empty text="No compliance calendar assignments match this search." />
          ) : null}
        </>
      ) : (
        <>
          <Summary
            open={assignments.filter((item) =>
              ["OPEN", "IN_PROGRESS", "OVERDUE"].includes(item.status)
            ).length}
            overdue={assignments.filter((item) => item.status === "OVERDUE").length}
            pending={assignments.filter((item) => item.status === "IN_PROGRESS").length}
          />
          {assignments.map((assignment) => (
            <Pressable
              key={assignment.id}
              onPress={() => setSelectedTrainingId(assignment.id)}
            >
              <Card accent={assignment.status === "OVERDUE"}>
                <View style={styles.cardHeading}>
                  <Text style={styles.kicker}>
                    {assignment.course?.code || "TRAINING"} ·{" "}
                    {assignment.isAssignedToCurrentUser ? "MY ASSIGNMENT" : "TEAM"}
                  </Text>
                  <StatusBadge status={assignment.status} />
                </View>
                <Text style={styles.cardTitle}>{assignment.courseName}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {assignment.course?.description ||
                    "No course description provided."}
                </Text>
                <Text style={styles.meta}>
                  {assignment.user.name} ·{" "}
                  {assignment.provider || assignment.course?.provider || "Internal"}
                </Text>
                {assignment.dueDate ? (
                  <Due value={assignment.dueDate} status={assignment.status} />
                ) : (
                  <Text style={styles.meta}>No due date assigned</Text>
                )}
              </Card>
            </Pressable>
          ))}
          {!assignments.length ? (
            <Empty text="No training assignments match this search." />
          ) : null}
        </>
      )}
    </Page>
  );
}

function ComplianceDetail({
  occurrence,
  canManage,
  ownerKey,
  online,
  onBack,
  onQueued,
  onSync,
}: {
  occurrence: MobileComplianceOccurrence;
  canManage: boolean;
  ownerKey: string;
  online: boolean;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [completionNotes, setCompletionNotes] = useState(
    occurrence.completionNotes || ""
  );
  const [evidenceUrl, setEvidenceUrl] = useState(occurrence.evidenceUrl || "");
  const [reviewNotes, setReviewNotes] = useState("");
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canComplete =
    (occurrence.isAssignedToCurrentUser || canManage) &&
    isOpenCompliance(occurrence.status);

  const submit = async () => {
    setError("");
    const notes = completionNotes.trim();
    const url = evidenceUrl.trim();
    if (url && !validHttpsUrl(url)) {
      setError("Evidence URL must be a valid HTTPS address.");
      return;
    }
    if (occurrence.task.evidenceRequired && !notes && !url) {
      setError("Completion notes or an HTTPS evidence link are required.");
      return;
    }
    setSaving(true);
    try {
      await queueComplianceCompletion(ownerKey, {
        occurrenceId: occurrence.id,
        completionNotes: notes || undefined,
        evidenceUrl: url || undefined,
      });
      await onQueued(
        online
          ? "Compliance completion queued for secure synchronization."
          : "Compliance completion encrypted and saved offline."
      );
      if (online) onSync();
      onBack();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  const review = async () => {
    setError("");
    if (decision === "REJECT" && reviewNotes.trim().length < 3) {
      setError("Explain what must be corrected before rejecting this submission.");
      return;
    }
    setSaving(true);
    try {
      await queueComplianceReview(ownerKey, {
        occurrenceId: occurrence.id,
        decision,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      await onQueued(
        online
          ? "Compliance review queued for secure synchronization."
          : "Compliance review encrypted and saved offline."
      );
      if (online) onSync();
      onBack();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Header
          eyebrow="COMPLIANCE CALENDAR"
          title={occurrence.task.title}
          onBack={onBack}
        />
        <View style={styles.cardHeading}>
          <StatusBadge status={occurrence.status} />
          <Text style={styles.due}>
            Due {formatDateTime(occurrence.dueAt)}
          </Text>
        </View>
        <Card>
          <Detail label="Category" value={humanize(occurrence.task.category)} />
          <Detail label="Recurrence" value={humanize(occurrence.task.recurrence)} />
          <Detail label="Site" value={occurrence.site.name} />
          <Detail
            label="Department"
            value={occurrence.department?.name || "All departments"}
          />
          <Detail label="Assignee" value={occurrence.assignedTo.name} />
          <Detail
            label="Regulatory reference"
            value={occurrence.task.regulatoryReference || "Not specified"}
          />
        </Card>
        {occurrence.task.description ? (
          <Card>
            <Text style={styles.cardTitle}>Purpose</Text>
            <Text style={styles.muted}>{occurrence.task.description}</Text>
          </Card>
        ) : null}
        {occurrence.task.instructions ? (
          <Card accent>
            <Text style={styles.cardTitle}>Instructions</Text>
            <Text style={styles.muted}>{occurrence.task.instructions}</Text>
          </Card>
        ) : null}
        {occurrence.completionNotes ? (
          <Card>
            <Text style={styles.cardTitle}>Submitted completion</Text>
            <Text style={styles.muted}>{occurrence.completionNotes}</Text>
            {occurrence.evidenceUrl ? (
              <Text style={styles.meta}>{occurrence.evidenceUrl}</Text>
            ) : null}
          </Card>
        ) : null}
        {occurrence.reviewNotes ? (
          <Card>
            <Text style={styles.cardTitle}>Review notes</Text>
            <Text style={styles.muted}>{occurrence.reviewNotes}</Text>
          </Card>
        ) : null}
        {canComplete ? (
          <Card accent>
            <Text style={styles.cardTitle}>Complete assigned work</Text>
            <Text style={styles.muted}>
              {occurrence.task.approvalRequired
                ? "This completion will be submitted for compliance-manager approval."
                : "This completion will close the calendar occurrence after synchronization."}
            </Text>
            <Label
              text={`Completion notes${
                occurrence.task.evidenceRequired ? " *" : ""
              }`}
            />
            <Input
              value={completionNotes}
              onChangeText={setCompletionNotes}
              placeholder="Describe the work performed and result"
              multiline
            />
            <Label text="Evidence URL" />
            <Input
              value={evidenceUrl}
              onChangeText={setEvidenceUrl}
              placeholder="https://…"
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={styles.help}>
              Use a secure tenant-approved evidence link. Direct calendar-file
              attachments remain available in the web workspace.
            </Text>
            <PrimaryButton
              label={saving ? "Saving securely…" : online ? "Submit and sync" : "Save offline"}
              disabled={saving}
              onPress={submit}
            />
          </Card>
        ) : null}
        {canManage && occurrence.status === "SUBMITTED" ? (
          <Card accent>
            <Text style={styles.cardTitle}>Manager review</Text>
            <View style={styles.chips}>
              <Chip
                label="Approve"
                active={decision === "APPROVE"}
                onPress={() => setDecision("APPROVE")}
              />
              <Chip
                label="Reject for correction"
                active={decision === "REJECT"}
                onPress={() => setDecision("REJECT")}
              />
            </View>
            <Label text={decision === "REJECT" ? "Review notes *" : "Review notes"} />
            <Input
              value={reviewNotes}
              onChangeText={setReviewNotes}
              placeholder="Record the review decision and any required correction"
              multiline
            />
            <PrimaryButton
              label={saving ? "Saving securely…" : online ? "Record review and sync" : "Save review offline"}
              disabled={saving}
              onPress={review}
            />
          </Card>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Page>
    </KeyboardAvoidingView>
  );
}

function TrainingDetail({
  assignment,
  canManage,
  ownerKey,
  online,
  onBack,
  onQueued,
  onSync,
}: {
  assignment: MobileTrainingAssignment;
  canManage: boolean;
  ownerKey: string;
  online: boolean;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [progressNotes, setProgressNotes] = useState(assignment.notes || "");
  const [completedAt, setCompletedAt] = useState(todayDate());
  const [certificateNumber, setCertificateNumber] = useState("");
  const [score, setScore] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = !["COMPLETED", "CLOSED"].includes(assignment.status);
  const canStart = open && (assignment.isAssignedToCurrentUser || canManage);

  const start = async () => {
    setSaving(true);
    setError("");
    try {
      await queueTrainingProgress(ownerKey, {
        trainingRecordId: assignment.id,
        notes: progressNotes.trim() || undefined,
      });
      await onQueued(
        online
          ? "Training progress queued for secure synchronization."
          : "Training progress encrypted and saved offline."
      );
      if (online) onSync();
      onBack();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    setError("");
    if (!validDate(completedAt) || completedAt > todayDate()) {
      setError("Completion date must use YYYY-MM-DD and cannot be in the future.");
      return;
    }
    const numericScore = score.trim() ? Number(score) : undefined;
    if (
      numericScore !== undefined &&
      (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)
    ) {
      setError("Training score must be between 0 and 100.");
      return;
    }
    setSaving(true);
    try {
      await queueTrainingCompletion(ownerKey, {
        trainingRecordId: assignment.id,
        completedAt,
        certificateNumber: certificateNumber.trim() || undefined,
        score: numericScore,
        notes: completionNotes.trim() || undefined,
      });
      await onQueued(
        online
          ? "Training completion queued for governed synchronization."
          : "Training completion encrypted and saved offline."
      );
      if (online) onSync();
      onBack();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Header
          eyebrow="TRAINING ASSIGNMENT"
          title={assignment.courseName}
          onBack={onBack}
        />
        <View style={styles.cardHeading}>
          <StatusBadge status={assignment.status} />
          {assignment.dueDate ? (
            <Text style={styles.due}>
              Due {formatDateTime(assignment.dueDate)}
            </Text>
          ) : null}
        </View>
        <Card>
          <Detail label="Learner" value={assignment.user.name} />
          <Detail
            label="Course code"
            value={assignment.course?.code || "Not specified"}
          />
          <Detail
            label="Provider"
            value={assignment.provider || assignment.course?.provider || "Internal"}
          />
          <Detail
            label="Assigned by"
            value={assignment.assignedBy?.name || "Automated requirement"}
          />
          <Detail
            label="Assigned"
            value={formatDateTime(assignment.assignedAt)}
          />
          <Detail
            label="Validity"
            value={
              assignment.course?.validityMonths
                ? `${assignment.course.validityMonths} months`
                : "No expiry configured"
            }
          />
        </Card>
        {assignment.course?.description ? (
          <Card accent>
            <Text style={styles.cardTitle}>Course description</Text>
            <Text style={styles.muted}>{assignment.course.description}</Text>
          </Card>
        ) : null}
        {assignment.status === "COMPLETED" ? (
          <Card>
            <Text style={styles.cardTitle}>Completion record</Text>
            <Detail
              label="Completed"
              value={
                assignment.completedAt
                  ? formatDateTime(assignment.completedAt)
                  : "Not recorded"
              }
            />
            <Detail
              label="Certificate"
              value={assignment.certificateNumber || "Not recorded"}
            />
            <Detail
              label="Score"
              value={
                assignment.score === null
                  ? "Not recorded"
                  : `${assignment.score}%`
              }
            />
            <Detail
              label="Expires"
              value={
                assignment.expiresAt
                  ? formatDateTime(assignment.expiresAt)
                  : "No expiry"
              }
            />
            <Detail label="Notes" value={assignment.notes || "Not recorded"} />
          </Card>
        ) : null}
        {canStart && assignment.status !== "IN_PROGRESS" ? (
          <Card accent>
            <Text style={styles.cardTitle}>Start training</Text>
            <Text style={styles.muted}>
              Learners may record progress. Certification and competency awards
              remain restricted to authorized training managers.
            </Text>
            <Label text="Progress notes" />
            <Input
              value={progressNotes}
              onChangeText={setProgressNotes}
              placeholder="Optional preparation or progress note"
              multiline
            />
            <SecondaryButton
              label={saving ? "Saving securely…" : online ? "Start and sync" : "Start offline"}
              disabled={saving}
              onPress={start}
            />
          </Card>
        ) : null}
        {canManage && open ? (
          <Card accent>
            <Text style={styles.cardTitle}>Certify completion</Text>
            <Text style={styles.muted}>
              This governed action can award mapped competencies and calculate
              expiry dates using the existing course rules.
            </Text>
            <Label text="Completion date *" />
            <Input
              value={completedAt}
              onChangeText={setCompletedAt}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <Label text="Certificate number" />
            <Input
              value={certificateNumber}
              onChangeText={setCertificateNumber}
              placeholder="Optional certificate reference"
            />
            <Label text="Score (%)" />
            <Input
              value={score}
              onChangeText={setScore}
              placeholder="0–100"
              keyboardType="decimal-pad"
            />
            <Label text="Completion notes" />
            <Input
              value={completionNotes}
              onChangeText={setCompletionNotes}
              placeholder="Assessment result and verification notes"
              multiline
            />
            <PrimaryButton
              label={saving ? "Saving securely…" : online ? "Certify and sync" : "Save certification offline"}
              disabled={saving}
              onPress={complete}
            />
          </Card>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Page>
    </KeyboardAvoidingView>
  );
}

function Page({ children }: { children: React.ReactNode }) {
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
  eyebrow,
  title,
  onBack,
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.kicker}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Summary({
  open,
  overdue,
  pending,
}: {
  open: number;
  overdue: number;
  pending: number;
}) {
  return (
    <View style={styles.summary}>
      <SummaryItem label="Open" value={open} />
      <SummaryItem label="Overdue" value={overdue} warning />
      <SummaryItem label="In review/progress" value={pending} />
    </View>
  );
}

function SummaryItem({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, warning && styles.overdue]}>{value}</Text>
      <Text style={styles.help}>{label}</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.help}>{label.toUpperCase()}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Due({ value, status }: { value: string; status: string }) {
  const overdue = status === "OVERDUE" || (
    isOpenCompliance(status) && new Date(value).getTime() < Date.now()
  );
  return (
    <Text style={overdue ? styles.overdue : styles.due}>
      {overdue ? "Overdue" : "Due"} {formatDateTime(value)}
    </Text>
  );
}

function StatusBadge({ status }: { status: string }) {
  const alert = status === "OVERDUE" || status === "REJECTED";
  const done = status === "COMPLETED" || status === "CLOSED";
  return (
    <View
      style={[
        styles.status,
        alert && styles.statusAlert,
        done && styles.statusDone,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          alert && styles.statusTextAlert,
          done && styles.statusTextDone,
        ]}
      >
        {humanize(status)}
      </Text>
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

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#64748b"
      style={[styles.input, props.multiline && styles.multiline, props.style]}
    />
  );
}

function PrimaryButton({
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
      style={[styles.primaryButton, disabled && styles.disabled]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
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
      style={[styles.secondaryButton, disabled && styles.disabled]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function isOpenCompliance(status: string) {
  return ["UPCOMING", "DUE", "IN_PROGRESS", "REJECTED", "OVERDUE"].includes(
    status
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function validHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function messageOf(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "The update could not be saved.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  header: { gap: 6 },
  back: { color: "#67e8f9", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  kicker: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#f8fafc", fontSize: 29, lineHeight: 36, fontWeight: "800" },
  muted: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  meta: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  help: { color: "#64748b", fontSize: 11, lineHeight: 16 },
  due: { color: "#67e8f9", fontSize: 12, fontWeight: "700" },
  overdue: { color: "#fda4af", fontSize: 12, fontWeight: "800" },
  offlineBanner: { borderRadius: 16, borderWidth: 1, borderColor: "#f59e0b55", backgroundColor: "#78350f33", padding: 14 },
  offlineText: { color: "#fde68a", fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "#263a55", paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "#091525" },
  chipActive: { borderColor: "#67e8f9", backgroundColor: "#123047" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#cffafe" },
  summary: { flexDirection: "row", gap: 9 },
  summaryItem: { flex: 1, minHeight: 78, borderRadius: 16, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43", padding: 13, justifyContent: "space-between" },
  summaryValue: { color: "#f8fafc", fontSize: 24, fontWeight: "800" },
  card: { borderRadius: 18, padding: 17, gap: 9, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43" },
  cardAccent: { borderColor: "#22d3ee" },
  cardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#123047", borderWidth: 1, borderColor: "#1e7494" },
  statusAlert: { backgroundColor: "#4c051933", borderColor: "#fb718555" },
  statusDone: { backgroundColor: "#064e3b44", borderColor: "#34d39955" },
  statusText: { color: "#a5f3fc", fontSize: 10, fontWeight: "800" },
  statusTextAlert: { color: "#fda4af" },
  statusTextDone: { color: "#6ee7b7" },
  detail: { borderBottomWidth: 1, borderBottomColor: "#172a43", paddingBottom: 8, gap: 3 },
  detailValue: { color: "#dbeafe", fontSize: 14, lineHeight: 20 },
  label: { color: "#dbeafe", fontWeight: "700", fontSize: 13, marginTop: 5 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", color: "#f8fafc", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 104, textAlignVertical: "top" },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: "#67e8f9", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 7 },
  primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 },
  secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#2d4964", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 7 },
  secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.55 },
  empty: { borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 18, padding: 24 },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
});
