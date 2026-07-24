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
  queueAssetDefect,
  queueAssetDefectStatus,
  queueAssetInspection,
  queueAssetMaintenanceCompletion,
  queueAssetMaintenanceStatus,
  queueAssetStatus,
  queueContractorStatus,
} from "./storage";
import type {
  CapturedAnswer,
  CapturedForm,
  MobileAsset,
  MobileAssetDefectStatus,
  MobileAssetMaintenanceStatus,
  MobileAssetStatus,
  MobileBootstrap,
  MobileContractor,
  MobileContractorStatus,
  RuntimeField,
  RuntimeForm,
} from "./types";

export type AssetContractorView = "assets" | "contractors";

type SharedActionProps = {
  ownerKey: string;
  online: boolean;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
  onSaved: () => void;
};

type FieldValue = string | boolean | string[];

export function AssetContractorScreen({
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
  initialView: AssetContractorView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [view, setView] = useState<AssetContractorView>(initialView);
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedContractorId, setSelectedContractorId] =
    useState<string | null>(null);
  const assets = workspace.assets ?? [];
  const contractors = workspace.contractors ?? [];
  const capabilities = workspace.assetContractorCapabilities ?? {
    canViewAssets: false,
    canManageAssets: false,
    canViewContractors: false,
    canManageContractors: false,
  };
  const selectedAsset = assets.find((item) => item.id === selectedAssetId);
  const selectedContractor = contractors.find(
    (item) => item.id === selectedContractorId
  );
  const shared = {
    ownerKey,
    online,
    onQueued,
    onSync,
    onSaved: () => {
      setSelectedAssetId(null);
      setSelectedContractorId(null);
    },
  };

  if (selectedAsset) {
    return (
      <AssetDetail
        asset={selectedAsset}
        inspectionForms={workspace.assetInspectionForms ?? []}
        currentUserId={workspace.user.id}
        canManage={capabilities.canManageAssets}
        onBack={() => setSelectedAssetId(null)}
        {...shared}
      />
    );
  }
  if (selectedContractor) {
    return (
      <ContractorDetail
        contractor={selectedContractor}
        canManage={capabilities.canManageContractors}
        onBack={() => setSelectedContractorId(null)}
        {...shared}
      />
    );
  }
  if (!capabilities.canViewAssets && !capabilities.canViewContractors) {
    return (
      <Page>
        <Header eyebrow="OPERATIONAL CONTROL" title="Access restricted" onBack={onBack} />
        <Empty text="Your role does not include Asset Management or Contractor Safety access." />
      </Page>
    );
  }

  const activeView =
    (view === "assets" && capabilities.canViewAssets) ||
    (view === "contractors" && capabilities.canViewContractors)
      ? view
      : capabilities.canViewAssets
        ? "assets"
        : "contractors";
  const normalized = query.trim().toLowerCase();
  const visibleAssets = assets.filter(
    (item) =>
      !normalized ||
      `${item.reference} ${item.name} ${item.type} ${item.site.name} ${item.location ?? ""} ${item.status}`
        .toLowerCase()
        .includes(normalized)
  );
  const visibleContractors = contractors.filter(
    (item) =>
      !normalized ||
      `${item.name} ${item.legalName ?? ""} ${item.services ?? ""} ${item.status} ${item.sites.map((site) => site.site.name).join(" ")}`
        .toLowerCase()
        .includes(normalized)
  );

  return (
    <Page>
      <Header
        eyebrow="OFFLINE OPERATIONAL CONTROL"
        title="Assets and Contractors"
        onBack={onBack}
      />
      <Text style={styles.muted}>
        Inspect safety-critical equipment, govern defects and maintenance, and
        verify contractor readiness from the encrypted tenant workspace.
      </Text>
      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline mode · Asset evidence, lifecycle decisions, and contractor
            qualification decisions will synchronize when connectivity returns.
          </Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        {capabilities.canViewAssets ? (
          <Chip
            label={`Assets ${assets.length}`}
            active={activeView === "assets"}
            onPress={() => {
              setView("assets");
              setQuery("");
            }}
          />
        ) : null}
        {capabilities.canViewContractors ? (
          <Chip
            label={`Contractors ${contractors.length}`}
            active={activeView === "contractors"}
            onPress={() => {
              setView("contractors");
              setQuery("");
            }}
          />
        ) : null}
      </View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={
          activeView === "assets"
            ? "Search assets, sites, or equipment"
            : "Search contractors, services, or sites"
        }
      />
      {activeView === "assets" ? (
        <>
          <Summary
            primary={visibleAssets.filter((item) => item.isSafetyCritical).length}
            primaryLabel="Safety critical"
            warning={visibleAssets.filter(assetAtRisk).length}
            warningLabel="At risk"
            pending={visibleAssets.reduce(
              (count, item) =>
                count +
                item.defects.filter((defect) => defect.status !== "CLOSED").length,
              0
            )}
            pendingLabel="Open defects"
          />
          {visibleAssets.map((asset) => (
            <Pressable key={asset.id} onPress={() => setSelectedAssetId(asset.id)}>
              <Card accent={assetAtRisk(asset)}>
                <View style={styles.cardHeading}>
                  <Text style={styles.kicker}>
                    {asset.reference} · {humanize(asset.type)}
                  </Text>
                  <StatusBadge status={asset.status} />
                </View>
                <Text style={styles.cardTitle}>{asset.name}</Text>
                <Text style={styles.meta}>
                  {asset.site.name}
                  {asset.department ? ` · ${asset.department.name}` : ""}
                  {asset.location ? ` · ${asset.location}` : ""}
                </Text>
                <View style={styles.cardHeading}>
                  <RiskBadge level={asset.criticality} />
                  <Text style={overdue(asset.nextInspectionDueAt) ? styles.overdue : styles.due}>
                    Inspection {overdue(asset.nextInspectionDueAt) ? "overdue" : "due"}{" "}
                    {formatDate(asset.nextInspectionDueAt)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
          {!visibleAssets.length ? <Empty text="No assets match this search." /> : null}
        </>
      ) : (
        <>
          <Summary
            primary={visibleContractors.filter((item) => item.status === "APPROVED").length}
            primaryLabel="Approved"
            warning={visibleContractors.filter(contractorAtRisk).length}
            warningLabel="At risk"
            pending={visibleContractors.filter((item) => item.status === "PENDING_APPROVAL").length}
            pendingLabel="Pending"
          />
          {visibleContractors.map((contractor) => (
            <Pressable
              key={contractor.id}
              onPress={() => setSelectedContractorId(contractor.id)}
            >
              <Card accent={contractorAtRisk(contractor)}>
                <View style={styles.cardHeading}>
                  <Text style={styles.kicker}>CONTRACTOR QUALIFICATION</Text>
                  <StatusBadge status={contractor.status} />
                </View>
                <Text style={styles.cardTitle}>{contractor.name}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {contractor.services || "Services not recorded"}
                </Text>
                <Text style={styles.meta}>
                  {contractor.sites.map((site) => site.site.name).join(" · ") ||
                    "No authorized site"}
                </Text>
                <View style={styles.cardHeading}>
                  <Text style={styles.due}>
                    {contractor.submittedFormCount}/{contractor.requiredFormCount} forms
                  </Text>
                  <Text
                    style={
                      contractor.insuranceExpiresAt &&
                      !overdue(contractor.insuranceExpiresAt)
                        ? styles.success
                        : styles.overdue
                    }
                  >
                    {contractor.insuranceExpiresAt
                      ? `Insurance ${formatDate(contractor.insuranceExpiresAt)}`
                      : "Insurance missing"}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
          {!visibleContractors.length ? (
            <Empty text="No contractors match this search." />
          ) : null}
        </>
      )}
    </Page>
  );
}

function AssetDetail({
  asset,
  inspectionForms,
  currentUserId,
  canManage,
  onBack,
  ...shared
}: {
  asset: MobileAsset;
  inspectionForms: RuntimeForm[];
  currentUserId: string;
  canManage: boolean;
  onBack: () => void;
} & SharedActionProps) {
  return (
    <Page>
      <Header
        eyebrow={`${asset.reference} · ${humanize(asset.type)}`}
        title={asset.name}
        onBack={onBack}
      />
      <View style={styles.cardHeading}>
        <StatusBadge status={asset.status} />
        <RiskBadge level={asset.criticality} />
      </View>
      <Card accent={asset.isSafetyCritical}>
        <Detail label="Site" value={asset.site.name} />
        <Detail label="Department" value={asset.department?.name || "Not assigned"} />
        <Detail label="Location" value={asset.location || "Not recorded"} />
        <Detail label="Owner" value={asset.owner?.name || "Unassigned"} />
        <Detail label="Manufacturer" value={asset.manufacturer || "Not recorded"} />
        <Detail label="Model" value={asset.modelNumber || "Not recorded"} />
        <Detail label="Serial number" value={asset.serialNumber || "Not recorded"} />
        <Detail label="Permit required" value={asset.permitRequired ? "Yes" : "No"} />
        <Detail label="Safety critical" value={asset.isSafetyCritical ? "Yes" : "No"} />
      </Card>
      {asset.description ? <Narrative title="Equipment description" value={asset.description} /> : null}
      <Card accent={overdue(asset.nextInspectionDueAt)}>
        <Text style={styles.cardTitle}>Inspection control</Text>
        <Detail label="Last inspection" value={asset.lastInspectionAt ? formatDateTime(asset.lastInspectionAt) : "Not recorded"} />
        <Detail label="Next due" value={formatDate(asset.nextInspectionDueAt)} />
        <Detail label="Interval" value={`${asset.inspectionIntervalDays} days`} />
      </Card>
      {canManage ? (
        <AssetInspectionAction
          asset={asset}
          forms={inspectionForms}
          {...shared}
        />
      ) : null}
      <Card>
        <Text style={styles.cardTitle}>Recent inspections</Text>
        {asset.inspections.map((inspection) => (
          <View key={inspection.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <StatusBadge status={inspection.result} />
              <Text style={styles.meta}>{formatDateTime(inspection.inspectedAt)}</Text>
            </View>
            <Text style={styles.detailValue}>
              {inspection.inspectedBy.name}
              {inspection.conditionScore ? ` · Condition ${inspection.conditionScore}/5` : ""}
            </Text>
            {inspection.observations ? <Text style={styles.muted}>{inspection.observations}</Text> : null}
            {inspection.immediateAction ? <Text style={styles.warning}>Immediate action: {inspection.immediateAction}</Text> : null}
          </View>
        ))}
        {!asset.inspections.length ? <Text style={styles.muted}>No inspections recorded.</Text> : null}
      </Card>
      {canManage ? (
        <AssetDefectAction
          asset={asset}
          currentUserId={currentUserId}
          {...shared}
        />
      ) : null}
      <Card accent={asset.defects.some((defect) => defect.status !== "CLOSED")}>
        <Text style={styles.cardTitle}>Defects</Text>
        {asset.defects.map((defect) => (
          <View key={defect.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>{defect.reference}</Text>
              <StatusBadge status={defect.status} />
            </View>
            <Text style={styles.cardTitle}>{defect.title}</Text>
            <Text style={styles.muted}>{defect.description}</Text>
            <Text style={styles.meta}>
              {humanize(defect.severity)} · {defect.owner?.name || "Unassigned"}
              {defect.dueDate ? ` · Due ${formatDate(defect.dueDate)}` : ""}
            </Text>
            {defect.repairPlan ? <Text style={styles.muted}>Repair plan: {defect.repairPlan}</Text> : null}
            {defect.verificationEvidence ? <Text style={styles.success}>Verified: {defect.verificationEvidence}</Text> : null}
            {canManage && defect.nextStatuses.length ? (
              <AssetDefectStatusAction defect={defect} {...shared} />
            ) : null}
          </View>
        ))}
        {!asset.defects.length ? <Text style={styles.muted}>No active or recent defects.</Text> : null}
      </Card>
      <Card accent={overdue(asset.nextMaintenanceDueAt)}>
        <Text style={styles.cardTitle}>Maintenance control</Text>
        <Detail label="Last maintenance" value={asset.lastMaintenanceAt ? formatDateTime(asset.lastMaintenanceAt) : "Not recorded"} />
        <Detail label="Next due" value={formatDate(asset.nextMaintenanceDueAt)} />
        <Detail label="Interval" value={`${asset.maintenanceIntervalDays} days`} />
        {asset.maintenanceRecords.map((record) => (
          <View key={record.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>{record.title}</Text>
              <StatusBadge status={record.status} />
            </View>
            <Text style={styles.meta}>
              {humanize(record.type)} · {record.technician?.name || record.serviceProvider || "Unassigned"}
              {" · "}Due {formatDate(record.dueAt)}
            </Text>
            {record.workOrderReference ? <Text style={styles.muted}>Work order: {record.workOrderReference}</Text> : null}
            {record.defect ? <Text style={styles.warning}>Linked defect: {record.defect.reference} · {record.defect.title}</Text> : null}
            {record.workSummary ? <Text style={styles.muted}>{record.workSummary}</Text> : null}
            {canManage && !["COMPLETED", "CANCELLED"].includes(record.status) ? (
              <AssetMaintenanceAction record={record} {...shared} />
            ) : null}
          </View>
        ))}
        {!asset.maintenanceRecords.length ? <Text style={styles.muted}>No active or recent maintenance work.</Text> : null}
      </Card>
      {canManage && asset.nextStatuses.length ? (
        <AssetLifecycleAction asset={asset} {...shared} />
      ) : null}
    </Page>
  );
}

function ContractorDetail({
  contractor,
  canManage,
  onBack,
  ...shared
}: {
  contractor: MobileContractor;
  canManage: boolean;
  onBack: () => void;
} & SharedActionProps) {
  return (
    <Page>
      <Header eyebrow="CONTRACTOR QUALIFICATION" title={contractor.name} onBack={onBack} />
      <View style={styles.cardHeading}>
        <StatusBadge status={contractor.status} />
        <Text style={contractorAtRisk(contractor) ? styles.overdue : styles.success}>
          {contractor.submittedFormCount}/{contractor.requiredFormCount} required forms
        </Text>
      </View>
      <Card accent={contractorAtRisk(contractor)}>
        <Detail label="Legal name" value={contractor.legalName || contractor.name} />
        <Detail label="Registration" value={contractor.registrationNumber || "Not recorded"} />
        <Detail label="Services" value={contractor.services || "Not recorded"} />
        <Detail label="Safety rating" value={contractor.safetyRating === null ? "Not rated" : `${contractor.safetyRating}/100`} />
        <Detail label="Approved by" value={contractor.approvedBy?.name || "Not approved"} />
        <Detail label="Approved at" value={contractor.approvedAt ? formatDateTime(contractor.approvedAt) : "Not approved"} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Contact and insurance</Text>
        <Detail label="Primary contact" value={contractor.primaryContactName || "Not recorded"} />
        <Detail label="Email" value={contractor.primaryContactEmail || "Not recorded"} />
        <Detail label="Phone" value={contractor.primaryContactPhone || "Not recorded"} />
        <Detail label="Insurance provider" value={contractor.insuranceProvider || "Not recorded"} />
        <Detail label="Policy number" value={contractor.insurancePolicyNumber || "Not recorded"} />
        <Detail label="Insurance expires" value={contractor.insuranceExpiresAt ? formatDate(contractor.insuranceExpiresAt) : "Not recorded"} />
      </Card>
      {contractor.safetyProgramSummary ? <Narrative title="Safety program" value={contractor.safetyProgramSummary} /> : null}
      {contractor.suspensionReason ? <Narrative title="Suspension reason" value={contractor.suspensionReason} alert /> : null}
      <Card>
        <Text style={styles.cardTitle}>Authorized sites</Text>
        {contractor.sites.map((authorization) => (
          <View key={authorization.id} style={styles.listItem}>
            <Text style={styles.detailValue}>{authorization.site.name}</Text>
            <Text style={authorization.expiresAt && overdue(authorization.expiresAt) ? styles.overdue : styles.meta}>
              {authorization.expiresAt
                ? `${overdue(authorization.expiresAt) ? "Expired" : "Expires"} ${formatDate(authorization.expiresAt)}`
                : "No expiration"}
            </Text>
          </View>
        ))}
        {!contractor.sites.length ? <Text style={styles.muted}>No sites authorized.</Text> : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Worker readiness</Text>
        {contractor.workers.map((worker) => (
          <View key={worker.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>{worker.firstName} {worker.lastName}</Text>
              <StatusBadge status={worker.status} />
            </View>
            <Text style={styles.meta}>{worker.jobTitle || "Role not recorded"}</Text>
            <Text style={worker.inductionCurrent ? styles.success : styles.overdue}>
              Induction {worker.inductionCurrent ? "current" : "not current"}
              {" · "}Medical {worker.medicalCurrent ? "current" : "expired"}
            </Text>
            {worker.competencySummary ? <Text style={styles.muted}>{worker.competencySummary}</Text> : null}
          </View>
        ))}
        {!contractor.workers.length ? <Text style={styles.muted}>No workers registered.</Text> : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Open work permits</Text>
        {contractor.permitsToWork.map((permit) => (
          <View key={permit.id} style={styles.listItem}>
            <View style={styles.cardHeading}>
              <Text style={styles.detailValue}>{permit.reference}</Text>
              <StatusBadge status={permit.status} />
            </View>
            <Text style={styles.cardTitle}>{permit.title}</Text>
            <Text style={styles.meta}>{permit.site.name} · {formatDateTime(permit.plannedStartAt)}–{formatDateTime(permit.plannedEndAt)}</Text>
          </View>
        ))}
        {!contractor.permitsToWork.length ? <Text style={styles.muted}>No open permits.</Text> : null}
      </Card>
      {canManage && contractor.nextStatuses.length ? (
        <ContractorLifecycleAction contractor={contractor} {...shared} />
      ) : null}
    </Page>
  );
}

function AssetInspectionAction({
  asset,
  forms,
  ...shared
}: {
  asset: MobileAsset;
  forms: RuntimeForm[];
} & SharedActionProps) {
  const [result, setResult] = useState<"SATISFACTORY" | "DEFECT_FOUND" | "OUT_OF_SERVICE">("SATISFACTORY");
  const [conditionScore, setConditionScore] = useState("3");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [observations, setObservations] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    const score = Number(conditionScore);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      setError("Condition score must be a whole number from 1 to 5.");
      return;
    }
    if (result !== "SATISFACTORY" && observations.trim().length < 2) {
      setError("Describe the observed defect or unsafe condition.");
      return;
    }
    const reference =
      evidenceReference.trim() ||
      (evidence.length ? "Mobile evidence attached" : "");
    if (asset.isSafetyCritical && result === "SATISFACTORY" && !reference) {
      setError("Add evidence or record an evidence reference for this safety-critical asset.");
      return;
    }
    let customForms: CapturedForm[];
    try {
      customForms = buildCapturedForms(forms, answers);
    } catch (reason) {
      setError(messageOf(reason));
      return;
    }
    setBusy(true);
    try {
      await queueAssetInspection(
        shared.ownerKey,
        {
          assetId: asset.id,
          inspectedAt: new Date().toISOString(),
          result,
          conditionScore: score,
          evidenceReference: reference || undefined,
          observations: observations.trim() || undefined,
          immediateAction: immediateAction.trim() || undefined,
          customForms,
        },
        evidence
      );
      await queued(shared, "Asset safety inspection");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card accent>
      <Text style={styles.cardTitle}>Record safety inspection</Text>
      <Text style={styles.muted}>
        Unsafe results create a governed defect automatically. Photos and
        documents upload after the inspection synchronizes.
      </Text>
      <View style={styles.chips}>
        {(["SATISFACTORY", "DEFECT_FOUND", "OUT_OF_SERVICE"] as const).map((value) => (
          <Chip key={value} label={humanize(value)} active={result === value} onPress={() => setResult(value)} />
        ))}
      </View>
      <Input value={conditionScore} onChangeText={setConditionScore} placeholder="Condition score 1–5" keyboardType="number-pad" />
      <Input value={evidenceReference} onChangeText={setEvidenceReference} placeholder="Evidence or calibration reference" />
      <Input value={observations} onChangeText={setObservations} placeholder="Inspection observations" multiline />
      <Input value={immediateAction} onChangeText={setImmediateAction} placeholder="Immediate action or isolation" multiline />
      <EvidencePicker value={evidence} onChange={setEvidence} label="Inspection evidence" />
      {forms.map((form) => (
        <DynamicForm
          key={form.id}
          form={form}
          answers={answers}
          setAnswers={setAnswers}
        />
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? "Saving securely…" : shared.online ? "Record and sync" : "Save inspection offline"}
        disabled={busy}
        onPress={save}
      />
    </Card>
  );
}

function AssetDefectAction({
  asset,
  currentUserId,
  ...shared
}: {
  asset: MobileAsset;
  currentUserId: string;
} & SharedActionProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [immediateControls, setImmediateControls] = useState("");
  const [assignToMe, setAssignToMe] = useState(true);
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (title.trim().length < 2 || description.trim().length < 2) {
      setError("Defect title and description are required.");
      return;
    }
    if (dueDate && !validFutureDate(dueDate)) {
      setError("Due date must be a future YYYY-MM-DD date.");
      return;
    }
    setBusy(true);
    try {
      await queueAssetDefect(
        shared.ownerKey,
        {
          assetId: asset.id,
          title: title.trim(),
          description: description.trim(),
          severity,
          ownerId: assignToMe ? currentUserId : undefined,
          dueDate: dueDate || undefined,
          immediateControls: immediateControls.trim() || undefined,
        },
        evidence
      );
      await queued(shared, "Asset defect");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Text style={styles.cardTitle}>Report equipment defect</Text>
      <Input value={title} onChangeText={setTitle} placeholder="Defect title" />
      <Input value={description} onChangeText={setDescription} placeholder="Objective defect description" multiline />
      <View style={styles.chips}>
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((value) => (
          <Chip key={value} label={humanize(value)} active={severity === value} onPress={() => setSeverity(value)} />
        ))}
      </View>
      <Input value={dueDate} onChangeText={setDueDate} placeholder="Due date YYYY-MM-DD" autoCapitalize="none" />
      <Input value={immediateControls} onChangeText={setImmediateControls} placeholder="Immediate controls or isolation" multiline />
      <Check
        label="Assign this defect to me"
        checked={assignToMe}
        onPress={() => setAssignToMe((value) => !value)}
      />
      <EvidencePicker value={evidence} onChange={setEvidence} label="Defect evidence" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? "Saving securely…" : shared.online ? "Report and sync" : "Save defect offline"}
        disabled={busy}
        onPress={save}
      />
    </Card>
  );
}

function AssetDefectStatusAction({
  defect,
  ...shared
}: {
  defect: MobileAsset["defects"][number];
} & SharedActionProps) {
  const [status, setStatus] = useState<MobileAssetDefectStatus>(defect.nextStatuses[0]);
  const [repairPlan, setRepairPlan] = useState(defect.repairPlan || "");
  const [verificationEvidence, setVerificationEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (status === "REPAIR_PLANNED" && repairPlan.trim().length < 2) {
      setError("Record the repair plan.");
      return;
    }
    if (status === "VERIFIED" && verificationEvidence.trim().length < 2) {
      setError("Record independent verification evidence.");
      return;
    }
    setBusy(true);
    try {
      await queueAssetDefectStatus(shared.ownerKey, {
        defectId: defect.id,
        status,
        repairPlan: repairPlan.trim() || undefined,
        verificationEvidence: verificationEvidence.trim() || undefined,
      });
      await queued(shared, "Defect lifecycle decision");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.label}>Update defect</Text>
      <View style={styles.chips}>
        {defect.nextStatuses.map((value) => (
          <Chip key={value} label={humanize(value)} active={status === value} onPress={() => setStatus(value)} />
        ))}
      </View>
      {status === "REPAIR_PLANNED" ? <Input value={repairPlan} onChangeText={setRepairPlan} placeholder="Repair plan" multiline /> : null}
      {status === "VERIFIED" ? <Input value={verificationEvidence} onChangeText={setVerificationEvidence} placeholder="Independent verification evidence" multiline /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SecondaryButton
        label={busy ? "Saving securely…" : shared.online ? "Save and sync" : "Save offline"}
        disabled={busy}
        onPress={save}
      />
    </View>
  );
}

function AssetMaintenanceAction({
  record,
  ...shared
}: {
  record: MobileAsset["maintenanceRecords"][number];
} & SharedActionProps) {
  const options = record.nextStatuses.filter(
    (status): status is "IN_PROGRESS" | "CANCELLED" | "COMPLETED" =>
      status === "IN_PROGRESS" || status === "CANCELLED" || status === "COMPLETED"
  );
  const [status, setStatus] = useState<"IN_PROGRESS" | "CANCELLED" | "COMPLETED">(
    options[0] ?? "IN_PROGRESS"
  );
  const [reason, setReason] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [downtimeHours, setDowntimeHours] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    setBusy(true);
    try {
      if (status === "COMPLETED") {
        const downtime = downtimeHours.trim() ? Number(downtimeHours) : undefined;
        if (downtime !== undefined && (!Number.isFinite(downtime) || downtime < 0 || downtime > 100000)) {
          throw new Error("Downtime hours must be a non-negative number.");
        }
        if (workSummary.trim().length < 2) throw new Error("Record the completed work summary.");
        const reference =
          evidenceReference.trim() ||
          (evidence.length ? "Mobile evidence attached" : "");
        if (!reference) throw new Error("Add evidence or record an evidence reference.");
        await queueAssetMaintenanceCompletion(
          shared.ownerKey,
          {
            recordId: record.id,
            completedAt: new Date().toISOString(),
            workSummary: workSummary.trim(),
            evidenceReference: reference,
            downtimeHours: downtime,
          },
          evidence
        );
      } else {
        if (reason.trim().length < 2) throw new Error("Record the reason for this maintenance decision.");
        await queueAssetMaintenanceStatus(shared.ownerKey, {
          recordId: record.id,
          status,
          reason: reason.trim(),
        });
      }
      await queued(shared, "Maintenance update");
    } catch (reasonValue) {
      setError(messageOf(reasonValue));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.label}>Update maintenance work</Text>
      <View style={styles.chips}>
        {options.map((value) => (
          <Chip key={value} label={humanize(value)} active={status === value} onPress={() => setStatus(value)} />
        ))}
      </View>
      {status === "COMPLETED" ? (
        <>
          <Input value={workSummary} onChangeText={setWorkSummary} placeholder="Completed work and functional checks" multiline />
          <Input value={evidenceReference} onChangeText={setEvidenceReference} placeholder="Work order or evidence reference" />
          <Input value={downtimeHours} onChangeText={setDowntimeHours} placeholder="Downtime hours" keyboardType="decimal-pad" />
          <EvidencePicker value={evidence} onChange={setEvidence} label="Completion evidence" />
        </>
      ) : (
        <Input value={reason} onChangeText={setReason} placeholder="Reason and operational context" multiline />
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

function AssetLifecycleAction({
  asset,
  ...shared
}: {
  asset: MobileAsset;
} & SharedActionProps) {
  const [status, setStatus] = useState<MobileAssetStatus>(asset.nextStatuses[0]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (reason.trim().length < 2) {
      setError("Record the reason for this asset decision.");
      return;
    }
    setBusy(true);
    try {
      await queueAssetStatus(shared.ownerKey, {
        assetId: asset.id,
        status,
        reason: reason.trim(),
      });
      await queued(shared, "Asset lifecycle decision");
    } catch (reasonValue) {
      setError(messageOf(reasonValue));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card accent>
      <Text style={styles.cardTitle}>Asset lifecycle decision</Text>
      <Text style={styles.muted}>
        Unresolved high and critical defects are revalidated before equipment can
        return to active service.
      </Text>
      <View style={styles.chips}>
        {asset.nextStatuses.map((value) => (
          <Chip key={value} label={humanize(value)} active={status === value} onPress={() => setStatus(value)} />
        ))}
      </View>
      <Input value={reason} onChangeText={setReason} placeholder="Reason and authorization context" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? "Saving securely…" : shared.online ? "Apply and sync" : "Save decision offline"}
        disabled={busy}
        onPress={save}
      />
    </Card>
  );
}

function ContractorLifecycleAction({
  contractor,
  ...shared
}: {
  contractor: MobileContractor;
} & SharedActionProps) {
  const [status, setStatus] = useState<MobileContractorStatus>(
    contractor.nextStatuses[0]
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (status === "SUSPENDED" && reason.trim().length < 2) {
      setError("Provide a suspension reason.");
      return;
    }
    setBusy(true);
    try {
      await queueContractorStatus(shared.ownerKey, {
        contractorId: contractor.id,
        status,
        reason: reason.trim() || undefined,
      });
      await queued(shared, "Contractor qualification decision");
    } catch (reasonValue) {
      setError(messageOf(reasonValue));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card accent>
      <Text style={styles.cardTitle}>Contractor qualification decision</Text>
      <Text style={styles.muted}>
        Current insurance, site authorization, and all published contractor forms
        are revalidated before approval.
      </Text>
      <View style={styles.chips}>
        {contractor.nextStatuses.map((value) => (
          <Chip key={value} label={humanize(value)} active={status === value} onPress={() => setStatus(value)} />
        ))}
      </View>
      <Input value={reason} onChangeText={setReason} placeholder="Decision rationale" multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? "Saving securely…" : shared.online ? "Apply and sync" : "Save decision offline"}
        disabled={busy}
        onPress={save}
      />
    </Card>
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
    setError("");
    setBusy(true);
    try {
      const selected =
        source === "camera"
          ? await capturePhotoEvidence()
          : source === "photos"
            ? await pickPhotoEvidence(MAX_EVIDENCE_FILES_PER_RECORD - value.length)
            : await pickEvidenceFiles();
      if (value.length + selected.length > MAX_EVIDENCE_FILES_PER_RECORD) {
        throw new Error(`Attach no more than ${MAX_EVIDENCE_FILES_PER_RECORD} evidence files.`);
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
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.help}>
        Evidence is copied into encrypted device storage and uploaded privately
        after its governed parent record synchronizes. Maximum 10 MB per file.
      </Text>
      <View style={styles.chips}>
        <SecondaryButton label={busy ? "Opening…" : "Take photo"} disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD} onPress={() => { void add("camera"); }} />
        <SecondaryButton label={busy ? "Opening…" : "Choose photos"} disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD} onPress={() => { void add("photos"); }} />
        <SecondaryButton label={busy ? "Opening…" : "Choose document"} disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD} onPress={() => { void add("files"); }} />
      </View>
      {value.map((file) => (
        <View key={file.id} style={styles.evidenceFile}>
          <View style={styles.flex}>
            <Text style={styles.detailValue} numberOfLines={1}>{file.fileName}</Text>
            <Text style={styles.help}>{humanize(file.kind)} · {formatFileSize(file.sizeBytes)}</Text>
          </View>
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
      {form.version.fields
        .filter((field) => isVisible(field, form, answers))
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
    </View>
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
    return <Text style={styles.help}>{field.label}: attach files using the governed inspection evidence control above.</Text>;
  }
  if (field.fieldType === "BOOLEAN") {
    return (
      <Check
        label={`${field.label}${field.isRequired ? " *" : ""}`}
        checked={value === true}
        onPress={() => onChange(value !== true)}
      />
    );
  }
  if (field.fieldType === "SINGLE_SELECT") {
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>{field.label}{field.isRequired ? " *" : ""}</Text>
        <View style={styles.chips}>
          {options.map((option) => (
            <Chip key={option} label={option} active={value === option} onPress={() => onChange(option)} />
          ))}
        </View>
      </View>
    );
  }
  if (field.fieldType === "MULTI_SELECT") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>{field.label}{field.isRequired ? " *" : ""}</Text>
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
      </View>
    );
  }
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{field.label}{field.isRequired ? " *" : ""}</Text>
      {field.description ? <Text style={styles.help}>{field.description}</Text> : null}
      <Input
        value={typeof value === "string" ? value : ""}
        onChangeText={onChange}
        placeholder={field.placeholder || placeholderFor(field.fieldType)}
        multiline={field.fieldType === "LONG_TEXT"}
        keyboardType={
          field.fieldType === "NUMBER"
            ? "decimal-pad"
            : field.fieldType === "EMAIL"
              ? "email-address"
              : field.fieldType === "PHONE"
                ? "phone-pad"
                : "default"
        }
      />
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
      if (!isVisible(field, form, answers) || field.fieldType === "FILE") continue;
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
        if (!Number.isFinite(number)) {
          throw new Error(`${field.label} must be a valid number.`);
        }
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

function isVisible(
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
  ) {
    return true;
  }
  const controlling = form.version.fields.find(
    (item) => item.key === value.fieldKey
  );
  const actual = controlling ? answers[controlling.id] : undefined;
  return Array.isArray(actual)
    ? actual.includes(value.value)
    : String(actual ?? "") === value.value;
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
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
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

function RiskBadge({ level }: { level: string }) {
  const elevated = level === "HIGH" || level === "CRITICAL";
  return (
    <View style={[styles.riskBadge, elevated && styles.riskBadgeHigh]}>
      <Text style={[styles.riskBadgeText, elevated && styles.riskBadgeTextHigh]}>
        {humanize(level)}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const alert = [
    "OUT_OF_SERVICE",
    "QUARANTINED",
    "SUSPENDED",
    "EXPIRED",
    "OVERDUE",
    "DEFECT_FOUND",
    "CRITICAL",
  ].includes(status);
  const done = [
    "ACTIVE",
    "APPROVED",
    "SATISFACTORY",
    "COMPLETED",
    "VERIFIED",
    "CLOSED",
  ].includes(status);
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

function assetAtRisk(asset: MobileAsset) {
  return (
    asset.status !== "ACTIVE" ||
    overdue(asset.nextInspectionDueAt) ||
    overdue(asset.nextMaintenanceDueAt) ||
    asset.defects.some(
      (defect) =>
        defect.status !== "CLOSED" &&
        (defect.severity === "HIGH" || defect.severity === "CRITICAL")
    )
  );
}

function contractorAtRisk(contractor: MobileContractor) {
  return (
    contractor.status === "SUSPENDED" ||
    contractor.status === "EXPIRED" ||
    !contractor.insuranceExpiresAt ||
    overdue(contractor.insuranceExpiresAt) ||
    contractor.submittedFormCount < contractor.requiredFormCount ||
    contractor.sites.some((site) => Boolean(site.expiresAt && overdue(site.expiresAt))) ||
    contractor.workers.some(
      (worker) =>
        worker.status === "ACTIVE" &&
        (!worker.inductionCurrent || !worker.medicalCurrent)
    )
  );
}

function validFutureDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    parsed.getTime() > Date.now()
  );
}

function overdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function formatDateTime(value: string) {
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

function placeholderFor(type: RuntimeField["fieldType"]) {
  if (type === "DATE") return "YYYY-MM-DD";
  if (type === "DATETIME") return "YYYY-MM-DDTHH:mm:ssZ";
  if (type === "SIGNATURE") return "Type your full name";
  return "Enter a response";
}

function messageOf(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "The operational-control update could not be saved.";
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
  listItem: { gap: 7, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 11, marginTop: 3 },
  detail: { borderBottomWidth: 1, borderBottomColor: "#172a43", paddingBottom: 8, gap: 3 },
  detailValue: { color: "#dbeafe", fontSize: 14, lineHeight: 20 },
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
  evidencePanel: { gap: 7, borderRadius: 15, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", padding: 13 },
  evidenceFile: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 10 },
  remove: { color: "#fda4af", fontSize: 12, fontWeight: "700" },
  dynamicForm: { gap: 8, borderTopWidth: 1, borderTopColor: "#263a55", paddingTop: 12, marginTop: 4 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 11, marginVertical: 7 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#22d3ee", borderColor: "#22d3ee" },
  checkmark: { color: "#07111f", fontWeight: "900" },
  checkLabel: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 18 },
});
