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
  queueMocApprovalDecision,
  queueMocStatus,
  queueMocTaskStatus,
  queuePermitControl,
  queuePermitGasTest,
  queuePermitStatus,
} from "./storage";
import type {
  MobileBootstrap,
  MobileManagementOfChange,
  MobileMocTaskStatus,
  MobilePermitToWork,
} from "./types";

export type MocPermitView = "moc" | "permits";

type SharedActionProps = {
  ownerKey: string;
  online: boolean;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
  onSaved: () => void;
};

export function MocPermitScreen({
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
  initialView: MocPermitView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [view, setView] = useState<MocPermitView>(initialView);
  const [query, setQuery] = useState("");
  const [selectedMocId, setSelectedMocId] = useState<string | null>(null);
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null);
  const mocs = workspace.managementOfChanges ?? [];
  const permits = workspace.permitsToWork ?? [];
  const capabilities = workspace.mocPermitCapabilities ?? {
    canViewMoc: false,
    canManageMoc: false,
    canViewPermits: false,
    canManagePermits: false,
  };
  const selectedMoc = mocs.find((item) => item.id === selectedMocId);
  const selectedPermit = permits.find((item) => item.id === selectedPermitId);
  const shared = {
    ownerKey,
    online,
    onQueued,
    onSync,
    onSaved: () => {
      setSelectedMocId(null);
      setSelectedPermitId(null);
    },
  };

  if (selectedMoc) {
    return (
      <MocDetail
        moc={selectedMoc}
        canManage={capabilities.canManageMoc}
        onBack={() => setSelectedMocId(null)}
        {...shared}
      />
    );
  }
  if (selectedPermit) {
    return (
      <PermitDetail
        permit={selectedPermit}
        canManage={capabilities.canManagePermits}
        onBack={() => setSelectedPermitId(null)}
        {...shared}
      />
    );
  }

  if (!capabilities.canViewMoc && !capabilities.canViewPermits) {
    return (
      <Page>
        <Header eyebrow="CONTROLLED WORK" title="Access restricted" onBack={onBack} />
        <Empty text="Your role does not include Management of Change or Permit-to-Work access." />
      </Page>
    );
  }

  const activeView =
    (view === "moc" && capabilities.canViewMoc) ||
    (view === "permits" && capabilities.canViewPermits)
      ? view
      : capabilities.canViewMoc
        ? "moc"
        : "permits";
  const normalized = query.trim().toLowerCase();
  const visibleMocs = mocs.filter((item) =>
    !normalized ||
    `${item.reference} ${item.title} ${item.description} ${item.changeType} ${item.site.name} ${item.status}`
      .toLowerCase()
      .includes(normalized)
  );
  const visiblePermits = permits.filter((item) =>
    !normalized ||
    `${item.reference} ${item.title} ${item.type} ${item.exactLocation} ${item.site.name} ${item.status}`
      .toLowerCase()
      .includes(normalized)
  );

  return (
    <Page>
      <Header eyebrow="OFFLINE CONTROLLED WORK" title="MOC and Permits" onBack={onBack} />
      <Text style={styles.muted}>
        Review change controls and authorize high-risk work through the existing
        tenant lifecycle. Mobile decisions remain encrypted until synchronization.
      </Text>
      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline mode · Task updates, approvals, control verification, gas
            tests, and lifecycle decisions will synchronize automatically.
          </Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        {capabilities.canViewMoc ? (
          <Chip
            label={`MOC ${mocs.length}`}
            active={activeView === "moc"}
            onPress={() => {
              setView("moc");
              setQuery("");
            }}
          />
        ) : null}
        {capabilities.canViewPermits ? (
          <Chip
            label={`Permits ${permits.length}`}
            active={activeView === "permits"}
            onPress={() => {
              setView("permits");
              setQuery("");
            }}
          />
        ) : null}
      </View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={activeView === "moc" ? "Search change records" : "Search work permits"}
      />

      {activeView === "moc" ? (
        <>
          <Summary
            primary={visibleMocs.filter((item) => item.status === "IMPLEMENTATION").length}
            primaryLabel="Implementing"
            warning={visibleMocs.filter((item) => overdue(item.plannedCompletionDate) && !terminalMoc(item.status)).length}
            warningLabel="Overdue"
            pending={visibleMocs.reduce(
              (count, item) =>
                count +
                item.approvals.filter((approval) => approval.status === "PENDING").length,
              0
            )}
            pendingLabel="Approvals"
          />
          {visibleMocs.map((moc) => (
            <Pressable key={moc.id} onPress={() => setSelectedMocId(moc.id)}>
              <Card accent={moc.priority === "CRITICAL" || overdue(moc.plannedCompletionDate)}>
                <View style={styles.cardHeading}>
                  <Text style={styles.kicker}>
                    {moc.reference} · {humanize(moc.changeType)}
                  </Text>
                  <StatusBadge status={moc.status} />
                </View>
                <Text style={styles.cardTitle}>{moc.title}</Text>
                <Text style={styles.muted} numberOfLines={2}>{moc.description}</Text>
                <Text style={styles.meta}>
                  {moc.site.name}
                  {moc.department ? ` · ${moc.department.name}` : ""}
                  {" · "}
                  {humanize(moc.priority)} priority
                </Text>
                <View style={styles.cardHeading}>
                  <RiskBadge level={moc.residualRiskLevel} score={moc.residualScore} />
                  <Text style={overdue(moc.plannedCompletionDate) ? styles.overdue : styles.due}>
                    {moc.plannedCompletionDate
                      ? `${overdue(moc.plannedCompletionDate) ? "Overdue" : "Planned completion"} ${formatDate(moc.plannedCompletionDate)}`
                      : "No completion date"}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
          {!visibleMocs.length ? <Empty text="No MOC records match this search." /> : null}
        </>
      ) : (
        <>
          <Summary
            primary={visiblePermits.filter((item) => item.status === "ACTIVE").length}
            primaryLabel="Active"
            warning={visiblePermits.filter((item) => item.status === "SUSPENDED" || (openPermit(item.status) && overdue(item.plannedEndAt))).length}
            warningLabel="At risk"
            pending={visiblePermits.filter((item) => item.status === "PENDING_APPROVAL").length}
            pendingLabel="Awaiting"
          />
          {visiblePermits.map((permit) => {
            const required = permit.controls.filter((control) => control.isRequired);
            const verified = required.filter((control) => control.isVerified).length;
            return (
              <Pressable key={permit.id} onPress={() => setSelectedPermitId(permit.id)}>
                <Card accent={permit.status === "SUSPENDED" || (openPermit(permit.status) && overdue(permit.plannedEndAt))}>
                  <View style={styles.cardHeading}>
                    <Text style={styles.kicker}>
                      {permit.reference} · {humanize(permit.type)}
                    </Text>
                    <StatusBadge status={permit.status} />
                  </View>
                  <Text style={styles.cardTitle}>{permit.title}</Text>
                  <Text style={styles.muted} numberOfLines={2}>
                    {permit.hazardsSummary}
                  </Text>
                  <Text style={styles.meta}>
                    {permit.site.name} · {permit.exactLocation} ·{" "}
                    {permit.contractor?.name || "Internal work"}
                  </Text>
                  <View style={styles.cardHeading}>
                    <Text style={verified === required.length ? styles.success : styles.due}>
                      {verified}/{required.length} controls verified
                    </Text>
                    <Text style={openPermit(permit.status) && overdue(permit.plannedEndAt) ? styles.overdue : styles.meta}>
                      Ends {formatDateTime(permit.plannedEndAt)}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {!visiblePermits.length ? <Empty text="No permits match this search." /> : null}
        </>
      )}
    </Page>
  );
}

function MocDetail({
  moc,
  canManage,
  onBack,
  ...shared
}: {
  moc: MobileManagementOfChange;
  canManage: boolean;
  onBack: () => void;
} & SharedActionProps) {
  return (
    <Page>
      <Header eyebrow={`${moc.reference} · ${humanize(moc.changeType)}`} title={moc.title} onBack={onBack} />
      <View style={styles.cardHeading}>
        <StatusBadge status={moc.status} />
        <RiskBadge level={moc.residualRiskLevel} score={moc.residualScore} />
      </View>
      <Card>
        <Detail label="Site" value={moc.site.name} />
        <Detail label="Department" value={moc.department?.name || "All departments"} />
        <Detail label="Duration" value={humanize(moc.changeDuration)} />
        <Detail label="Priority" value={humanize(moc.priority)} />
        <Detail label="Requestor" value={moc.requestor.name} />
        <Detail label="Owner" value={moc.owner?.name || "Not assigned"} />
        <Detail
          label="Planned completion"
          value={moc.plannedCompletionDate ? formatDate(moc.plannedCompletionDate) : "Not scheduled"}
        />
      </Card>
      <Narrative title="Change description" value={moc.description} />
      <Narrative title="Business justification" value={moc.businessJustification} />
      {moc.emergencyJustification ? <Narrative title="Emergency justification" value={moc.emergencyJustification} alert /> : null}
      <Card>
        <Text style={styles.cardTitle}>Risk profile</Text>
        <View style={styles.riskRow}>
          <RiskBadge level={moc.initialRiskLevel} score={moc.initialScore} label="Initial" />
          <Text style={styles.arrow}>→</Text>
          <RiskBadge level={moc.residualRiskLevel} score={moc.residualScore} label="Residual" />
        </View>
      </Card>
      <ImpactGrid moc={moc} />
      {moc.riskLinks.length ? (
        <Card>
          <Text style={styles.cardTitle}>Linked Risk Register records</Text>
          {moc.riskLinks.map((link) => (
            <View key={link.id} style={styles.listItem}>
              <Text style={styles.detailValue}>{link.risk.reference} · {link.risk.title}</Text>
              <Text style={styles.meta}>
                Residual {humanize(link.risk.residualRiskLevel)} ({link.risk.residualScore})
              </Text>
              {link.relationshipNote ? <Text style={styles.muted}>{link.relationshipNote}</Text> : null}
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <Text style={styles.cardTitle}>Approvals</Text>
        {moc.approvals.map((approval) => (
          <View key={approval.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>
                {approval.sequence}. {humanize(approval.role)}
              </Text>
              <StatusBadge status={approval.status} />
            </View>
            <Text style={styles.meta}>
              {approval.approver?.name || "Unassigned approver"}
              {approval.decidedAt ? ` · ${formatDateTime(approval.decidedAt)}` : ""}
            </Text>
            {approval.comments ? <Text style={styles.muted}>{approval.comments}</Text> : null}
            {canManage &&
            approval.status === "PENDING" &&
            (approval.isAssignedToCurrentUser || !approval.approver) ? (
              <MocApprovalAction mocId={moc.id} approvalId={approval.id} {...shared} />
            ) : null}
          </View>
        ))}
        {!moc.approvals.length ? <Text style={styles.muted}>No approval requirements have been added.</Text> : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Implementation and verification tasks</Text>
        {moc.tasks.map((task) => (
          <View key={task.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>{task.title}</Text>
              <StatusBadge status={task.status} />
            </View>
            <Text style={styles.meta}>
              {humanize(task.taskType)} · {task.assignedTo?.name || "Unassigned"}
              {task.isRequired ? " · Required" : " · Optional"}
            </Text>
            {task.description ? <Text style={styles.muted}>{task.description}</Text> : null}
            {task.dueDate ? (
              <Text style={overdue(task.dueDate) && task.status !== "COMPLETED" ? styles.overdue : styles.due}>
                Due {formatDate(task.dueDate)}
              </Text>
            ) : null}
            {task.evidenceNote ? <Text style={styles.muted}>Evidence: {task.evidenceNote}</Text> : null}
            {canManage && !["COMPLETED", "CANCELLED"].includes(task.status) ? (
              <MocTaskAction mocId={moc.id} taskId={task.id} currentStatus={task.status} {...shared} />
            ) : null}
          </View>
        ))}
        {!moc.tasks.length ? <Text style={styles.muted}>No implementation tasks have been assigned.</Text> : null}
      </Card>
      {canManage && moc.nextStatuses.length ? (
        <MocLifecycleAction moc={moc} {...shared} />
      ) : null}
    </Page>
  );
}

function PermitDetail({
  permit,
  canManage,
  onBack,
  ...shared
}: {
  permit: MobilePermitToWork;
  canManage: boolean;
  onBack: () => void;
} & SharedActionProps) {
  const canVerify =
    canManage && ["APPROVED", "SUSPENDED"].includes(permit.status);
  const canTest =
    canManage && ["APPROVED", "ACTIVE", "SUSPENDED"].includes(permit.status);
  const required = permit.controls.filter((control) => control.isRequired);
  const verified = required.filter((control) => control.isVerified).length;

  return (
    <Page>
      <Header eyebrow={`${permit.reference} · ${humanize(permit.type)}`} title={permit.title} onBack={onBack} />
      <View style={styles.cardHeading}>
        <StatusBadge status={permit.status} />
        <Text style={openPermit(permit.status) && overdue(permit.plannedEndAt) ? styles.overdue : styles.due}>
          {openPermit(permit.status) && overdue(permit.plannedEndAt) ? "PAST AUTHORIZED END" : `Ends ${formatDateTime(permit.plannedEndAt)}`}
        </Text>
      </View>
      <Card>
        <Detail label="Site" value={permit.site.name} />
        <Detail label="Department" value={permit.department?.name || "Not assigned"} />
        <Detail label="Exact location" value={permit.exactLocation} />
        <Detail label="Responsible person" value={permit.responsiblePerson} />
        <Detail label="Contractor" value={permit.contractor?.name || "Internal work"} />
        <Detail label="Requested by" value={permit.requestedBy.name} />
        <Detail label="Planned start" value={formatDateTime(permit.plannedStartAt)} />
        <Detail label="Planned end" value={formatDateTime(permit.plannedEndAt)} />
        <Detail label="Work order" value={permit.workOrderReference || "Not recorded"} />
      </Card>
      {permit.description ? <Narrative title="Work description" value={permit.description} /> : null}
      <Narrative title="Hazards" value={permit.hazardsSummary} alert />
      <Narrative title="Control strategy" value={permit.controlsSummary} />
      {permit.requiredPpe ? <Narrative title="Required PPE" value={permit.requiredPpe} /> : null}
      {permit.isolationDetails ? <Narrative title="Isolation details" value={permit.isolationDetails} /> : null}
      {permit.emergencyPlan ? <Narrative title="Emergency plan" value={permit.emergencyPlan} alert /> : null}
      <Card accent={verified !== required.length}>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle}>Critical controls</Text>
          <Text style={verified === required.length ? styles.success : styles.due}>
            {verified}/{required.length} required verified
          </Text>
        </View>
        {permit.controls.map((control) => (
          <View key={control.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.controlCopy}>{control.description}</Text>
              <StatusBadge status={control.isVerified ? "VERIFIED" : "NOT_VERIFIED"} />
            </View>
            <Text style={styles.meta}>
              {control.isRequired ? "Required" : "Advisory"}
              {control.verifiedBy
                ? ` · ${control.verifiedBy.name} ${control.verifiedAt ? formatDateTime(control.verifiedAt) : ""}`
                : ""}
            </Text>
            {canVerify ? (
              <PermitControlAction
                permitId={permit.id}
                controlId={control.id}
                verified={control.isVerified}
                {...shared}
              />
            ) : null}
          </View>
        ))}
      </Card>
      <Card accent={permit.gasTestingRequired && permit.gasTests[0]?.result !== "PASS"}>
        <Text style={styles.cardTitle}>Atmospheric testing</Text>
        <Text style={styles.muted}>
          {permit.gasTestingRequired
            ? "A current passing test is required before activation."
            : "Testing is optional for this permit, but readings remain governed."}
        </Text>
        {permit.gasTests.map((test) => (
          <View key={test.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <StatusBadge status={test.result} />
              <Text style={styles.meta}>{formatDateTime(test.testedAt)}</Text>
            </View>
            <Text style={styles.detailValue}>
              O₂ {test.oxygenPercent ?? "—"}% · LEL {test.lelPercent ?? "—"}% ·
              H₂S {test.h2sPpm ?? "—"} ppm · CO {test.coPpm ?? "—"} ppm
            </Text>
            <Text style={styles.meta}>
              {test.performedBy.name}{test.notes ? ` · ${test.notes}` : ""}
            </Text>
          </View>
        ))}
        {!permit.gasTests.length ? <Text style={styles.muted}>No atmospheric tests recorded.</Text> : null}
        {canTest ? <PermitGasTestAction permitId={permit.id} {...shared} /> : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Authorized work crew</Text>
        {permit.workers.map(({ id, worker, role }) => (
          <View key={id} style={styles.listItem}>
            <Text style={styles.detailValue}>{worker.firstName} {worker.lastName}</Text>
            <Text style={styles.meta}>
              {role || worker.jobTitle || "Worker"} · {humanize(worker.status)} ·
              Induction {worker.inductionExpiresAt ? `expires ${formatDate(worker.inductionExpiresAt)}` : "not recorded"}
            </Text>
          </View>
        ))}
        {!permit.workers.length ? <Text style={styles.muted}>No contractor workers assigned.</Text> : null}
      </Card>
      {permit.closeoutNotes ? <Narrative title="Closeout notes" value={permit.closeoutNotes} /> : null}
      {canManage && permit.nextStatuses.length ? (
        <PermitLifecycleAction permit={permit} {...shared} />
      ) : null}
      <Card>
        <Text style={styles.cardTitle}>Decision history</Text>
        {permit.history.map((event) => (
          <View key={event.id} style={styles.history}>
            <Text style={styles.detailValue}>
              {event.fromStatus ? `${humanize(event.fromStatus)} → ` : ""}
              {humanize(event.toStatus)}
            </Text>
            <Text style={styles.meta}>
              {event.actor.name} · {formatDateTime(event.createdAt)}
            </Text>
            {event.comments ? <Text style={styles.muted}>{event.comments}</Text> : null}
          </View>
        ))}
      </Card>
    </Page>
  );
}

function MocApprovalAction({
  mocId,
  approvalId,
  ...shared
}: { mocId: string; approvalId: string } & SharedActionProps) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (decision === "REJECTED" && comments.trim().length < 3) {
      setError("Provide a reason before rejecting this approval.");
      return;
    }
    setBusy(true);
    try {
      await queueMocApprovalDecision(shared.ownerKey, {
        mocId,
        approvalId,
        status: decision,
        comments: comments.trim() || undefined,
      });
      await queued(shared, "MOC approval decision");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.label}>Approval decision</Text>
      <View style={styles.chips}>
        <Chip label="Approve" active={decision === "APPROVED"} onPress={() => setDecision("APPROVED")} />
        <Chip label="Reject" active={decision === "REJECTED"} onPress={() => setDecision("REJECTED")} />
      </View>
      <Input value={comments} onChangeText={setComments} placeholder="Decision comments" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? "Saving securely…" : shared.online ? "Save and sync" : "Save offline"} disabled={busy} onPress={save} />
    </View>
  );
}

function MocTaskAction({
  mocId,
  taskId,
  currentStatus,
  ...shared
}: {
  mocId: string;
  taskId: string;
  currentStatus: MobileMocTaskStatus;
} & SharedActionProps) {
  const options = (["IN_PROGRESS", "COMPLETED", "BLOCKED"] as MobileMocTaskStatus[])
    .filter((status) => status !== currentStatus);
  const [status, setStatus] = useState<MobileMocTaskStatus>(options[0] ?? currentStatus);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if ((status === "COMPLETED" || status === "BLOCKED") && evidenceNote.trim().length < 3) {
      setError(status === "COMPLETED" ? "Record completion evidence or verification notes." : "Explain what is blocking this task.");
      return;
    }
    setBusy(true);
    try {
      await queueMocTaskStatus(shared.ownerKey, {
        mocId,
        taskId,
        status,
        evidenceNote: evidenceNote.trim() || undefined,
      });
      await queued(shared, "MOC task update");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.label}>Update task</Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip key={option} label={humanize(option)} active={status === option} onPress={() => setStatus(option)} />
        ))}
      </View>
      <Input value={evidenceNote} onChangeText={setEvidenceNote} placeholder="Evidence, completion, or blocker notes" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? "Saving securely…" : shared.online ? "Save and sync" : "Save offline"} disabled={busy} onPress={save} />
    </View>
  );
}

function MocLifecycleAction({
  moc,
  ...shared
}: { moc: MobileManagementOfChange } & SharedActionProps) {
  const [status, setStatus] = useState(moc.nextStatuses[0]);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (["REJECTED", "CANCELLED"].includes(status) && comments.trim().length < 3) {
      setError("Provide a reason for this lifecycle decision.");
      return;
    }
    setBusy(true);
    try {
      await queueMocStatus(shared.ownerKey, {
        mocId: moc.id,
        status,
        comments: comments.trim() || undefined,
      });
      await queued(shared, "MOC lifecycle decision");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card accent>
      <Text style={styles.cardTitle}>MOC lifecycle decision</Text>
      <Text style={styles.muted}>All approval and required-task gates are revalidated by the server during synchronization.</Text>
      <View style={styles.chips}>
        {moc.nextStatuses.map((option) => (
          <Chip key={option} label={humanize(option)} active={status === option} onPress={() => setStatus(option)} />
        ))}
      </View>
      <Input value={comments} onChangeText={setComments} placeholder="Decision comments" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? "Saving securely…" : shared.online ? "Apply and sync" : "Save decision offline"} disabled={busy} onPress={save} />
    </Card>
  );
}

function PermitControlAction({
  permitId,
  controlId,
  verified,
  ...shared
}: {
  permitId: string;
  controlId: string;
  verified: boolean;
} & SharedActionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    setBusy(true);
    try {
      await queuePermitControl(shared.ownerKey, {
        permitId,
        controlId,
        verified: !verified,
      });
      await queued(shared, "Permit control verification");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SecondaryButton
        label={busy ? "Saving securely…" : verified ? "Remove verification" : "Verify control"}
        disabled={busy}
        onPress={save}
      />
    </View>
  );
}

function PermitGasTestAction({
  permitId,
  ...shared
}: { permitId: string } & SharedActionProps) {
  const [oxygen, setOxygen] = useState("");
  const [lel, setLel] = useState("");
  const [h2s, setH2s] = useState("");
  const [co, setCo] = useState("");
  const [result, setResult] = useState<"PASS" | "FAIL">("PASS");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reading = (value: string, label: string, max?: number) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || (max !== undefined && parsed > max)) {
      throw new Error(`${label} must be a non-negative number${max ? ` no greater than ${max}` : ""}.`);
    }
    return parsed;
  };
  const save = async () => {
    setError("");
    let oxygenPercent: number | undefined;
    let lelPercent: number | undefined;
    let h2sPpm: number | undefined;
    let coPpm: number | undefined;
    try {
      oxygenPercent = reading(oxygen, "Oxygen percentage", 100);
      lelPercent = reading(lel, "LEL percentage");
      h2sPpm = reading(h2s, "H₂S");
      coPpm = reading(co, "CO");
    } catch (reason) {
      setError(messageOf(reason));
      return;
    }
    setBusy(true);
    try {
      await queuePermitGasTest(shared.ownerKey, {
        permitId,
        oxygenPercent,
        lelPercent,
        h2sPpm,
        coPpm,
        result,
        notes: notes.trim() || undefined,
      });
      await queued(shared, "Atmospheric test");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.label}>Record atmospheric test</Text>
      <View style={styles.twoColumn}>
        <Input value={oxygen} onChangeText={setOxygen} placeholder="O₂ %" keyboardType="decimal-pad" style={styles.halfInput} />
        <Input value={lel} onChangeText={setLel} placeholder="LEL %" keyboardType="decimal-pad" style={styles.halfInput} />
        <Input value={h2s} onChangeText={setH2s} placeholder="H₂S ppm" keyboardType="decimal-pad" style={styles.halfInput} />
        <Input value={co} onChangeText={setCo} placeholder="CO ppm" keyboardType="decimal-pad" style={styles.halfInput} />
      </View>
      <View style={styles.chips}>
        <Chip label="Pass" active={result === "PASS"} onPress={() => setResult("PASS")} />
        <Chip label="Fail and stop work" active={result === "FAIL"} onPress={() => setResult("FAIL")} />
      </View>
      <Input value={notes} onChangeText={setNotes} placeholder="Test conditions and notes" multiline />
      {result === "FAIL" ? <Text style={styles.warning}>A failed test will automatically suspend an active permit during synchronization.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? "Saving securely…" : shared.online ? "Record and sync" : "Save test offline"} disabled={busy} onPress={save} />
    </View>
  );
}

function PermitLifecycleAction({
  permit,
  ...shared
}: { permit: MobilePermitToWork } & SharedActionProps) {
  const [status, setStatus] = useState(permit.nextStatuses[0]);
  const [comments, setComments] = useState("");
  const [closeoutNotes, setCloseoutNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (["REJECTED", "SUSPENDED", "CANCELLED"].includes(status) && comments.trim().length < 3) {
      setError("Provide a reason for this permit decision.");
      return;
    }
    if (status === "CLOSED" && closeoutNotes.trim().length < 3) {
      setError("Provide closeout notes before closing the permit.");
      return;
    }
    setBusy(true);
    try {
      await queuePermitStatus(shared.ownerKey, {
        permitId: permit.id,
        status,
        comments: comments.trim() || undefined,
        closeoutNotes: closeoutNotes.trim() || undefined,
      });
      await queued(shared, "Permit lifecycle decision");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card accent>
      <Text style={styles.cardTitle}>Permit lifecycle decision</Text>
      <Text style={styles.muted}>Control, atmospheric-test, contractor, worker, form, and time gates are revalidated before this decision is accepted.</Text>
      <View style={styles.chips}>
        {permit.nextStatuses.map((option) => (
          <Chip key={option} label={humanize(option)} active={status === option} onPress={() => setStatus(option)} />
        ))}
      </View>
      <Input value={comments} onChangeText={setComments} placeholder="Decision reason or comments" multiline />
      {status === "CLOSED" ? (
        <Input value={closeoutNotes} onChangeText={setCloseoutNotes} placeholder="Closeout verification and restoration notes" multiline />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={busy ? "Saving securely…" : shared.online ? "Apply and sync" : "Save decision offline"} disabled={busy} onPress={save} />
    </Card>
  );
}

async function queued(shared: SharedActionProps, label: string) {
  await shared.onQueued(
    shared.online
      ? `${label} queued for secure synchronization.`
      : `${label} encrypted and saved offline.`
  );
  if (shared.online) shared.onSync();
  shared.onSaved();
}

function ImpactGrid({ moc }: { moc: MobileManagementOfChange }) {
  const impacts = [
    ["Operational", moc.operationalImpact],
    ["Safety", moc.safetyImpact],
    ["Environmental", moc.environmentalImpact],
    ["Regulatory", moc.regulatoryImpact],
    ["Quality", moc.qualityImpact],
    ["Affected process", moc.affectedProcess],
    ["Affected equipment", moc.affectedEquipment],
    ["Affected systems", moc.affectedSystems],
    ["Affected materials", moc.affectedMaterials],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (!impacts.length) return null;
  return (
    <Card>
      <Text style={styles.cardTitle}>Impact assessment</Text>
      {impacts.map(([label, value]) => <Detail key={label} label={label} value={value} />)}
    </Card>
  );
}

function Narrative({
  title,
  value,
  alert = false,
}: {
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <Card accent={alert}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{value}</Text>
    </Card>
  );
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
      <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.kicker}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Summary({
  primary,
  primaryLabel,
  warning,
  warningLabel,
  pending,
  pendingLabel,
}: {
  primary: number;
  primaryLabel: string;
  warning: number;
  warningLabel: string;
  pending: number;
  pendingLabel: string;
}) {
  return (
    <View style={styles.summary}>
      <SummaryItem label={primaryLabel} value={primary} />
      <SummaryItem label={warningLabel} value={warning} warning />
      <SummaryItem label={pendingLabel} value={pending} />
    </View>
  );
}

function SummaryItem({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <View style={styles.summaryItem}><Text style={[styles.summaryValue, warning && styles.overdue]}>{value}</Text><Text style={styles.help}>{label}</Text></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.help}>{label.toUpperCase()}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function RiskBadge({ level, score, label }: { level: string; score: number; label?: string }) {
  const elevated = level === "HIGH" || level === "CRITICAL";
  return <View style={[styles.riskBadge, elevated && styles.riskBadgeHigh]}><Text style={[styles.riskBadgeText, elevated && styles.riskBadgeTextHigh]}>{label ? `${label} · ` : ""}{humanize(level)} {score}</Text></View>;
}

function StatusBadge({ status }: { status: string }) {
  const alert = ["SUSPENDED", "REJECTED", "BLOCKED", "FAIL", "NOT_VERIFIED", "OVERDUE"].includes(status);
  const done = ["COMPLETED", "CLOSED", "APPROVED", "PASS", "VERIFIED", "ACTIVE"].includes(status);
  return <View style={[styles.status, alert && styles.statusAlert, done && styles.statusDone]}><Text style={[styles.statusText, alert && styles.statusTextAlert, done && styles.statusTextDone]}>{humanize(status)}</Text></View>;
}

function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return <View style={[styles.card, accent && styles.cardAccent]}>{children}</View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} placeholderTextColor="#64748b" style={[styles.input, props.multiline && styles.multiline, props.style]} />;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.disabled]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.disabled]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>;
}

function overdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function terminalMoc(status: string) {
  return status === "CLOSED" || status === "CANCELLED";
}

function openPermit(status: string) {
  return !["CLOSED", "CANCELLED", "EXPIRED", "REJECTED"].includes(status);
}

function humanize(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : "The controlled-work update could not be saved.";
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
  help: { color: "#64748b", fontSize: 11, lineHeight: 16 },
  due: { color: "#67e8f9", fontSize: 12, fontWeight: "700" },
  overdue: { color: "#fda4af", fontSize: 12, fontWeight: "800" },
  success: { color: "#6ee7b7", fontSize: 12, fontWeight: "800" },
  warning: { color: "#fde68a", fontSize: 12, lineHeight: 18 },
  arrow: { color: "#64748b", fontSize: 20, fontWeight: "800" },
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
  controlCopy: { flex: 1, color: "#dbeafe", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  listItem: { gap: 7, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 11, marginTop: 3 },
  history: { gap: 4, borderLeftWidth: 2, borderLeftColor: "#22d3ee55", paddingLeft: 12, marginTop: 5 },
  detail: { borderBottomWidth: 1, borderBottomColor: "#172a43", paddingBottom: 8, gap: 3 },
  detailValue: { color: "#dbeafe", fontSize: 14, lineHeight: 20 },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  riskBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#123047", borderWidth: 1, borderColor: "#1e7494" },
  riskBadgeHigh: { backgroundColor: "#4c051933", borderColor: "#fb718555" },
  riskBadgeText: { color: "#a5f3fc", fontSize: 10, fontWeight: "800" },
  riskBadgeTextHigh: { color: "#fda4af" },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#123047", borderWidth: 1, borderColor: "#1e7494" },
  statusAlert: { backgroundColor: "#4c051933", borderColor: "#fb718555" },
  statusDone: { backgroundColor: "#064e3b44", borderColor: "#34d39955" },
  statusText: { color: "#a5f3fc", fontSize: 10, fontWeight: "800" },
  statusTextAlert: { color: "#fda4af" },
  statusTextDone: { color: "#6ee7b7" },
  actionPanel: { gap: 8, borderRadius: 15, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", padding: 13, marginTop: 4 },
  label: { color: "#dbeafe", fontWeight: "700", fontSize: 13 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", color: "#f8fafc", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  twoColumn: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  halfInput: { width: "48%" },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: "#67e8f9", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 7 },
  primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 },
  secondaryButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: "#2d4964", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 7 },
  secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.55 },
  empty: { borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 18, padding: 24 },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
});
