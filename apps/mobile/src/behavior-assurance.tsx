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
  queueBehaviorFollowUp,
  queueBehaviorProgramReview,
  queueBehaviorRecognition,
  queueBehaviorSession,
  queueCertificationReviewApprove,
  queueCertificationReviewComplete,
  queueSifSignalReview,
  queueSifVerification,
} from "./storage";
import type {
  BehaviorSessionPayload,
  CapturedAnswer,
  CapturedForm,
  CertificationReviewCompletePayload,
  MobileBehaviorProgram,
  MobileBehaviorSession,
  MobileBootstrap,
  MobileCertificationProgram,
  MobileCertificationReview,
  MobileCriticalControl,
  MobileSifSignal,
  RuntimeField,
  RuntimeForm,
  SifSignalReviewPayload,
} from "./types";

export type BehaviorAssuranceView = "behavior" | "sif" | "certification";
type FieldValue = string | boolean | string[];
type SharedProps = {
  ownerKey: string;
  online: boolean;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
};

const coachingTypes = [
  "POSITIVE_REINFORCEMENT",
  "CORRECTIVE_COACHING",
  "PEER_DISCUSSION",
  "STOP_WORK",
] as const;
const outcomes = ["SAFE", "AT_RISK", "NOT_OBSERVED"] as const;
const verificationResults = [
  "EFFECTIVE",
  "DEGRADED",
  "FAILED",
  "NOT_VERIFIED",
] as const;
const classifications = [
  "POTENTIAL_SIF",
  "PRECURSOR",
  "ROUTINE",
  "DISMISSED",
] as const;
const exposureCategories = [
  "MOBILE_EQUIPMENT",
  "WORK_AT_HEIGHT",
  "ENERGY_ISOLATION",
  "CONFINED_SPACE",
  "LIFTING_OPERATIONS",
  "FIRE_EXPLOSION",
  "HAZARDOUS_MATERIALS",
  "ELECTRICAL",
  "EXCAVATION",
  "LINE_OF_FIRE",
  "PROCESS_SAFETY",
  "OTHER",
] as const;
const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const conclusions = [
  "EFFECTIVE",
  "NEEDS_IMPROVEMENT",
  "NOT_EFFECTIVE",
] as const;

export function BehaviorAssuranceScreen({
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
  initialView: BehaviorAssuranceView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [view, setView] = useState(initialView);
  const capabilities = workspace.behaviorAssuranceCapabilities;
  const views = [
    ...(capabilities.canViewBehavior
      ? [{ value: "behavior" as const, label: "Behavior Safety" }]
      : []),
    ...(capabilities.canViewSif
      ? [{ value: "sif" as const, label: "SIF Prevention" }]
      : []),
    ...(capabilities.canViewCertification
      ? [{ value: "certification" as const, label: "Certification" }]
      : []),
  ];
  if (!views.length) {
    return (
      <Page>
        <Header title="Operational assurance" onBack={onBack} />
        <Empty text="Your role does not include Behavior Safety or Operational Assurance access." />
      </Page>
    );
  }
  const active = views.some((item) => item.value === view)
    ? view
    : views[0].value;
  const shared = { ownerKey, online, onQueued, onSync };
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Header title="Operational assurance" onBack={onBack} />
        <View style={styles.chips}>
          {views.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={active === item.value}
              onPress={() => setView(item.value)}
            />
          ))}
        </View>
        {!online ? (
          <Banner text="Authorized assurance records remain encrypted on this device and synchronize idempotently when connectivity returns." />
        ) : null}
        {active === "behavior" ? (
          <BehaviorWorkspace workspace={workspace} {...shared} />
        ) : active === "sif" ? (
          <SifWorkspace workspace={workspace} {...shared} />
        ) : (
          <CertificationWorkspace workspace={workspace} {...shared} />
        )}
      </Page>
    </KeyboardAvoidingView>
  );
}

function BehaviorWorkspace({
  workspace,
  ...shared
}: { workspace: MobileBootstrap } & SharedProps) {
  const [query, setQuery] = useState("");
  const [programId, setProgramId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const program = workspace.behaviorPrograms.find(
    (item) => item.id === programId
  );
  const session = program?.sessions.find((item) => item.id === sessionId);
  if (program && session) {
    return (
      <BehaviorSessionDetail
        session={session}
        workspace={workspace}
        onBack={() => setSessionId(null)}
        {...shared}
      />
    );
  }
  if (program) {
    return (
      <BehaviorProgramDetail
        program={program}
        workspace={workspace}
        onBack={() => setProgramId(null)}
        onSession={setSessionId}
        {...shared}
      />
    );
  }
  const normalized = query.trim().toLowerCase();
  const programs = workspace.behaviorPrograms.filter(
    (item) =>
      !normalized ||
      `${item.code} ${item.name} ${item.site?.name ?? ""}`
        .toLowerCase()
        .includes(normalized)
  );
  const sessions = programs.flatMap((item) => item.sessions);
  const openFollowUps = sessions.filter((item) =>
    ["OPEN", "IN_PROGRESS"].includes(item.followUpStatus)
  ).length;
  const critical = sessions.reduce(
    (sum, item) => sum + item.criticalAtRiskCount,
    0
  );
  return (
    <>
      <Text style={styles.muted}>
        Run coaching conversations, recognize safe work, and escalate at-risk
        behavior through governed observations, follow-up, and CAPA.
      </Text>
      <Summary>
        <SummaryItem
          label="Active"
          value={programs.filter((item) => item.status === "ACTIVE").length}
        />
        <SummaryItem label="Open follow-up" value={openFollowUps} />
        <SummaryItem label="Critical at-risk" value={critical} alert={critical > 0} />
      </Summary>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search programs or sites"
      />
      {programs.map((item) => (
        <Pressable key={item.id} onPress={() => setProgramId(item.id)}>
          <Card accent={item.status === "ACTIVE"}>
            <HeadingRow reference={item.code} status={item.status} />
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.muted}>
              {item.site?.name ?? "Organization-wide"} · {item.owner.name}
            </Text>
            <Text style={styles.meta}>
              {item.behaviors.length} behavior{item.behaviors.length === 1 ? "" : "s"} ·{" "}
              {item.sessions.length} recent session{item.sessions.length === 1 ? "" : "s"}
            </Text>
          </Card>
        </Pressable>
      ))}
      {!programs.length ? <Empty text="No behavior-safety programs match this view." /> : null}
    </>
  );
}

function BehaviorProgramDetail({
  program,
  workspace,
  onBack,
  onSession,
  ...shared
}: {
  program: MobileBehaviorProgram;
  workspace: MobileBootstrap;
  onBack: () => void;
  onSession: (id: string) => void;
} & SharedProps) {
  const capabilities = workspace.behaviorAssuranceCapabilities;
  return (
    <>
      <Back label="All behavior programs" onPress={onBack} />
      <HeadingRow reference={program.code} status={program.status} />
      <Text style={styles.pageTitle}>{program.name}</Text>
      <Text style={styles.muted}>
        {program.description || program.objective || "No program description."}
      </Text>
      <Card>
        <Detail label="Owner" value={program.owner.name} />
        <Detail label="Scope" value={`${program.site?.name ?? "All sites"}${program.department ? ` · ${program.department.name}` : ""}`} />
        <Detail label="Monthly target" value={`${program.targetSessionsPerMonth} sessions`} />
        <Detail label="Next review" value={program.nextReviewAt ? formatDate(program.nextReviewAt) : "Not scheduled"} />
      </Card>
      <Text style={styles.sectionTitle}>Observable behaviors</Text>
      {program.behaviors.map((behavior) => (
        <Card key={behavior.id} accent={behavior.isCritical}>
          <Text style={styles.reference}>
            {behavior.code} · {humanize(behavior.category)}
          </Text>
          <Text style={styles.cardTitle}>{behavior.title}</Text>
          <Text style={styles.muted}>{behavior.prompt}</Text>
          <Text style={styles.good}>Safe: {behavior.safeDescription}</Text>
          <Text style={styles.alert}>At risk: {behavior.atRiskDescription}</Text>
        </Card>
      ))}
      {capabilities.canRecordBehavior && program.status === "ACTIVE" ? (
        <BehaviorSessionForm
          program={program}
          workspace={workspace}
          {...shared}
        />
      ) : null}
      {capabilities.canManageBehavior && program.status !== "ARCHIVED" ? (
        <BehaviorProgramReviewForm program={program} {...shared} />
      ) : null}
      <Text style={styles.sectionTitle}>Recent coaching</Text>
      {program.sessions.map((item) => (
        <Pressable key={item.id} onPress={() => onSession(item.id)}>
          <Card accent={item.criticalAtRiskCount > 0}>
            <HeadingRow reference={item.reference} status={item.overallOutcome} />
            <Text style={styles.cardTitle}>
              {item.site.name} · {formatDate(item.observedAt)}
            </Text>
            <Text style={styles.meta}>
              {item.safeCount} safe · {item.atRiskCount} at risk ·{" "}
              {humanize(item.followUpStatus)}
            </Text>
          </Card>
        </Pressable>
      ))}
      {!program.sessions.length ? <Empty text="No recent coaching sessions." /> : null}
    </>
  );
}

function BehaviorSessionForm({
  program,
  workspace,
  ownerKey,
  online,
  onQueued,
  onSync,
}: {
  program: MobileBehaviorProgram;
  workspace: MobileBootstrap;
} & SharedProps) {
  const [siteId, setSiteId] = useState(program.site?.id ?? workspace.sites[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(program.department?.id ?? "");
  const [anonymous, setAnonymous] = useState(false);
  const [participantId, setParticipantId] = useState("");
  const [workGroup, setWorkGroup] = useState("");
  const [location, setLocation] = useState("");
  const [observedAt, setObservedAt] = useState(nowInput());
  const [coachingType, setCoachingType] =
    useState<BehaviorSessionPayload["coachingType"]>("PEER_DISCUSSION");
  const [discussion, setDiscussion] = useState("");
  const [commitment, setCommitment] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [followUpOwnerId, setFollowUpOwnerId] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [createObservation, setCreateObservation] = useState(false);
  const [results, setResults] = useState<
    Record<string, { outcome: string; note: string; immediateAction: string }>
  >({});
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sites = program.site ? [program.site] : workspace.sites;
  const departments = workspace.departments.filter(
    (item) => item.siteId === siteId
  );

  const save = async () => {
    setError("");
    const captured = program.behaviors.map((behavior) => ({
      behaviorId: behavior.id,
      outcome: results[behavior.id]?.outcome,
      note: results[behavior.id]?.note.trim() || undefined,
      immediateAction:
        results[behavior.id]?.immediateAction.trim() || undefined,
    }));
    if (!siteId || captured.some((item) => !item.outcome)) {
      setError("Select a site and record one outcome for every behavior.");
      return;
    }
    const atRisk = captured.filter((item) => item.outcome === "AT_RISK");
    const critical = atRisk.some(
      (item) =>
        program.behaviors.find((behavior) => behavior.id === item.behaviorId)
          ?.isCritical
    );
    if (critical && !immediateAction.trim()) {
      setError("Record the immediate control taken for critical at-risk behavior.");
      return;
    }
    if (atRisk.length && (!followUpOwnerId || !followUpDueAt)) {
      setError("Assign a follow-up owner and future due date for at-risk behavior.");
      return;
    }
    let customForms: CapturedForm[];
    let observedIso: string;
    let followUpIso: string | undefined;
    try {
      customForms = buildCapturedForms(workspace.behaviorForms, answers);
      observedIso = asIso(observedAt, "Observation date");
      followUpIso = followUpDueAt
        ? asIso(followUpDueAt, "Follow-up due date")
        : undefined;
    } catch (reason) {
      setError(messageOf(reason));
      return;
    }
    setSaving(true);
    try {
      await queueBehaviorSession(
        ownerKey,
        {
          programId: program.id,
          siteId,
          departmentId: departmentId || undefined,
          participantId: anonymous ? undefined : participantId || undefined,
          isParticipantAnonymous: anonymous,
          workGroup: workGroup.trim() || undefined,
          observedAt: observedIso,
          location: location.trim() || undefined,
          coachingType,
          discussionSummary: discussion.trim() || undefined,
          workerCommitment: commitment.trim() || undefined,
          immediateAction: immediateAction.trim() || undefined,
          followUpOwnerId: atRisk.length ? followUpOwnerId : undefined,
          followUpDueAt: atRisk.length ? followUpIso : undefined,
          createSafetyObservation: createObservation,
          customForms,
          results: captured.map((item) => ({
            ...item,
            outcome: item.outcome as BehaviorSessionPayload["results"][number]["outcome"],
          })),
        },
        evidence
      );
      setResults({});
      setDiscussion("");
      setCommitment("");
      setImmediateAction("");
      setFollowUpOwnerId("");
      setFollowUpDueAt("");
      setAnswers({});
      setEvidence([]);
      await queuedNotice(
        online,
        "Behavior coaching session",
        onQueued
      );
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Record coaching session">
      <Field label="Site *">
        <ChipGroup
          values={sites.map((item) => ({ value: item.id, label: item.name }))}
          selected={siteId}
          onSelect={(value) => {
            setSiteId(value);
            if (!program.department) setDepartmentId("");
          }}
        />
      </Field>
      {departments.length ? (
        <Field label="Department">
          <ChipGroup
            values={[
              { value: "", label: "None" },
              ...departments.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
            selected={departmentId}
            onSelect={setDepartmentId}
          />
        </Field>
      ) : null}
      <Field label="Observed at *">
        <Input
          value={observedAt}
          onChangeText={setObservedAt}
          placeholder="YYYY-MM-DDTHH:mm"
        />
      </Field>
      <Field label="Coaching approach">
        <ChipGroup
          values={coachingTypes.map((value) => ({
            value,
            label: humanize(value),
          }))}
          selected={coachingType}
          onSelect={(value) =>
            setCoachingType(value as BehaviorSessionPayload["coachingType"])
          }
        />
      </Field>
      <Field label="Location">
        <Input value={location} onChangeText={setLocation} placeholder="Work area" />
      </Field>
      <Field label="Work group / crew">
        <Input value={workGroup} onChangeText={setWorkGroup} placeholder="Crew or team" />
      </Field>
      <Check
        checked={anonymous}
        label="Withhold participant identity"
        onPress={() => {
          setAnonymous((value) => !value);
          setParticipantId("");
        }}
      />
      {!anonymous ? (
        <Field label="Participant">
          <PersonPicker
            people={workspace.behaviorAssurancePeople}
            selected={participantId}
            onSelect={setParticipantId}
            allowNone
          />
        </Field>
      ) : null}
      <Text style={styles.sectionTitle}>Behavior results</Text>
      {program.behaviors.map((behavior) => {
        const result = results[behavior.id] ?? {
          outcome: "",
          note: "",
          immediateAction: "",
        };
        const update = (value: Partial<typeof result>) =>
          setResults((current) => ({
            ...current,
            [behavior.id]: { ...result, ...value },
          }));
        return (
          <Card key={behavior.id} accent={behavior.isCritical}>
            <Text style={styles.reference}>
              {behavior.code} · {humanize(behavior.category)}
            </Text>
            <Text style={styles.cardTitle}>{behavior.title}</Text>
            <Text style={styles.muted}>{behavior.prompt}</Text>
            <ChipGroup
              values={outcomes.map((value) => ({
                value,
                label: humanize(value),
              }))}
              selected={result.outcome}
              onSelect={(value) => update({ outcome: value })}
            />
            <Input
              value={result.note}
              onChangeText={(value) => update({ note: value })}
              placeholder="Observation note"
              multiline
            />
            <Input
              value={result.immediateAction}
              onChangeText={(value) => update({ immediateAction: value })}
              placeholder="Behavior-specific action"
              multiline
            />
          </Card>
        );
      })}
      <Field label="Coaching discussion">
        <Input value={discussion} onChangeText={setDiscussion} multiline />
      </Field>
      <Field label="Worker commitment">
        <Input value={commitment} onChangeText={setCommitment} multiline />
      </Field>
      <Field label="Immediate control / stop-work action">
        <Input value={immediateAction} onChangeText={setImmediateAction} multiline />
      </Field>
      <Field label="Follow-up owner">
        <PersonPicker
          people={workspace.behaviorAssurancePeople}
          selected={followUpOwnerId}
          onSelect={setFollowUpOwnerId}
          allowNone
        />
      </Field>
      <Field label="Follow-up due">
        <Input
          value={followUpDueAt}
          onChangeText={setFollowUpDueAt}
          placeholder="YYYY-MM-DDTHH:mm"
        />
      </Field>
      <Check
        checked={createObservation}
        label="Also create a linked Safety Observation"
        onPress={() => setCreateObservation((value) => !value)}
      />
      <EvidencePicker
        value={evidence}
        onChange={setEvidence}
        label="Coaching evidence"
      />
      {workspace.behaviorForms.map((form) => (
        <DynamicForm
          key={form.id}
          form={form}
          answers={answers}
          setAnswers={setAnswers}
        />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Primary
        label={saving ? "Saving securely…" : online ? "Save and synchronize" : "Save offline"}
        disabled={saving}
        onPress={() => void save()}
      />
    </Section>
  );
}

function BehaviorProgramReviewForm({
  program,
  ownerKey,
  online,
  onQueued,
  onSync,
}: { program: MobileBehaviorProgram } & SharedProps) {
  const [notes, setNotes] = useState("");
  const [nextReviewAt, setNextReviewAt] = useState("");
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try {
      if (notes.trim().length < 2) throw new Error("Review notes are required.");
      await queueBehaviorProgramReview(ownerKey, {
        programId: program.id,
        reviewNotes: notes.trim(),
        nextReviewAt: asIso(nextReviewAt, "Next review date"),
      });
      setNotes("");
      setNextReviewAt("");
      await queuedNotice(online, "Program review", onQueued);
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <Section title="Record program review">
      <Field label="Review outcome *">
        <Input value={notes} onChangeText={setNotes} multiline />
      </Field>
      <Field label="Next review date *">
        <Input
          value={nextReviewAt}
          onChangeText={setNextReviewAt}
          placeholder="YYYY-MM-DDTHH:mm"
        />
      </Field>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Secondary label="Queue program review" onPress={() => void save()} />
    </Section>
  );
}

function BehaviorSessionDetail({
  session,
  workspace,
  onBack,
  ownerKey,
  online,
  onQueued,
  onSync,
}: {
  session: MobileBehaviorSession;
  workspace: MobileBootstrap;
  onBack: () => void;
} & SharedProps) {
  const [followUpStatus, setFollowUpStatus] =
    useState<"IN_PROGRESS" | "COMPLETED">(
      session.followUpStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS"
    );
  const [followUpNote, setFollowUpNote] = useState("");
  const [recognitionReason, setRecognitionReason] = useState("");
  const [error, setError] = useState("");
  const capabilities = workspace.behaviorAssuranceCapabilities;
  const canFollowUp =
    capabilities.canRecordBehavior &&
    (session.isFollowUpOwner || capabilities.canManageBehavior) &&
    ["OPEN", "IN_PROGRESS"].includes(session.followUpStatus);
  const canRecognize =
    capabilities.canRecordBehavior &&
    Boolean(session.participant) &&
    session.safeCount > 0 &&
    !session.recognitions.length &&
    !session.isParticipantAnonymous;

  const followUp = async () => {
    setError("");
    try {
      if (followUpNote.trim().length < 2) throw new Error("Follow-up evidence and outcome are required.");
      await queueBehaviorFollowUp(ownerKey, {
        sessionId: session.id,
        status: followUpStatus,
        note: followUpNote.trim(),
      });
      setFollowUpNote("");
      await queuedNotice(online, "Behavior follow-up", onQueued);
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  const recognize = async () => {
    setError("");
    try {
      if (!session.participant || recognitionReason.trim().length < 2) {
        throw new Error("Record the specific safe behavior and positive impact.");
      }
      await queueBehaviorRecognition(ownerKey, {
        sessionId: session.id,
        nominatedUserId: session.participant.id,
        reason: recognitionReason.trim(),
      });
      setRecognitionReason("");
      await queuedNotice(online, "Recognition nomination", onQueued);
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };

  return (
    <>
      <Back label="Program" onPress={onBack} />
      <HeadingRow reference={session.reference} status={session.overallOutcome} />
      <Text style={styles.pageTitle}>Coaching session</Text>
      <Text style={styles.muted}>
        {session.site.name} · {formatDate(session.observedAt)} · {session.observer.name}
      </Text>
      <Summary>
        <SummaryItem label="Safe" value={session.safeCount} />
        <SummaryItem label="At risk" value={session.atRiskCount} alert={session.atRiskCount > 0} />
        <SummaryItem label="Critical" value={session.criticalAtRiskCount} alert={session.criticalAtRiskCount > 0} />
      </Summary>
      <Card>
        <Detail label="Participant" value={session.isParticipantAnonymous ? "Identity withheld" : session.participant?.name ?? "Not recorded"} />
        <Detail label="Approach" value={humanize(session.coachingType)} />
        <Detail label="Follow-up" value={`${humanize(session.followUpStatus)}${session.followUpDueAt ? ` · ${formatDate(session.followUpDueAt)}` : ""}`} />
        <Detail label="Linked observation" value={session.safetyObservationId ? "Created" : "None"} />
        <Detail label="Linked CAPA" value={session.correctiveActionId ? "Created" : "None"} />
      </Card>
      {session.results.map((result) => (
        <Card key={result.id} accent={result.outcome === "AT_RISK"}>
          <HeadingRow reference={result.behavior.code} status={result.outcome} />
          <Text style={styles.cardTitle}>{result.behavior.title}</Text>
          {result.note ? <Text style={styles.muted}>{result.note}</Text> : null}
          {result.immediateAction ? <Text style={styles.meta}>Action: {result.immediateAction}</Text> : null}
        </Card>
      ))}
      {session.discussionSummary ? <Card><Detail label="Discussion" value={session.discussionSummary} /></Card> : null}
      {session.recognitions.map((recognition) => (
        <Card key={recognition.id}>
          <HeadingRow reference="RECOGNITION" status={recognition.status} />
          <Text style={styles.cardTitle}>{recognition.nominatedUser.name}</Text>
          <Text style={styles.muted}>{recognition.reason}</Text>
        </Card>
      ))}
      {canFollowUp ? (
        <Section title="Update follow-up">
          <ChipGroup
            values={[
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "COMPLETED", label: "Completed" },
            ]}
            selected={followUpStatus}
            onSelect={(value) =>
              setFollowUpStatus(value as "IN_PROGRESS" | "COMPLETED")
            }
          />
          <Input
            value={followUpNote}
            onChangeText={setFollowUpNote}
            placeholder="Follow-up evidence and outcome"
            multiline
          />
          <Secondary label="Queue follow-up update" onPress={() => void followUp()} />
        </Section>
      ) : null}
      {canRecognize ? (
        <Section title="Recognize safe leadership">
          <Text style={styles.muted}>Nominee: {session.participant?.name}</Text>
          <Input
            value={recognitionReason}
            onChangeText={setRecognitionReason}
            placeholder="Specific safe behavior and positive impact"
            multiline
          />
          <Secondary label="Nominate recognition" onPress={() => void recognize()} />
        </Section>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

function SifWorkspace({
  workspace,
  ...shared
}: { workspace: MobileBootstrap } & SharedProps) {
  const [mode, setMode] = useState<"signals" | "controls" | "clusters">("signals");
  const [signalId, setSignalId] = useState<string | null>(null);
  const [controlId, setControlId] = useState<string | null>(null);
  const sif = workspace.sifAssurance;
  const signal = sif?.signals.find((item) => item.id === signalId);
  const control = sif?.controls.find((item) => item.id === controlId);
  if (!sif) return <Empty text="No SIF intelligence is available for this role." />;
  if (signal) {
    return (
      <SifSignalDetail
        signal={signal}
        canManage={workspace.behaviorAssuranceCapabilities.canManageCriticalControls}
        onBack={() => setSignalId(null)}
        {...shared}
      />
    );
  }
  if (control) {
    return (
      <CriticalControlDetail
        control={control}
        workspace={workspace}
        onBack={() => setControlId(null)}
        {...shared}
      />
    );
  }
  return (
    <>
      <Text style={styles.muted}>
        Review weak signals and verify the critical controls intended to prevent
        serious injuries and fatalities. Scores are transparent indicators, not
        automated incident classifications.
      </Text>
      <Summary>
        <SummaryItem label="Active signals" value={sif.metrics.activeSignals} />
        <SummaryItem label="Unreviewed" value={sif.metrics.unreviewed} alert={sif.metrics.unreviewed > 0} />
        <SummaryItem label="Controls due" value={sif.metrics.overdueVerifications} alert={sif.metrics.overdueVerifications > 0} />
      </Summary>
      <View style={styles.chips}>
        {(["signals", "controls", "clusters"] as const).map((value) => (
          <Chip
            key={value}
            label={humanize(value)}
            active={mode === value}
            onPress={() => setMode(value)}
          />
        ))}
      </View>
      {mode === "signals"
        ? sif.signals.map((item) => (
            <Pressable key={item.id} onPress={() => setSignalId(item.id)}>
              <Card accent={item.confidence === "HIGH"}>
                <HeadingRow reference={item.sourceLabel} status={item.review?.classification ?? `${item.confidence}_CONFIDENCE`} />
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.muted}>{item.siteName ?? "Organization-wide"} · {humanize(item.category)}</Text>
                <Text style={styles.meta}>Score {item.score} · {item.reasons.join(" · ")}</Text>
              </Card>
            </Pressable>
          ))
        : null}
      {mode === "controls"
        ? sif.controls.map((item) => (
            <Pressable key={item.id} onPress={() => setControlId(item.id)}>
              <Card accent={item.isOverdue || item.latestVerification?.result === "FAILED"}>
                <HeadingRow reference={item.code} status={item.latestVerification?.result ?? "NOT_VERIFIED"} />
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.muted}>{item.site?.name ?? "Organization-wide"} · {humanize(item.category)}</Text>
                <Text style={styles.meta}>Next verification {formatDate(item.nextVerificationDueAt)}</Text>
              </Card>
            </Pressable>
          ))
        : null}
      {mode === "clusters"
        ? sif.clusters.map((item) => (
            <Card key={item.id} accent={item.pressure === "CRITICAL"}>
              <HeadingRow reference={item.siteName} status={item.pressure} />
              <Text style={styles.cardTitle}>{humanize(item.category)}</Text>
              <Text style={styles.muted}>
                {item.count} signal{item.count === 1 ? "" : "s"} · {item.coveragePercent}% effective control coverage
              </Text>
              <Text style={styles.meta}>Trend {humanize(item.trend)} · Score {item.score}</Text>
            </Card>
          ))
        : null}
    </>
  );
}

function SifSignalDetail({
  signal,
  canManage,
  onBack,
  ownerKey,
  online,
  onQueued,
  onSync,
}: {
  signal: MobileSifSignal;
  canManage: boolean;
  onBack: () => void;
} & SharedProps) {
  const [classification, setClassification] =
    useState<SifSignalReviewPayload["classification"]>(
      (signal.review?.classification as SifSignalReviewPayload["classification"]) ??
        "PRECURSOR"
    );
  const [category, setCategory] = useState(signal.category);
  const [severity, setSeverity] =
    useState<SifSignalReviewPayload["potentialSeverity"]>(signal.riskLevel);
  const [rationale, setRationale] = useState(signal.review?.rationale ?? "");
  const [failure, setFailure] = useState(signal.review?.controlFailureNotes ?? "");
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    try {
      if (rationale.trim().length < 2) throw new Error("Classification rationale is required.");
      await queueSifSignalReview(ownerKey, {
        sourceType: signal.sourceType,
        sourceId: signal.sourceId,
        classification,
        exposureCategory: category,
        potentialSeverity: severity,
        rationale: rationale.trim(),
        controlFailureNotes: failure.trim() || undefined,
      });
      await queuedNotice(online, "SIF classification review", onQueued);
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <>
      <Back label="SIF signals" onPress={onBack} />
      <HeadingRow reference={signal.sourceLabel} status={signal.review?.classification ?? signal.confidence} />
      <Text style={styles.pageTitle}>{signal.title}</Text>
      <Text style={styles.muted}>{signal.detail}</Text>
      <Card>
        <Detail label="Occurred" value={formatDate(signal.occurredAt)} />
        <Detail label="Site" value={signal.siteName ?? "Organization-wide"} />
        <Detail label="Transparent score" value={`${signal.score} · ${signal.reasons.join(", ")}`} />
      </Card>
      {canManage ? (
        <Section title="Human classification decision">
          <Field label="Classification">
            <ChipGroup
              values={classifications.map((value) => ({ value, label: humanize(value) }))}
              selected={classification}
              onSelect={(value) => setClassification(value as SifSignalReviewPayload["classification"])}
            />
          </Field>
          <Field label="Exposure category">
            <ChipGroup
              values={exposureCategories.map((value) => ({
                value,
                label: humanize(value),
              }))}
              selected={category}
              onSelect={setCategory}
            />
          </Field>
          <Field label="Potential severity">
            <ChipGroup
              values={riskLevels.map((value) => ({ value, label: humanize(value) }))}
              selected={severity}
              onSelect={(value) => setSeverity(value as SifSignalReviewPayload["potentialSeverity"])}
            />
          </Field>
          <Field label="Rationale *">
            <Input value={rationale} onChangeText={setRationale} multiline />
          </Field>
          <Field label="Control failure notes">
            <Input value={failure} onChangeText={setFailure} multiline />
          </Field>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Primary label={online ? "Save and synchronize" : "Save offline"} onPress={() => void save()} />
        </Section>
      ) : null}
    </>
  );
}

function CriticalControlDetail({
  control,
  workspace,
  onBack,
  ownerKey,
  online,
  onQueued,
  onSync,
}: {
  control: MobileCriticalControl;
  workspace: MobileBootstrap;
  onBack: () => void;
} & SharedProps) {
  const [result, setResult] =
    useState<"EFFECTIVE" | "DEGRADED" | "FAILED" | "NOT_VERIFIED">(
      "EFFECTIVE"
    );
  const [evidenceReference, setEvidenceReference] = useState("");
  const [findings, setFindings] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [error, setError] = useState("");
  const canManage =
    workspace.behaviorAssuranceCapabilities.canManageCriticalControls;
  const save = async () => {
    setError("");
    try {
      if (result === "EFFECTIVE" && !evidenceReference.trim() && !evidence.length) {
        throw new Error("Attach evidence or record an evidence reference before confirming effectiveness.");
      }
      if (["DEGRADED", "FAILED"].includes(result) && !findings.trim()) {
        throw new Error("Describe the control deficiency.");
      }
      const customForms = buildCapturedForms(workspace.sifForms, answers);
      await queueSifVerification(
        ownerKey,
        {
          controlId: control.id,
          verifiedAt: new Date().toISOString(),
          result,
          evidenceReference:
            evidenceReference.trim() ||
            (evidence.length ? "Mobile evidence attached" : undefined),
          findings: findings.trim() || undefined,
          immediateAction: immediateAction.trim() || undefined,
          customForms,
        },
        evidence
      );
      setEvidenceReference("");
      setFindings("");
      setImmediateAction("");
      setAnswers({});
      setEvidence([]);
      await queuedNotice(online, "Critical-control verification", onQueued);
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <>
      <Back label="Critical controls" onPress={onBack} />
      <HeadingRow reference={control.code} status={control.latestVerification?.result ?? "NOT_VERIFIED"} />
      <Text style={styles.pageTitle}>{control.name}</Text>
      <Text style={styles.muted}>{control.description || control.verificationPrompt}</Text>
      <Card>
        <Detail label="Category" value={humanize(control.category)} />
        <Detail label="Performance standard" value={control.performanceStandard} />
        <Detail label="Verification prompt" value={control.verificationPrompt} />
        <Detail label="Next due" value={formatDate(control.nextVerificationDueAt)} />
        <Detail label="Owner" value={control.owner?.name ?? "Unassigned"} />
      </Card>
      {canManage ? (
        <Section title="Record field verification">
          <ChipGroup
            values={verificationResults.map((value) => ({ value, label: humanize(value) }))}
            selected={result}
            onSelect={(value) => setResult(value as typeof result)}
          />
          <Field label="Evidence reference">
            <Input value={evidenceReference} onChangeText={setEvidenceReference} placeholder="Log, permit, document, or field reference" />
          </Field>
          <Field label="Findings">
            <Input value={findings} onChangeText={setFindings} multiline />
          </Field>
          <Field label="Immediate action">
            <Input value={immediateAction} onChangeText={setImmediateAction} multiline />
          </Field>
          <EvidencePicker value={evidence} onChange={setEvidence} label="Verification evidence" />
          {workspace.sifForms.map((form) => (
            <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Primary label={online ? "Save and synchronize" : "Save offline"} onPress={() => void save()} />
        </Section>
      ) : null}
    </>
  );
}

function CertificationWorkspace({
  workspace,
  ...shared
}: { workspace: MobileBootstrap } & SharedProps) {
  const [programId, setProgramId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const program = workspace.certificationPrograms.find(
    (item) => item.id === programId
  );
  const review = program?.reviews.find((item) => item.id === reviewId);
  if (program && review) {
    return (
      <CertificationReviewDetail
        review={review}
        workspace={workspace}
        onBack={() => setReviewId(null)}
        {...shared}
      />
    );
  }
  if (program) {
    return (
      <CertificationProgramDetail
        program={program}
        onBack={() => setProgramId(null)}
        onReview={setReviewId}
      />
    );
  }
  const programs = workspace.certificationPrograms;
  return (
    <>
      <Text style={styles.muted}>
        Certification readiness is evidence-based decision support. It does not
        claim or issue certification and keeps formal leadership approval under
        human governance.
      </Text>
      <Summary>
        <SummaryItem label="Programs" value={programs.length} />
        <SummaryItem label="Ready" value={programs.filter((item) => item.readiness.band === "READY_FOR_FORMAL_REVIEW").length} />
        <SummaryItem label="Open gaps" value={programs.reduce((sum, item) => sum + item.gaps.length, 0)} />
      </Summary>
      {programs.map((item) => (
        <Pressable key={item.id} onPress={() => setProgramId(item.id)}>
          <Card accent={item.readiness.band === "NOT_READY"}>
            <HeadingRow reference={item.code || "PROGRAM"} status={item.readiness.band} />
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.muted}>{item.standardName || item.framework || "Management system program"}</Text>
            <Text style={styles.meta}>{item.readiness.total}% readiness · {item.gaps.length} open gap{item.gaps.length === 1 ? "" : "s"}</Text>
          </Card>
        </Pressable>
      ))}
      {!programs.length ? <Empty text="No active certification-scoped Audit program is available." /> : null}
    </>
  );
}

function CertificationProgramDetail({
  program,
  onBack,
  onReview,
}: {
  program: MobileCertificationProgram;
  onBack: () => void;
  onReview: (id: string) => void;
}) {
  return (
    <>
      <Back label="Certification portfolio" onPress={onBack} />
      <HeadingRow reference={program.code || "PROGRAM"} status={program.readiness.band} />
      <Text style={styles.pageTitle}>{program.name}</Text>
      <Text style={styles.muted}>{program.standardName || program.framework || "Management system readiness"}</Text>
      <Summary>
        <SummaryItem label="Readiness" value={program.readiness.total} suffix="%" />
        <SummaryItem label="Gaps" value={program.gaps.length} alert={program.gaps.length > 0} />
        <SummaryItem label="Reviews" value={program.reviews.length} />
      </Summary>
      <Text style={styles.sectionTitle}>Readiness dimensions</Text>
      {program.readiness.dimensions.map((dimension) => (
        <Card key={dimension.key}>
          <HeadingRow reference={`${dimension.weight}% WEIGHT`} status={`${dimension.score}%`} />
          <Text style={styles.cardTitle}>{humanize(dimension.key)}</Text>
          <Progress value={dimension.score} />
        </Card>
      ))}
      <Text style={styles.sectionTitle}>Evidence gaps</Text>
      {program.gaps.map((gap, index) => (
        <Card key={`${index}:${gap}`} accent>
          <Text style={styles.alert}>{gap}</Text>
        </Card>
      ))}
      {!program.gaps.length ? <Card><Text style={styles.good}>No calculated readiness gaps remain.</Text></Card> : null}
      <Text style={styles.sectionTitle}>Management reviews</Text>
      {program.reviews.map((review) => (
        <Pressable key={review.id} onPress={() => onReview(review.id)}>
          <Card accent={review.status === "PLANNED" && new Date(review.scheduledAt) < new Date()}>
            <HeadingRow reference={review.reference} status={review.status} />
            <Text style={styles.cardTitle}>{review.title}</Text>
            <Text style={styles.muted}>Chair: {review.chair.name}</Text>
            <Text style={styles.meta}>Scheduled {formatDate(review.scheduledAt)}</Text>
          </Card>
        </Pressable>
      ))}
      {!program.reviews.length ? <Empty text="Schedule the first management review from the governed web workspace." /> : null}
    </>
  );
}

function CertificationReviewDetail({
  review,
  workspace,
  onBack,
  ownerKey,
  online,
  onQueued,
  onSync,
}: {
  review: MobileCertificationReview;
  workspace: MobileBootstrap;
  onBack: () => void;
} & SharedProps) {
  const [values, setValues] = useState({
    attendees: review.attendees ?? "",
    auditResultsSummary: review.auditResultsSummary ?? "",
    complianceStatusSummary: review.complianceStatusSummary ?? "",
    objectivesPerformance: review.objectivesPerformance ?? "",
    stakeholderFeedback: review.stakeholderFeedback ?? "",
    changesInContext: review.changesInContext ?? "",
    risksAndOpportunities: review.risksAndOpportunities ?? "",
    resourceAdequacy: review.resourceAdequacy ?? "",
    decisions: review.decisions ?? "",
    improvementOpportunities: review.improvementOpportunities ?? "",
    nextReviewAt: review.nextReviewAt ? inputDate(review.nextReviewAt) : "",
  });
  const [conclusion, setConclusion] =
    useState<CertificationReviewCompletePayload["conclusion"]>(
      review.conclusion ?? "NEEDS_IMPROVEMENT"
    );
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [error, setError] = useState("");
  const canManage =
    workspace.behaviorAssuranceCapabilities.canManageCertification;
  const requiredKeys = [
    "auditResultsSummary",
    "complianceStatusSummary",
    "objectivesPerformance",
    "risksAndOpportunities",
    "resourceAdequacy",
    "decisions",
    "improvementOpportunities",
  ] as const;
  const update = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const complete = async () => {
    setError("");
    try {
      const missing = requiredKeys.find((key) => values[key].trim().length < 2);
      if (missing) throw new Error(`${humanize(missing)} is required.`);
      const customForms = buildCapturedForms(workspace.certificationForms, answers);
      await queueCertificationReviewComplete(
        ownerKey,
        {
          reviewId: review.id,
          attendees: values.attendees.trim() || undefined,
          auditResultsSummary: values.auditResultsSummary.trim(),
          complianceStatusSummary: values.complianceStatusSummary.trim(),
          objectivesPerformance: values.objectivesPerformance.trim(),
          stakeholderFeedback: values.stakeholderFeedback.trim() || undefined,
          changesInContext: values.changesInContext.trim() || undefined,
          risksAndOpportunities: values.risksAndOpportunities.trim(),
          resourceAdequacy: values.resourceAdequacy.trim(),
          decisions: values.decisions.trim(),
          improvementOpportunities: values.improvementOpportunities.trim(),
          conclusion,
          nextReviewAt: asIso(values.nextReviewAt, "Next review date"),
          customForms,
        },
        evidence
      );
      await queuedNotice(online, "Management-review completion", onQueued);
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  const approve = async () => {
    setError("");
    try {
      await queueCertificationReviewApprove(ownerKey, { reviewId: review.id });
      await queuedNotice(online, "Management-review approval", onQueued);
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  return (
    <>
      <Back label="Certification program" onPress={onBack} />
      <HeadingRow reference={review.reference} status={review.status} />
      <Text style={styles.pageTitle}>{review.title}</Text>
      <Text style={styles.muted}>
        {formatDate(review.periodStart)}–{formatDate(review.periodEnd)} · Chair {review.chair.name}
      </Text>
      <Card>
        <Detail label="Scheduled" value={formatDate(review.scheduledAt)} />
        <Detail label="Readiness at completion" value={review.readinessScore === null ? "Not recorded" : `${review.readinessScore}%`} />
        <Detail label="Decision actions" value={`${review.actionCount}`} />
        <Detail label="Approved by" value={review.approvedBy?.name ?? "Pending"} />
      </Card>
      {review.decisions ? <Card><Detail label="Decisions" value={review.decisions} /><Detail label="Conclusion" value={humanize(review.conclusion ?? "NOT_RECORDED")} /></Card> : null}
      {canManage && review.canComplete ? (
        <Section title="Complete management review">
          <Field label="Attendees">
            <Input value={values.attendees} onChangeText={(value) => update("attendees", value)} multiline />
          </Field>
          {([
            ["auditResultsSummary", "Audit results summary"],
            ["complianceStatusSummary", "Compliance status"],
            ["objectivesPerformance", "Objectives performance"],
            ["stakeholderFeedback", "Stakeholder feedback"],
            ["changesInContext", "Changes in context"],
            ["risksAndOpportunities", "Risks and opportunities"],
            ["resourceAdequacy", "Resource adequacy"],
            ["decisions", "Leadership decisions"],
            ["improvementOpportunities", "Improvement opportunities"],
          ] as Array<[keyof typeof values, string]>).map(([key, label]) => (
            <Field key={key} label={`${label}${requiredKeys.includes(key as typeof requiredKeys[number]) ? " *" : ""}`}>
              <Input value={values[key]} onChangeText={(value) => update(key, value)} multiline />
            </Field>
          ))}
          <Field label="Management-system conclusion">
            <ChipGroup
              values={conclusions.map((value) => ({ value, label: humanize(value) }))}
              selected={conclusion}
              onSelect={(value) => setConclusion(value as CertificationReviewCompletePayload["conclusion"])}
            />
          </Field>
          <Field label="Next management review *">
            <Input value={values.nextReviewAt} onChangeText={(value) => update("nextReviewAt", value)} placeholder="YYYY-MM-DDTHH:mm" />
          </Field>
          <EvidencePicker value={evidence} onChange={setEvidence} label="Management-review evidence" />
          {workspace.certificationForms.map((form) => (
            <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />
          ))}
          <Primary label={online ? "Complete and synchronize" : "Complete offline"} onPress={() => void complete()} />
        </Section>
      ) : null}
      {canManage && review.canApprove ? (
        <Section title="Formal approval">
          <Text style={styles.muted}>
            Approval confirms accountable human review of the recorded inputs.
            It does not claim external certification.
          </Text>
          <Primary label={online ? "Approve and synchronize" : "Queue approval offline"} onPress={() => void approve()} />
        </Section>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

function EvidencePicker({
  value,
  onChange,
  label,
}: {
  value: SelectedEvidence[];
  onChange: (value: SelectedEvidence[]) => void;
  label: string;
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
            ? await pickPhotoEvidence(MAX_EVIDENCE_FILES_PER_RECORD - value.length)
            : await pickEvidenceFiles();
      if (value.length + selected.length > MAX_EVIDENCE_FILES_PER_RECORD) {
        throw new Error(`Attach no more than ${MAX_EVIDENCE_FILES_PER_RECORD} files.`);
      }
      onChange([...value, ...selected]);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.evidence}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldHelp}>
        Evidence bytes are encrypted locally and uploaded privately after the
        governed parent record synchronizes.
      </Text>
      <View style={styles.row}>
        <Secondary label={busy ? "Opening…" : "Take photo"} disabled={busy} onPress={() => void add("camera")} />
        <Secondary label="Choose photos" disabled={busy} onPress={() => void add("photos")} />
        <Secondary label="Choose document" disabled={busy} onPress={() => void add("files")} />
      </View>
      {value.map((file) => (
        <View key={file.id} style={styles.fileRow}>
          <Text style={styles.fileName} numberOfLines={1}>{file.fileName}</Text>
          <Pressable onPress={() => onChange(value.filter((item) => item.id !== file.id))}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
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
    <Card>
      <Text style={styles.cardTitle}>{form.name}</Text>
      {form.version.instructions ? <Text style={styles.muted}>{form.version.instructions}</Text> : null}
      {form.version.fields
        .filter((field) => visible(field, form, answers))
        .map((field) => (
          <DynamicField
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={(value) =>
              setAnswers((current) => ({ ...current, [field.id]: value }))
            }
          />
        ))}
    </Card>
  );
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: RuntimeField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
}) {
  const options = Array.isArray(field.options)
    ? field.options.filter((item): item is string => typeof item === "string")
    : [];
  if (field.fieldType === "FILE") {
    return (
      <Field label={`${field.label}${field.isRequired ? " *" : ""}`}>
        <Text style={styles.fieldHelp}>
          Attach supporting files using the secure evidence picker for this record.
        </Text>
      </Field>
    );
  }
  if (field.fieldType === "BOOLEAN") {
    return (
      <Check
        checked={value === true}
        label={`${field.label}${field.isRequired ? " *" : ""}`}
        onPress={() => onChange(value !== true)}
      />
    );
  }
  if (field.fieldType === "SINGLE_SELECT") {
    return (
      <Field label={`${field.label}${field.isRequired ? " *" : ""}`}>
        <ChipGroup
          values={options.map((option) => ({ value: option, label: option }))}
          selected={typeof value === "string" ? value : ""}
          onSelect={onChange}
        />
      </Field>
    );
  }
  if (field.fieldType === "MULTI_SELECT") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <Field label={`${field.label}${field.isRequired ? " *" : ""}`}>
        <View style={styles.chips}>
          {options.map((option) => (
            <Chip
              key={option}
              label={option}
              active={selected.includes(option)}
              onPress={() =>
                onChange(
                  selected.includes(option)
                    ? selected.filter((item) => item !== option)
                    : [...selected, option]
                )
              }
            />
          ))}
        </View>
      </Field>
    );
  }
  return (
    <Field label={`${field.label}${field.isRequired ? " *" : ""}`}>
      <Input
        value={typeof value === "string" ? value : ""}
        onChangeText={onChange}
        placeholder={field.placeholder || "Enter a response"}
        multiline={field.fieldType === "LONG_TEXT"}
        keyboardType={field.fieldType === "NUMBER" ? "decimal-pad" : "default"}
      />
    </Field>
  );
}

function buildCapturedForms(
  forms: RuntimeForm[],
  answers: Record<string, FieldValue>
): CapturedForm[] {
  return forms.map((form) => {
    const captured: CapturedAnswer[] = [];
    for (const field of form.version.fields) {
      if (!visible(field, form, answers) || field.fieldType === "FILE") continue;
      const value = answers[field.id];
      const empty =
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      if (
        field.isRequired &&
        (empty || (field.fieldType === "BOOLEAN" && value !== true))
      ) {
        throw new Error(`${field.label} is required.`);
      }
      if (empty) continue;
      if (field.fieldType === "NUMBER") {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error(`${field.label} must be a valid number.`);
        captured.push({ fieldId: field.id, value: number });
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

function visible(
  field: RuntimeField,
  form: RuntimeForm,
  answers: Record<string, FieldValue>
) {
  const rule = field.visibilityRule;
  if (!rule || Array.isArray(rule) || typeof rule !== "object") return true;
  const value = rule as {
    fieldKey?: unknown;
    operator?: unknown;
    value?: unknown;
  };
  if (
    typeof value.fieldKey !== "string" ||
    value.operator !== "EQUALS" ||
    typeof value.value !== "string"
  ) return true;
  const controlling = form.version.fields.find(
    (item) => item.key === value.fieldKey
  );
  const actual = controlling ? answers[controlling.id] : undefined;
  return Array.isArray(actual)
    ? actual.includes(value.value)
    : String(actual ?? "") === value.value;
}

function PersonPicker({
  people,
  selected,
  onSelect,
  allowNone = false,
}: {
  people: Array<{ id: string; name: string }>;
  selected: string;
  onSelect: (id: string) => void;
  allowNone?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {allowNone ? <Chip label="None" active={!selected} onPress={() => onSelect("")} /> : null}
      {people.map((person) => (
        <Chip
          key={person.id}
          label={person.name}
          active={selected === person.id}
          onPress={() => onSelect(person.id)}
        />
      ))}
    </View>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentInner}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <>
      <Back label="Workspace" onPress={onBack} />
      <Text style={styles.eyebrow}>PREVENTION & ASSURANCE</Text>
      <Text style={styles.pageTitle}>{title}</Text>
    </>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return <View style={[styles.card, accent && styles.cardAccent]}>{children}</View>;
}
function Summary({ children }: { children: React.ReactNode }) {
  return <View style={styles.summary}>{children}</View>;
}
function SummaryItem({ label, value, suffix = "", alert = false }: { label: string; value: number; suffix?: string; alert?: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, alert && styles.alert]}>{value}{suffix}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}
function HeadingRow({ reference, status }: { reference: string; status: string }) {
  return (
    <View style={styles.headingRow}>
      <Text style={styles.reference}>{reference}</Text>
      <Status value={status} />
    </View>
  );
}
function Status({ value }: { value: string }) {
  const warning = /FAILED|AT_RISK|CRITICAL|OVERDUE|NOT_READY|NOT_EFFECTIVE/.test(value);
  const good = /ACTIVE|SAFE|EFFECTIVE|APPROVED|READY_FOR/.test(value) && !warning;
  return (
    <View style={[styles.status, warning ? styles.statusBad : good ? styles.statusGood : styles.statusNeutral]}>
      <Text style={styles.statusText}>{humanize(value)}</Text>
    </View>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <View style={styles.progress}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}
function ChipGroup({ values, selected, onSelect }: { values: Array<{ value: string; label: string }>; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.chips}>
      {values.map((item) => (
        <Chip key={item.value || "__none"} label={item.label} active={selected === item.value} onPress={() => onSelect(item.value)} />
      ))}
    </View>
  );
}
function Check({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.check} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
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
function Primary({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.primary, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}
function Secondary({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.secondary, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}
function Back({ label, onPress }: { label: string; onPress: () => void }) {
  return <Secondary label={`← ${label}`} onPress={onPress} />;
}
function Banner({ text }: { text: string }) {
  return <View style={styles.banner}><Text style={styles.bannerText}>{text}</Text></View>;
}
function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>;
}
async function queuedNotice(
  online: boolean,
  label: string,
  onQueued: (message: string) => Promise<void>
) {
  await onQueued(
    online
      ? `${label} queued. Synchronizing now…`
      : `${label} saved offline and will synchronize when connectivity returns.`
  );
}
function nowInput() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function inputDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function asIso(value: string, label: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return date.toISOString();
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, backgroundColor: "#07111f" },
  contentInner: { padding: 20, paddingBottom: 120, gap: 14 },
  eyebrow: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  pageTitle: { color: "#f8fafc", fontSize: 29, lineHeight: 36, fontWeight: "800" },
  sectionTitle: { color: "#e2e8f0", fontSize: 19, lineHeight: 25, fontWeight: "800", marginTop: 6 },
  muted: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  meta: { color: "#67e8f9", fontSize: 12, lineHeight: 18 },
  good: { color: "#6ee7b7", fontSize: 12, lineHeight: 18 },
  alert: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
  card: { gap: 8, padding: 17, borderRadius: 18, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43" },
  cardAccent: { borderColor: "#22d3ee" },
  cardTitle: { color: "#f8fafc", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  reference: { flex: 1, color: "#67e8f9", fontSize: 11, lineHeight: 16, fontWeight: "800", letterSpacing: 1 },
  status: { maxWidth: "58%", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusGood: { backgroundColor: "#064e3b" },
  statusBad: { backgroundColor: "#7f1d1d" },
  statusNeutral: { backgroundColor: "#1e3a5f" },
  statusText: { color: "#f8fafc", fontSize: 10, fontWeight: "800" },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  summaryItem: { flexGrow: 1, minWidth: 98, minHeight: 88, justifyContent: "space-between", padding: 14, borderRadius: 16, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43" },
  summaryValue: { color: "#f8fafc", fontSize: 26, fontWeight: "900" },
  summaryLabel: { color: "#94a3b8", fontSize: 11, lineHeight: 15 },
  section: { gap: 11, padding: 17, borderRadius: 20, backgroundColor: "#0a1728", borderWidth: 1, borderColor: "#23405d" },
  field: { gap: 7 },
  fieldLabel: { color: "#dbeafe", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  fieldHelp: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", color: "#f8fafc", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", paddingHorizontal: 13, paddingVertical: 9 },
  chipOn: { borderColor: "#67e8f9", backgroundColor: "#123047" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  chipTextOn: { color: "#cffafe" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  check: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 5 },
  checkbox: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 7, borderWidth: 1, borderColor: "#334155" },
  checkboxOn: { backgroundColor: "#22d3ee", borderColor: "#22d3ee" },
  checkmark: { color: "#07111f", fontWeight: "900" },
  checkLabel: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 18 },
  primary: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#67e8f9", paddingHorizontal: 16 },
  primaryText: { color: "#07111f", fontSize: 14, fontWeight: "900" },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "#2d4964", paddingHorizontal: 14 },
  secondaryText: { color: "#bae6fd", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  banner: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#f59e0b55", backgroundColor: "#78350f33" },
  bannerText: { color: "#fde68a", fontSize: 13, lineHeight: 19 },
  empty: { padding: 24, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "#334155" },
  detail: { gap: 3, paddingVertical: 3 },
  detailLabel: { color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  detailValue: { color: "#dbeafe", fontSize: 13, lineHeight: 19 },
  progress: { height: 7, borderRadius: 999, overflow: "hidden", backgroundColor: "#1e293b" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#22d3ee" },
  evidence: { gap: 8, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 9 },
  fileName: { flex: 1, color: "#dbeafe", fontSize: 12, fontWeight: "700" },
  remove: { color: "#fda4af", fontSize: 12, fontWeight: "800" },
});
