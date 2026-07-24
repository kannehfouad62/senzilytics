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
  queueHygieneAssessmentStatus,
  queueHygieneForms,
  queueHygieneSample,
  queueSurveillanceCompletion,
  queueSurveillanceEnrollment,
  queueSurveillanceProgramStatus,
  queueSurveillanceRemoval,
} from "./storage";
import type {
  CapturedAnswer,
  CapturedForm,
  MobileBootstrap,
  MobileExposureAssessment,
  MobileSurveillanceProgram,
  RuntimeField,
  RuntimeForm,
  SurveillanceCompletionPayload,
} from "./types";

export type HygieneHealthView = "hygiene" | "health";

type FieldValue = string | boolean | string[];
type SharedProps = {
  ownerKey: string;
  online: boolean;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
  onSaved: () => void;
};

export function HygieneHealthScreen({
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
  initialView: HygieneHealthView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const capabilities = workspace.hygieneHealthCapabilities;
  const assessments = workspace.exposureAssessments ?? [];
  const programs = workspace.surveillancePrograms ?? [];
  const assessment = assessments.find((item) => item.id === assessmentId);
  const program = programs.find((item) => item.id === programId);
  const shared: SharedProps = {
    ownerKey,
    online,
    onQueued,
    onSync,
    onSaved: () => {
      setAssessmentId(null);
      setProgramId(null);
    },
  };

  if (assessment) {
    return (
      <AssessmentDetail
        assessment={assessment}
        workspace={workspace}
        canManage={capabilities.canManageIndustrialHygiene}
        forms={(workspace.industrialHygieneForms ?? []).filter((form) =>
          assessment.missingFormDefinitionIds.includes(form.id)
        )}
        onBack={() => setAssessmentId(null)}
        {...shared}
      />
    );
  }
  if (program) {
    return (
      <ProgramDetail
        program={program}
        workspace={workspace}
        canManage={capabilities.canManageOccupationalHealth}
        onBack={() => setProgramId(null)}
        {...shared}
      />
    );
  }

  const availableViews = [
    ...(capabilities.canViewIndustrialHygiene
      ? [{ value: "hygiene" as const, label: "Industrial Hygiene" }]
      : []),
    ...(capabilities.canViewOccupationalHealth
      ? [{ value: "health" as const, label: "Occupational Health" }]
      : []),
  ];
  if (!availableViews.length) {
    return (
      <Page>
        <Header eyebrow="EXPOSURE & HEALTH" title="Access restricted" onBack={onBack} />
        <Empty text="Your role does not include Industrial Hygiene or Occupational Health access." />
      </Page>
    );
  }
  const activeView = availableViews.some((item) => item.value === view)
    ? view
    : availableViews[0].value;
  const normalized = query.trim().toLowerCase();

  return (
    <Page>
      <Header eyebrow="WORKER PROTECTION" title="Exposure & health" onBack={onBack} />
      {availableViews.length > 1 ? (
        <View style={styles.chips}>
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
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Authorized records remain encrypted on this device and synchronize
            idempotently when connectivity returns.
          </Text>
        </View>
      ) : null}
      {activeView === "hygiene" ? (
        <HygieneList
          assessments={assessments.filter((item) =>
            !normalized ||
            `${item.reference} ${item.title} ${item.site.name} ${item.group.name}`
              .toLowerCase()
              .includes(normalized)
          )}
          query={query}
          setQuery={setQuery}
          onSelect={setAssessmentId}
        />
      ) : (
        <HealthList
          programs={programs.filter((item) =>
            !normalized ||
            `${item.name} ${item.agent?.name ?? ""} ${item.group?.name ?? ""}`
              .toLowerCase()
              .includes(normalized)
          )}
          query={query}
          setQuery={setQuery}
          onSelect={setProgramId}
          managed={capabilities.canManageOccupationalHealth}
        />
      )}
    </Page>
  );
}

function HygieneList({
  assessments,
  query,
  setQuery,
  onSelect,
}: {
  assessments: MobileExposureAssessment[];
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const open = assessments.filter(
    (item) => !["COMPLETED", "CANCELLED"].includes(item.status)
  ).length;
  const exceedances = assessments.reduce(
    (count, item) =>
      count +
      item.samples.filter((sample) => sample.classification === "ABOVE_LIMIT")
        .length,
    0
  );
  return (
    <>
      <Text style={styles.muted}>
        Review similar exposure groups, exposure limits, samples, field
        controls, and governed assessment readiness.
      </Text>
      <Summary>
        <SummaryItem label="Open" value={open} />
        <SummaryItem label="Assessments" value={assessments.length} />
        <SummaryItem label="Above limit" value={exceedances} alert={exceedances > 0} />
      </Summary>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search assessments, sites, or groups"
      />
      {assessments.map((assessment) => (
        <Pressable key={assessment.id} onPress={() => onSelect(assessment.id)}>
          <Card accent={assessment.samples.some((sample) => sample.classification === "ABOVE_LIMIT")}>
            <View style={styles.cardHeading}>
              <Text style={styles.reference}>{assessment.reference}</Text>
              <Status status={assessment.status} />
            </View>
            <Text style={styles.cardTitle}>{assessment.title}</Text>
            <Text style={styles.muted}>
              {assessment.site.name} · {assessment.group.name}
            </Text>
            <Text style={styles.meta}>
              {assessment.samples.length} sample{assessment.samples.length === 1 ? "" : "s"}
              {assessment.dueDate ? ` · Due ${formatDate(assessment.dueDate)}` : ""}
            </Text>
          </Card>
        </Pressable>
      ))}
      {!assessments.length ? <Empty text="No exposure assessments match this view." /> : null}
    </>
  );
}

function HealthList({
  programs,
  query,
  setQuery,
  onSelect,
  managed,
}: {
  programs: MobileSurveillanceProgram[];
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
  managed: boolean;
}) {
  const overdue = programs.reduce(
    (count, item) =>
      count + item.enrollments.filter((enrollment) => enrollment.status === "OVERDUE").length,
    0
  );
  const due = programs.reduce(
    (count, item) =>
      count + item.enrollments.filter((enrollment) => enrollment.status === "DUE").length,
    0
  );
  return (
    <>
      <PrivacyNotice managed={managed} />
      <Summary>
        <SummaryItem label="Programs" value={programs.length} />
        <SummaryItem label="Due" value={due} alert={due > 0} />
        <SummaryItem label="Overdue" value={overdue} alert={overdue > 0} />
      </Summary>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search surveillance programs"
      />
      {programs.map((program) => (
        <Pressable key={program.id} onPress={() => onSelect(program.id)}>
          <Card accent={program.enrollments.some((item) => item.status === "OVERDUE")}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>{program.name}</Text>
              <Status status={program.status} />
            </View>
            <Text style={styles.muted}>
              {program.agent?.name || program.group?.name || "General surveillance"}
            </Text>
            <Text style={styles.meta}>
              {program.enrollments.length} visible enrollment
              {program.enrollments.length === 1 ? "" : "s"} · Every {program.frequencyMonths} month
              {program.frequencyMonths === 1 ? "" : "s"}
            </Text>
          </Card>
        </Pressable>
      ))}
      {!programs.length ? <Empty text="No surveillance programs are available to you." /> : null}
    </>
  );
}

function AssessmentDetail({
  assessment,
  workspace,
  forms,
  canManage,
  onBack,
  ...shared
}: {
  assessment: MobileExposureAssessment;
  workspace: MobileBootstrap;
  forms: RuntimeForm[];
  canManage: boolean;
  onBack: () => void;
} & SharedProps) {
  return (
    <Page>
      <Header eyebrow={assessment.reference} title={assessment.title} onBack={onBack} />
      <View style={styles.cardHeading}>
        <Status status={assessment.status} />
        <Text style={styles.meta}>
          {assessment.isAssignedToCurrentUser ? "Assigned to you" : assessment.assessor?.name || "Unassigned"}
        </Text>
      </View>
      <Card>
        <Detail label="Site" value={assessment.site.name} />
        <Detail label="Department" value={assessment.department?.name || "Not assigned"} />
        <Detail label="Exposure group" value={assessment.group.name} />
        <Detail label="Scope" value={assessment.scope || "Not recorded"} />
        <Detail label="Sampling plan" value={assessment.samplingPlan || "Not recorded"} />
        <Detail label="Existing controls" value={assessment.group.existingControls || "Not recorded"} />
        <Detail label="Required PPE" value={assessment.group.requiredPpe || "Not recorded"} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Exposure agents and limits</Text>
        {assessment.group.agents.map(({ agent }) => (
          <View key={agent.id} style={styles.listItem}>
            <Text style={styles.detailValue}>{agent.name} · {humanize(agent.category)}</Text>
            <Text style={styles.meta}>
              OEL {formatLimit(agent.occupationalLimit, agent.unit)} · Action {formatLimit(agent.actionLevel, agent.unit)}
            </Text>
            {agent.exposureRoutes ? <Text style={styles.muted}>Routes: {agent.exposureRoutes}</Text> : null}
            {agent.healthEffects ? <Text style={styles.warning}>Health effects: {agent.healthEffects}</Text> : null}
            {agent.requiresSurveillance ? <Text style={styles.success}>Medical surveillance indicated</Text> : null}
          </View>
        ))}
      </Card>
      {canManage && assessment.status === "IN_PROGRESS" ? (
        <SampleAction assessment={assessment} workspace={workspace} {...shared} />
      ) : null}
      <Card accent={assessment.samples.some((sample) => sample.classification === "ABOVE_LIMIT")}>
        <Text style={styles.cardTitle}>Exposure samples</Text>
        {assessment.samples.map((sample) => (
          <View key={sample.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>{sample.agent.name}</Text>
              <Status status={sample.classification} />
            </View>
            <Text style={styles.meta}>
              {humanize(sample.sampleType)} · {formatDateTime(sample.sampledAt)}
              {sample.sampledWorker ? ` · ${sample.sampledWorker.name}` : ""}
            </Text>
            <Text style={styles.detailValue}>
              Result {sample.resultValue === null ? "pending" : `${sample.resultValue} ${sample.unit || ""}`}
              {sample.exposureRatio === null ? "" : ` · ${sample.exposureRatio.toFixed(2)}× limit`}
            </Text>
            {sample.notes ? <Text style={styles.muted}>{sample.notes}</Text> : null}
          </View>
        ))}
        {!assessment.samples.length ? <Text style={styles.muted}>No samples recorded.</Text> : null}
      </Card>
      {canManage && forms.length ? (
        <HygieneFormsAction assessment={assessment} forms={forms} {...shared} />
      ) : null}
      {canManage && assessment.nextStatuses.length ? (
        <AssessmentStatusAction assessment={assessment} {...shared} />
      ) : null}
    </Page>
  );
}

function SampleAction({
  assessment,
  workspace,
  ...shared
}: {
  assessment: MobileExposureAssessment;
  workspace: MobileBootstrap;
} & SharedProps) {
  const agents = assessment.group.agents.map((item) => item.agent);
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [sampleType, setSampleType] =
    useState<"PERSONAL" | "AREA" | "TASK" | "DIRECT_READING" | "WIPE">("PERSONAL");
  const [sampleReference, setSampleReference] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [location, setLocation] = useState("");
  const [task, setTask] = useState("");
  const [duration, setDuration] = useState("");
  const [result, setResult] = useState("");
  const [reportingLimit, setReportingLimit] = useState("");
  const [unit, setUnit] = useState("");
  const [laboratory, setLaboratory] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const agent = agents.find((item) => item.id === agentId);

  const save = async () => {
    setError("");
    const durationValue = optionalNumber(duration);
    const resultValue = optionalNumber(result);
    const reportingValue = optionalNumber(reportingLimit);
    if (!agentId) return setError("Select an exposure agent.");
    if (
      [durationValue, resultValue, reportingValue].some(
        (value) => value !== undefined && !Number.isFinite(value)
      )
    ) {
      return setError("Duration, result, and reporting limit must be valid numbers.");
    }
    if (duration && (!Number.isInteger(durationValue) || (durationValue ?? 0) <= 0)) {
      return setError("Duration must be a positive whole number.");
    }
    if ([resultValue, reportingValue].some((value) => value !== undefined && value < 0)) {
      return setError("Sample results and limits cannot be negative.");
    }
    if (resultValue !== undefined && !(unit.trim() || agent?.unit)) {
      return setError("Record the unit used by the sample result.");
    }
    setBusy(true);
    try {
      await queueHygieneSample(
        shared.ownerKey,
        {
          assessmentId: assessment.id,
          agentId,
          sampleType,
          sampleReference: sampleReference.trim() || undefined,
          sampledWorkerId: workerId || undefined,
          location: location.trim() || undefined,
          task: task.trim() || undefined,
          sampledAt: new Date().toISOString(),
          durationMinutes: durationValue,
          resultValue,
          reportingLimit: reportingValue,
          occupationalLimit: agent?.occupationalLimit ?? undefined,
          actionLevel: agent?.actionLevel ?? undefined,
          unit: unit.trim() || agent?.unit || undefined,
          laboratory: laboratory.trim() || undefined,
          analyticalMethod: method.trim() || agent?.analyticalMethod || undefined,
          notes: notes.trim() || undefined,
        },
        evidence
      );
      await queued(shared, "Exposure sample");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card accent>
      <Text style={styles.cardTitle}>Record exposure sample</Text>
      <Text style={styles.muted}>
        Capture objective field and laboratory data. Named-worker details are
        protected from non-manager mobile views.
      </Text>
      <Text style={styles.label}>Agent *</Text>
      <View style={styles.chips}>
        {agents.map((item) => (
          <Chip key={item.id} label={item.name} active={agentId === item.id} onPress={() => setAgentId(item.id)} />
        ))}
      </View>
      <Text style={styles.label}>Sample type</Text>
      <View style={styles.chips}>
        {(["PERSONAL", "AREA", "TASK", "DIRECT_READING", "WIPE"] as const).map((value) => (
          <Chip key={value} label={humanize(value)} active={sampleType === value} onPress={() => setSampleType(value)} />
        ))}
      </View>
      <Input value={sampleReference} onChangeText={setSampleReference} placeholder="Sample or chain-of-custody reference" />
      <Text style={styles.label}>Sampled worker (optional)</Text>
      <View style={styles.chips}>
        <Chip label="No named worker" active={!workerId} onPress={() => setWorkerId("")} />
        {(workspace.hygieneHealthPeople ?? []).map((person) => (
          <Chip key={person.id} label={person.name} active={workerId === person.id} onPress={() => setWorkerId(person.id)} />
        ))}
      </View>
      <Input value={location} onChangeText={setLocation} placeholder="Sampling location" />
      <Input value={task} onChangeText={setTask} placeholder="Task or activity" />
      <Input value={duration} onChangeText={setDuration} placeholder="Duration in minutes" keyboardType="number-pad" />
      <Input value={result} onChangeText={setResult} placeholder="Result (leave blank if pending)" keyboardType="decimal-pad" />
      <Input value={reportingLimit} onChangeText={setReportingLimit} placeholder="Reporting limit" keyboardType="decimal-pad" />
      <Input value={unit} onChangeText={setUnit} placeholder={agent?.unit ? `Unit (${agent.unit})` : "Result unit"} />
      <Input value={laboratory} onChangeText={setLaboratory} placeholder="Laboratory" />
      <Input value={method} onChangeText={setMethod} placeholder={agent?.analyticalMethod || "Analytical method"} />
      <Input value={notes} onChangeText={setNotes} placeholder="Objective sampling notes" multiline />
      <EvidencePicker value={evidence} onChange={setEvidence} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? "Saving securely…" : shared.online ? "Record and sync" : "Save sample offline"}
        disabled={busy}
        onPress={save}
      />
    </Card>
  );
}

function AssessmentStatusAction({
  assessment,
  ...shared
}: { assessment: MobileExposureAssessment } & SharedProps) {
  const [status, setStatus] = useState(assessment.nextStatuses[0]);
  const [observations, setObservations] = useState(assessment.observations || "");
  const [conclusions, setConclusions] = useState(assessment.conclusions || "");
  const [recommendations, setRecommendations] = useState(assessment.recommendations || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (status === "COMPLETED" && conclusions.trim().length < 2) {
      return setError("Record assessment conclusions before completion.");
    }
    setBusy(true);
    try {
      await queueHygieneAssessmentStatus(shared.ownerKey, {
        assessmentId: assessment.id,
        status,
        observations: observations.trim() || undefined,
        conclusions: conclusions.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
      });
      await queued(shared, "Assessment lifecycle update");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Assessment lifecycle</Text>
      <View style={styles.chips}>
        {assessment.nextStatuses.map((value) => (
          <Chip key={value} label={humanize(value)} active={status === value} onPress={() => setStatus(value)} />
        ))}
      </View>
      <Input value={observations} onChangeText={setObservations} placeholder="Objective observations" multiline />
      <Input value={conclusions} onChangeText={setConclusions} placeholder="Assessment conclusions" multiline />
      <Input value={recommendations} onChangeText={setRecommendations} placeholder="Control recommendations" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? "Saving securely…" : shared.online ? "Apply and sync" : "Save lifecycle offline"}
        disabled={busy}
        onPress={save}
      />
    </Card>
  );
}

function HygieneFormsAction({
  assessment,
  forms,
  ...shared
}: {
  assessment: MobileExposureAssessment;
  forms: RuntimeForm[];
} & SharedProps) {
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    let customForms: CapturedForm[];
    try {
      customForms = buildCapturedForms(forms, answers);
    } catch (reason) {
      return setError(messageOf(reason));
    }
    setBusy(true);
    try {
      await queueHygieneForms(shared.ownerKey, {
        assessmentId: assessment.id,
        customForms,
      });
      await queued(shared, "Industrial hygiene forms");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Required assessment forms</Text>
      {forms.map((form) => (
        <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? "Saving securely…" : "Save required forms"} disabled={busy} onPress={save} />
    </Card>
  );
}

function ProgramDetail({
  program,
  workspace,
  canManage,
  onBack,
  ...shared
}: {
  program: MobileSurveillanceProgram;
  workspace: MobileBootstrap;
  canManage: boolean;
  onBack: () => void;
} & SharedProps) {
  return (
    <Page>
      <Header eyebrow="OCCUPATIONAL HEALTH" title={program.name} onBack={onBack} />
      <PrivacyNotice managed={canManage} />
      <View style={styles.cardHeading}>
        <Status status={program.status} />
        <Text style={styles.meta}>{program.responsibleUser.name}</Text>
      </View>
      <Card>
        <Detail label="Basis" value={program.regulatoryBasis || "Not recorded"} />
        <Detail label="Protocol" value={program.protocolReference || "Not recorded"} />
        <Detail label="Provider" value={program.providerName || "Not recorded"} />
        <Detail label="Exposure agent" value={program.agent?.name || "Not linked"} />
        <Detail label="Exposure group" value={program.group?.name || "Not linked"} />
        <Detail label="Frequency" value={`Every ${program.frequencyMonths} month${program.frequencyMonths === 1 ? "" : "s"}`} />
      </Card>
      <Card accent={program.enrollments.some((item) => item.status === "OVERDUE")}>
        <Text style={styles.cardTitle}>{canManage ? "Worker readiness" : "My surveillance milestones"}</Text>
        {program.enrollments.map((enrollment) => (
          <View key={enrollment.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>{enrollment.user.name}</Text>
              <Status status={enrollment.status} />
            </View>
            <Text style={styles.meta}>Next due {formatDate(enrollment.nextDueAt)}</Text>
            {enrollment.lastCompletedAt ? (
              <Text style={styles.success}>
                Last completed {formatDate(enrollment.lastCompletedAt)} · {humanize(enrollment.fitnessOutcome)}
              </Text>
            ) : null}
            {enrollment.workRestrictions ? (
              <Text style={styles.warning}>Provider work restrictions: {enrollment.workRestrictions}</Text>
            ) : null}
            {enrollment.certificateReference ? (
              <Text style={styles.meta}>Certificate reference: {enrollment.certificateReference}</Text>
            ) : null}
            {canManage && enrollment.status !== "REMOVED" ? (
              <EnrollmentActions enrollment={enrollment} {...shared} />
            ) : null}
          </View>
        ))}
        {!program.enrollments.length ? <Text style={styles.muted}>No visible enrollments.</Text> : null}
      </Card>
      {canManage ? <EnrollAction program={program} workspace={workspace} {...shared} /> : null}
      {canManage && program.nextStatuses.length ? (
        <ProgramStatusAction program={program} {...shared} />
      ) : null}
    </Page>
  );
}

function EnrollAction({
  program,
  workspace,
  ...shared
}: {
  program: MobileSurveillanceProgram;
  workspace: MobileBootstrap;
} & SharedProps) {
  const activeUserIds = new Set(
    program.enrollments
      .filter((item) => item.status !== "REMOVED")
      .map((item) => item.user.id)
  );
  const people = (workspace.hygieneHealthPeople ?? []).filter(
    (person) => !activeUserIds.has(person.id)
  );
  const [userId, setUserId] = useState(people[0]?.id || "");
  const [nextDueAt, setNextDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (!userId || !validDate(nextDueAt)) {
      return setError("Select a worker and enter a valid YYYY-MM-DD due date.");
    }
    setBusy(true);
    try {
      await queueSurveillanceEnrollment(shared.ownerKey, {
        programId: program.id,
        enrolledUserId: userId,
        nextDueAt,
        notes: notes.trim() || undefined,
      });
      await queued(shared, "Surveillance enrollment");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Enroll worker</Text>
      <Text style={styles.muted}>
        Record administrative scheduling only. Do not enter diagnoses, symptoms,
        treatment, or clinical test results.
      </Text>
      <View style={styles.chips}>
        {people.map((person) => (
          <Chip key={person.id} label={person.name} active={userId === person.id} onPress={() => setUserId(person.id)} />
        ))}
      </View>
      {!people.length ? <Text style={styles.muted}>All active workers are already enrolled.</Text> : null}
      <Input value={nextDueAt} onChangeText={setNextDueAt} placeholder="Next due YYYY-MM-DD" autoCapitalize="none" />
      <Input value={notes} onChangeText={setNotes} placeholder="Administrative scheduling notes only" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? "Saving securely…" : shared.online ? "Enroll and sync" : "Save enrollment offline"}
        disabled={busy || !people.length}
        onPress={save}
      />
    </Card>
  );
}

function EnrollmentActions({
  enrollment,
  ...shared
}: {
  enrollment: MobileSurveillanceProgram["enrollments"][number];
} & SharedProps) {
  const [mode, setMode] = useState<"complete" | "remove">("complete");
  const [completedAt, setCompletedAt] = useState(today());
  const [outcome, setOutcome] =
    useState<SurveillanceCompletionPayload["fitnessOutcome"]>("CLEARED");
  const [restrictions, setRestrictions] = useState("");
  const [certificate, setCertificate] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "remove") {
        if (reason.trim().length < 2) {
          setBusy(false);
          return setError("Record an administrative removal reason.");
        }
        await queueSurveillanceRemoval(shared.ownerKey, {
          enrollmentId: enrollment.id,
          reason: reason.trim(),
        });
        await queued(shared, "Surveillance enrollment removal");
      } else {
        if (!validDate(completedAt) || new Date(`${completedAt}T12:00:00Z`).getTime() > Date.now()) {
          setBusy(false);
          return setError("Completion date must be a valid date that is not in the future.");
        }
        if (outcome !== "CLEARED" && restrictions.trim().length < 2) {
          setBusy(false);
          return setError("Record the provider-issued work restrictions.");
        }
        await queueSurveillanceCompletion(shared.ownerKey, {
          enrollmentId: enrollment.id,
          completedAt,
          fitnessOutcome: outcome,
          workRestrictions: restrictions.trim() || undefined,
          certificateReference: certificate.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        await queued(shared, "Fitness-for-work outcome");
      }
    } catch (reasonValue) {
      setError(messageOf(reasonValue));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.actionPanel}>
      <View style={styles.chips}>
        <Chip label="Record outcome" active={mode === "complete"} onPress={() => setMode("complete")} />
        <Chip label="Remove enrollment" active={mode === "remove"} onPress={() => setMode("remove")} />
      </View>
      {mode === "complete" ? (
        <>
          <Input value={completedAt} onChangeText={setCompletedAt} placeholder="Completed YYYY-MM-DD" autoCapitalize="none" />
          <View style={styles.chips}>
            {(["CLEARED", "CLEARED_WITH_RESTRICTIONS", "TEMPORARILY_NOT_CLEARED"] as const).map((value) => (
              <Chip key={value} label={humanize(value)} active={outcome === value} onPress={() => setOutcome(value)} />
            ))}
          </View>
          {outcome !== "CLEARED" ? (
            <Input value={restrictions} onChangeText={setRestrictions} placeholder="Provider-issued work restrictions" multiline />
          ) : null}
          <Input value={certificate} onChangeText={setCertificate} placeholder="Provider certificate reference" />
          <Input value={notes} onChangeText={setNotes} placeholder="Administrative notes only — no clinical details" multiline />
        </>
      ) : (
        <Input value={reason} onChangeText={setReason} placeholder="Administrative removal reason" multiline />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SecondaryButton
        label={busy ? "Saving securely…" : shared.online ? "Save and sync" : "Save offline"}
        disabled={busy}
        onPress={save}
      />
    </View>
  );
}

function ProgramStatusAction({
  program,
  ...shared
}: {
  program: MobileSurveillanceProgram;
} & SharedProps) {
  const [status, setStatus] = useState(program.nextStatuses[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    setBusy(true);
    try {
      await queueSurveillanceProgramStatus(shared.ownerKey, {
        programId: program.id,
        status,
      });
      await queued(shared, "Surveillance program status");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Program lifecycle</Text>
      <View style={styles.chips}>
        {program.nextStatuses.map((value) => (
          <Chip key={value} label={humanize(value)} active={status === value} onPress={() => setStatus(value)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? "Saving securely…" : "Apply program status"} disabled={busy} onPress={save} />
    </Card>
  );
}

function PrivacyNotice({ managed }: { managed: boolean }) {
  return (
    <View style={styles.privacy}>
      <Text style={styles.privacyTitle}>Privacy-controlled occupational health</Text>
      <Text style={styles.privacyText}>
        {managed
          ? "Use this workspace only for enrollment, due dates, provider-issued fitness outcomes, work restrictions, and certificate references. Never record diagnoses, symptoms, treatment, or clinical test results."
          : "You can view only your own surveillance milestones. Clinical records remain with the occupational health provider and are not displayed here."}
      </Text>
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
    <View style={styles.actionPanel}>
      <Text style={styles.label}>Sample evidence</Text>
      <Text style={styles.help}>
        Chain-of-custody records, field sheets, and photos are encrypted locally
        and uploaded privately after the sample synchronizes.
      </Text>
      <View style={styles.chips}>
        <SecondaryButton label="Take photo" disabled={busy} onPress={() => { void add("camera"); }} />
        <SecondaryButton label="Choose photos" disabled={busy} onPress={() => { void add("photos"); }} />
        <SecondaryButton label="Choose document" disabled={busy} onPress={() => { void add("files"); }} />
      </View>
      {value.map((file) => (
        <View key={file.id} style={styles.cardHeading}>
          <Text style={styles.detailValue} numberOfLines={1}>{file.fileName}</Text>
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
    <View style={styles.dynamicForm}>
      <Text style={styles.cardTitle}>{form.name}</Text>
      {form.version.instructions ? <Text style={styles.muted}>{form.version.instructions}</Text> : null}
      {form.version.fields.map((field) => {
        const options = Array.isArray(field.options)
          ? field.options.filter((item): item is string => typeof item === "string")
          : [];
        const value = answers[field.id];
        if (field.fieldType === "BOOLEAN") {
          return (
            <Check
              key={field.id}
              label={`${field.label}${field.isRequired ? " *" : ""}`}
              checked={value === true}
              onPress={() => setAnswers((current) => ({ ...current, [field.id]: value !== true }))}
            />
          );
        }
        if (field.fieldType === "SINGLE_SELECT" || field.fieldType === "MULTI_SELECT") {
          const selected = Array.isArray(value) ? value : [];
          return (
            <View key={field.id} style={styles.fieldBlock}>
              <Text style={styles.label}>{field.label}{field.isRequired ? " *" : ""}</Text>
              <View style={styles.chips}>
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
            </View>
          );
        }
        if (field.fieldType === "FILE") {
          return <Text key={field.id} style={styles.help}>{field.label}: use sample evidence above.</Text>;
        }
        return (
          <View key={field.id} style={styles.fieldBlock}>
            <Text style={styles.label}>{field.label}{field.isRequired ? " *" : ""}</Text>
            <Input
              value={typeof value === "string" ? value : ""}
              onChangeText={(next) => setAnswers((current) => ({ ...current, [field.id]: next }))}
              placeholder={field.placeholder || "Enter response"}
              multiline={field.fieldType === "LONG_TEXT"}
              keyboardType={field.fieldType === "NUMBER" ? "decimal-pad" : "default"}
            />
          </View>
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
        (Array.isArray(value) && value.length === 0);
      if (field.isRequired && (empty || (field.fieldType === "BOOLEAN" && value !== true))) {
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

async function queued(shared: SharedProps, label: string) {
  await shared.onQueued(
    shared.online
      ? `${label} queued for secure synchronization.`
      : `${label} encrypted and saved offline.`
  );
  if (shared.online) shared.onSync();
  shared.onSaved();
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
      <Pressable onPress={onBack}><Text style={styles.back}>← Field workspace</Text></Pressable>
      <Text style={styles.kicker}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return <View style={styles.summary}>{children}</View>;
}

function SummaryItem({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, alert && styles.alertText]}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Status({ status }: { status: string }) {
  const alert = ["ABOVE_LIMIT", "OVERDUE", "TEMPORARILY_NOT_CLEARED"].includes(status);
  const done = ["COMPLETED", "CLEARED", "BELOW_ACTION_LEVEL", "BELOW_DETECTION"].includes(status);
  return (
    <View style={[styles.status, alert && styles.statusAlert, done && styles.statusDone]}>
      <Text style={[styles.statusText, alert && styles.alertText, done && styles.doneText]}>
        {humanize(status)}
      </Text>
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
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Check({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.checkRow} onPress={onPress}>
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
    <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.disabled]}>
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
    <Pressable disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.disabled]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatLimit(value: number | null, unit: string | null) {
  return value === null ? "not recorded" : `${value} ${unit || ""}`.trim();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function messageOf(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "The exposure or occupational-health record could not be saved.";
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  header: { gap: 6 },
  back: { color: "#67e8f9", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  kicker: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#f8fafc", fontSize: 29, lineHeight: 36, fontWeight: "800" },
  muted: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  meta: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  label: { color: "#dbeafe", fontWeight: "700", fontSize: 13 },
  help: { color: "#64748b", fontSize: 11, lineHeight: 16 },
  warning: { color: "#fde68a", fontSize: 12, lineHeight: 18 },
  success: { color: "#6ee7b7", fontSize: 12, fontWeight: "700" },
  offlineBanner: { borderRadius: 16, borderWidth: 1, borderColor: "#f59e0b55", backgroundColor: "#78350f33", padding: 14 },
  offlineText: { color: "#fde68a", fontSize: 13, lineHeight: 19 },
  privacy: { borderRadius: 16, borderWidth: 1, borderColor: "#a78bfa66", backgroundColor: "#312e8155", padding: 14, gap: 5 },
  privacyTitle: { color: "#ddd6fe", fontSize: 14, fontWeight: "800" },
  privacyText: { color: "#c4b5fd", fontSize: 12, lineHeight: 18 },
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
  reference: { color: "#67e8f9", fontSize: 12, fontWeight: "800" },
  listItem: { gap: 7, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 11, marginTop: 3 },
  detail: { borderBottomWidth: 1, borderBottomColor: "#172a43", paddingBottom: 8, gap: 3 },
  detailValue: { flexShrink: 1, color: "#dbeafe", fontSize: 14, lineHeight: 20 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#123047", borderWidth: 1, borderColor: "#1e7494" },
  statusAlert: { backgroundColor: "#4c051933", borderColor: "#fb718555" },
  statusDone: { backgroundColor: "#064e3b44", borderColor: "#34d39955" },
  statusText: { color: "#a5f3fc", fontSize: 10, fontWeight: "800" },
  alertText: { color: "#fda4af" },
  doneText: { color: "#6ee7b7" },
  actionPanel: { gap: 8, borderRadius: 15, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", padding: 13, marginTop: 4 },
  fieldBlock: { gap: 6, marginTop: 5 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", color: "#f8fafc", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: "#67e8f9", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 7 },
  primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 },
  secondaryButton: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: "#2d4964", alignItems: "center", justifyContent: "center", paddingHorizontal: 13, marginTop: 5 },
  secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 12 },
  disabled: { opacity: 0.55 },
  empty: { borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 18, padding: 24 },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
  remove: { color: "#fda4af", fontSize: 12, fontWeight: "700" },
  dynamicForm: { gap: 8, borderTopWidth: 1, borderTopColor: "#263a55", paddingTop: 12, marginTop: 4 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 11, marginVertical: 7 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#22d3ee", borderColor: "#22d3ee" },
  checkmark: { color: "#07111f", fontWeight: "900" },
  checkLabel: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 18 },
});
