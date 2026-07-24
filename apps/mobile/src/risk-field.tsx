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
  queueJsaAcknowledgment,
  queueRiskCapture,
  queueRiskReview,
} from "./storage";
import type {
  MobileBootstrap,
  MobileJsa,
  MobileRisk,
  RiskCapturePayload,
  RiskImpact,
  RiskLikelihood,
  RiskReviewPayload,
} from "./types";

export type RiskFieldView = "risks" | "jsa";

const likelihoods: readonly RiskLikelihood[] = [
  "RARE",
  "UNLIKELY",
  "POSSIBLE",
  "LIKELY",
  "ALMOST_CERTAIN",
];
const impacts: readonly RiskImpact[] = [
  "INSIGNIFICANT",
  "MINOR",
  "MODERATE",
  "MAJOR",
  "CATASTROPHIC",
];
const categories: readonly RiskCapturePayload["category"][] = [
  "SAFETY",
  "ENVIRONMENTAL",
  "OCCUPATIONAL_HEALTH",
  "OPERATIONAL",
  "COMPLIANCE",
  "SECURITY",
  "QUALITY",
  "STRATEGIC",
  "REPUTATIONAL",
  "FINANCIAL",
  "TECHNOLOGY",
  "OTHER",
];
const reviewFrequencies: readonly RiskCapturePayload["reviewFrequency"][] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "BIENNIAL",
  "AD_HOC",
];
const effectivenessValues = [
  "NOT_ASSESSED",
  "INEFFECTIVE",
  "WEAK",
  "PARTIALLY_EFFECTIVE",
  "EFFECTIVE",
  "HIGHLY_EFFECTIVE",
] as const;
const trendValues = ["IMPROVING", "STABLE", "DETERIORATING"] as const;

export function RiskFieldScreen({
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
  initialView: RiskFieldView;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [view, setView] = useState<RiskFieldView>(initialView);
  const [query, setQuery] = useState("");
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [selectedJsaId, setSelectedJsaId] = useState<string | null>(null);
  const [creatingRisk, setCreatingRisk] = useState(false);

  const selectedRisk = workspace.risks.find(
    (risk) => risk.id === selectedRiskId
  );
  const selectedJsa = workspace.jsas.find((jsa) => jsa.id === selectedJsaId);

  if (!workspace.riskCapabilities.canView) {
    return (
      <Page>
        <Header
          eyebrow="FIELD RISK"
          title="Access restricted"
          onBack={onBack}
        />
        <Empty text="Your role does not include Risk Register access." />
      </Page>
    );
  }

  if (selectedRisk) {
    return (
      <RiskDetail
        risk={selectedRisk}
        canManage={workspace.riskCapabilities.canManage}
        ownerKey={ownerKey}
        online={online}
        onBack={() => setSelectedRiskId(null)}
        onQueued={onQueued}
        onSync={onSync}
      />
    );
  }
  if (selectedJsa) {
    return (
      <JsaDetail
        jsa={selectedJsa}
        ownerKey={ownerKey}
        online={online}
        onBack={() => setSelectedJsaId(null)}
        onQueued={onQueued}
        onSync={onSync}
      />
    );
  }
  if (creatingRisk) {
    return (
      <RiskCapture
        workspace={workspace}
        ownerKey={ownerKey}
        online={online}
        onBack={() => setCreatingRisk(false)}
        onQueued={onQueued}
        onSync={onSync}
      />
    );
  }

  const normalized = query.trim().toLowerCase();
  const risks = workspace.risks.filter((risk) =>
    !normalized ||
    `${risk.reference} ${risk.title} ${risk.description} ${risk.category} ${risk.site?.name ?? ""}`
      .toLowerCase()
      .includes(normalized)
  );
  const jsas = workspace.jsas.filter((jsa) =>
    !normalized ||
    `${jsa.reference} ${jsa.title} ${jsa.jobDescription} ${jsa.site.name}`
      .toLowerCase()
      .includes(normalized)
  );

  return (
    <Page>
      <Header eyebrow="OFFLINE FIELD RISK" title="Risk and JSA" onBack={onBack} />
      <Text style={styles.muted}>
        Review tenant-authorized hazards and JSA controls from the encrypted
        workspace. Field updates remain queued while connectivity is unavailable.
      </Text>
      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline mode · New assessments, risk reviews, and JSA acknowledgments
            will synchronize automatically.
          </Text>
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip
          label={`Risk Register ${workspace.risks.length}`}
          active={view === "risks"}
          onPress={() => {
            setView("risks");
            setQuery("");
          }}
        />
        <Chip
          label={`JSA / JHA ${workspace.jsas.length}`}
          active={view === "jsa"}
          onPress={() => {
            setView("jsa");
            setQuery("");
          }}
        />
      </View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={view === "risks" ? "Search risks" : "Search JSA briefings"}
      />

      {view === "risks" ? (
        <>
          {workspace.riskCapabilities.canManage ? (
            <PrimaryButton
              label="Capture field risk assessment"
              onPress={() => setCreatingRisk(true)}
            />
          ) : null}
          {risks.map((risk) => (
            <Pressable key={risk.id} onPress={() => setSelectedRiskId(risk.id)}>
              <Card accent={isElevated(risk.currentRiskLevel)}>
                <View style={styles.cardHeading}>
                  <Text style={styles.kicker}>
                    {risk.reference} · {humanize(risk.status)}
                  </Text>
                  <RiskBadge
                    level={risk.currentRiskLevel}
                    score={risk.currentScore}
                  />
                </View>
                <Text style={styles.cardTitle}>{risk.title}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {risk.description}
                </Text>
                <Text style={styles.meta}>
                  {risk.site?.name ?? "Enterprise-wide"}
                  {risk.department ? ` · ${risk.department.name}` : ""}
                  {" · "}
                  Residual {humanize(risk.residualRiskLevel)} ({risk.residualScore})
                </Text>
                <Text style={overdue(risk.nextReviewDate) ? styles.overdue : styles.due}>
                  {risk.nextReviewDate
                    ? `${overdue(risk.nextReviewDate) ? "Review overdue" : "Next review"} ${formatDate(risk.nextReviewDate)}`
                    : "No review date assigned"}
                </Text>
              </Card>
            </Pressable>
          ))}
          {!risks.length ? <Empty text="No Risk Register records match this search." /> : null}
        </>
      ) : (
        <>
          {jsas.map((jsa) => (
            <Pressable key={jsa.id} onPress={() => setSelectedJsaId(jsa.id)}>
              <Card accent={jsa.status === "ACTIVE" && !jsa.acknowledgment}>
                <Text style={styles.kicker}>
                  {jsa.reference} v{jsa.version} · {humanize(jsa.status)}
                </Text>
                <Text style={styles.cardTitle}>{jsa.title}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {jsa.jobDescription}
                </Text>
                <Text style={styles.meta}>
                  {jsa.site.name}
                  {jsa.department ? ` · ${jsa.department.name}` : ""}
                  {" · "}
                  {jsa.steps.length} job step{jsa.steps.length === 1 ? "" : "s"}
                </Text>
                <Text
                  style={
                    jsa.acknowledgment
                      ? styles.success
                      : jsa.status === "ACTIVE"
                        ? styles.due
                        : styles.meta
                  }
                >
                  {jsa.acknowledgment
                    ? `Acknowledged ${formatDate(jsa.acknowledgment.acknowledgedAt)}`
                    : jsa.status === "ACTIVE"
                      ? "Briefing acknowledgment required"
                      : "Not currently active"}
                </Text>
              </Card>
            </Pressable>
          ))}
          {!jsas.length ? <Empty text="No JSA/JHA records match this search." /> : null}
        </>
      )}
    </Page>
  );
}

function RiskCapture({
  workspace,
  ownerKey,
  online,
  onBack,
  onQueued,
  onSync,
}: {
  workspace: MobileBootstrap;
  ownerKey: string;
  online: boolean;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [siteId, setSiteId] = useState(workspace.sites[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hazardType, setHazardType] = useState("");
  const [process, setProcess] = useState("");
  const [category, setCategory] =
    useState<RiskCapturePayload["category"]>("SAFETY");
  const [initialLikelihood, setInitialLikelihood] =
    useState<RiskLikelihood>("POSSIBLE");
  const [initialImpact, setInitialImpact] = useState<RiskImpact>("MODERATE");
  const [residualLikelihood, setResidualLikelihood] =
    useState<RiskLikelihood>("UNLIKELY");
  const [residualImpact, setResidualImpact] = useState<RiskImpact>("MINOR");
  const [reviewFrequency, setReviewFrequency] =
    useState<RiskCapturePayload["reviewFrequency"]>("QUARTERLY");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const departments = workspace.departments.filter(
    (department) => department.siteId === siteId
  );

  const save = async () => {
    setError("");
    if (!siteId || title.trim().length < 2 || description.trim().length < 2) {
      setError("Site, title, and description are required.");
      return;
    }
    if (nextReviewDate && !validFutureDate(nextReviewDate)) {
      setError("Next review date must use YYYY-MM-DD and be in the future.");
      return;
    }
    setSaving(true);
    try {
      await queueRiskCapture(ownerKey, {
        siteId,
        departmentId: departmentId || undefined,
        title: title.trim(),
        description: description.trim(),
        category,
        hazardType: hazardType.trim() || undefined,
        process: process.trim() || undefined,
        initialLikelihood,
        initialImpact,
        residualLikelihood,
        residualImpact,
        reviewFrequency,
        nextReviewDate: nextReviewDate || undefined,
      });
      await onQueued(
        online
          ? "Risk assessment queued for secure synchronization."
          : "Risk assessment encrypted and saved offline."
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
    <Page>
      <Header
        eyebrow="FIELD ASSESSMENT"
        title="Capture risk"
        onBack={onBack}
      />
      <FieldLabel text="Site *" />
      <ChipGroup
        values={workspace.sites.map((site) => ({
          value: site.id,
          label: site.name,
        }))}
        selected={siteId}
        onSelect={(value) => {
          setSiteId(value);
          setDepartmentId("");
        }}
      />
      {departments.length ? (
        <>
          <FieldLabel text="Department" />
          <ChipGroup
            values={[
              { value: "", label: "No department" },
              ...departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
            selected={departmentId}
            onSelect={setDepartmentId}
          />
        </>
      ) : null}
      <FieldLabel text="Risk title *" />
      <Input value={title} onChangeText={setTitle} placeholder="Hazard or exposure" />
      <FieldLabel text="Description *" />
      <Input
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the hazard, exposure, and potential consequence"
        multiline
      />
      <FieldLabel text="Hazard type" />
      <Input
        value={hazardType}
        onChangeText={setHazardType}
        placeholder="e.g. mobile equipment, chemical exposure"
      />
      <FieldLabel text="Process or activity" />
      <Input
        value={process}
        onChangeText={setProcess}
        placeholder="Work process or operation"
      />
      <FieldLabel text="Category *" />
      <EnumChips values={categories} selected={category} onSelect={setCategory} />
      <Card>
        <Text style={styles.cardTitle}>Initial exposure</Text>
        <FieldLabel text="Likelihood *" />
        <EnumChips
          values={likelihoods}
          selected={initialLikelihood}
          onSelect={setInitialLikelihood}
        />
        <FieldLabel text="Impact *" />
        <EnumChips
          values={impacts}
          selected={initialImpact}
          onSelect={setInitialImpact}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Expected residual exposure</Text>
        <Text style={styles.muted}>
          Rate the remaining exposure after the controls identified in the
          assessment are operating.
        </Text>
        <FieldLabel text="Residual likelihood *" />
        <EnumChips
          values={likelihoods}
          selected={residualLikelihood}
          onSelect={setResidualLikelihood}
        />
        <FieldLabel text="Residual impact *" />
        <EnumChips
          values={impacts}
          selected={residualImpact}
          onSelect={setResidualImpact}
        />
      </Card>
      <FieldLabel text="Review frequency *" />
      <EnumChips
        values={reviewFrequencies}
        selected={reviewFrequency}
        onSelect={setReviewFrequency}
      />
      <FieldLabel text="Next review date" />
      <Input
        value={nextReviewDate}
        onChangeText={setNextReviewDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={saving ? "Securing assessment…" : "Save field assessment"}
        disabled={saving}
        onPress={() => {
          void save();
        }}
      />
    </Page>
  );
}

function RiskDetail({
  risk,
  canManage,
  ownerKey,
  online,
  onBack,
  onQueued,
  onSync,
}: {
  risk: MobileRisk;
  canManage: boolean;
  ownerKey: string;
  online: boolean;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  return (
    <Page>
      <Header eyebrow={risk.reference} title={risk.title} onBack={onBack} />
      <View style={styles.ratingGrid}>
        <Rating
          label="Current risk"
          level={risk.currentRiskLevel}
          score={risk.currentScore}
        />
        <Rating
          label="Residual risk"
          level={risk.residualRiskLevel}
          score={risk.residualScore}
        />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Risk context</Text>
        <Text style={styles.muted}>{risk.description}</Text>
        <Text style={styles.meta}>
          {humanize(risk.category)} · {humanize(risk.status)}
        </Text>
        <Text style={styles.meta}>
          {risk.site?.name ?? "Enterprise-wide"}
          {risk.department ? ` · ${risk.department.name}` : ""}
          {risk.owner ? ` · Owner: ${risk.owner.name}` : ""}
        </Text>
        {risk.hazardType ? (
          <Text style={styles.meta}>Hazard: {risk.hazardType}</Text>
        ) : null}
        {risk.process ? <Text style={styles.meta}>Process: {risk.process}</Text> : null}
        <Text style={styles.meta}>
          {risk.reviewCount} completed review{risk.reviewCount === 1 ? "" : "s"} ·{" "}
          {humanize(risk.reviewFrequency)}
        </Text>
        <Text style={overdue(risk.nextReviewDate) ? styles.overdue : styles.due}>
          {risk.nextReviewDate
            ? `${overdue(risk.nextReviewDate) ? "Review overdue" : "Next review"} ${formatDate(risk.nextReviewDate)}`
            : "No next review date"}
        </Text>
      </Card>
      <Text style={styles.sectionTitle}>Controls</Text>
      {risk.controls.map((control) => (
        <Card key={control.id} accent={control.status === "OVERDUE"}>
          <Text style={styles.kicker}>
            {humanize(control.hierarchy)} · {humanize(control.controlType)}
          </Text>
          <Text style={styles.cardTitle}>{control.name}</Text>
          {control.description ? (
            <Text style={styles.muted}>{control.description}</Text>
          ) : null}
          <Text style={styles.meta}>
            {humanize(control.status)} · {humanize(control.effectiveness)}
          </Text>
        </Card>
      ))}
      {!risk.controls.length ? <Empty text="No controls have been recorded." /> : null}
      {canManage ? (
        reviewing ? (
          <RiskReviewForm
            risk={risk}
            ownerKey={ownerKey}
            online={online}
            onCancel={() => setReviewing(false)}
            onQueued={onQueued}
            onSync={onSync}
          />
        ) : (
          <PrimaryButton label="Complete field risk review" onPress={() => setReviewing(true)} />
        )
      ) : (
        <Text style={styles.muted}>
          This record is read-only because your role does not include risk
          management.
        </Text>
      )}
    </Page>
  );
}

function RiskReviewForm({
  risk,
  ownerKey,
  online,
  onCancel,
  onQueued,
  onSync,
}: {
  risk: MobileRisk;
  ownerKey: string;
  online: boolean;
  onCancel: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [likelihood, setLikelihood] = useState<RiskLikelihood>(
    risk.currentLikelihood
  );
  const [impact, setImpact] = useState<RiskImpact>(risk.currentImpact);
  const [controlEffectiveness, setControlEffectiveness] =
    useState<NonNullable<RiskReviewPayload["controlEffectiveness"]>>(
      "NOT_ASSESSED"
    );
  const [trend, setTrend] =
    useState<NonNullable<RiskReviewPayload["trend"]>>("STABLE");
  const [notes, setNotes] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (notes.trim().length < 2) {
      setError("Add review notes describing the field verification.");
      return;
    }
    if (nextReviewDate && !validFutureDate(nextReviewDate)) {
      setError("Next review date must use YYYY-MM-DD and be in the future.");
      return;
    }
    setSaving(true);
    try {
      await queueRiskReview(ownerKey, {
        riskId: risk.id,
        likelihood,
        impact,
        controlEffectiveness,
        trend,
        notes: notes.trim(),
        nextReviewDate: nextReviewDate || undefined,
      });
      await onQueued(
        online
          ? "Risk review queued for secure synchronization."
          : "Risk review encrypted and saved offline."
      );
      if (online) onSync();
      onCancel();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card accent>
      <Text style={styles.cardTitle}>Field risk review</Text>
      <FieldLabel text="Current likelihood *" />
      <EnumChips
        values={likelihoods}
        selected={likelihood}
        onSelect={setLikelihood}
      />
      <FieldLabel text="Current impact *" />
      <EnumChips values={impacts} selected={impact} onSelect={setImpact} />
      <FieldLabel text="Control effectiveness" />
      <EnumChips
        values={effectivenessValues}
        selected={controlEffectiveness}
        onSelect={setControlEffectiveness}
      />
      <FieldLabel text="Risk trend" />
      <EnumChips values={trendValues} selected={trend} onSelect={setTrend} />
      <FieldLabel text="Verification notes *" />
      <Input
        value={notes}
        onChangeText={setNotes}
        placeholder="Controls observed, gaps, changes, and required follow-up"
        multiline
      />
      <FieldLabel text="Next review date" />
      <Input
        value={nextReviewDate}
        onChangeText={setNextReviewDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={saving ? "Securing review…" : "Save field review"}
        disabled={saving}
        onPress={() => {
          void save();
        }}
      />
      <SecondaryButton label="Cancel" disabled={saving} onPress={onCancel} />
    </Card>
  );
}

function JsaDetail({
  jsa,
  ownerKey,
  online,
  onBack,
  onQueued,
  onSync,
}: {
  jsa: MobileJsa;
  ownerKey: string;
  online: boolean;
  onBack: () => void;
  onQueued: (message: string) => Promise<void>;
  onSync: () => void;
}) {
  const [statement, setStatement] = useState(
    "I understand this JSA/JHA, its hazards, and the required controls."
  );
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");
  const canAcknowledge = jsa.status === "ACTIVE" && !jsa.acknowledgment && !queued;

  const acknowledge = async () => {
    setError("");
    if (statement.trim().length < 5) {
      setError("Enter an acknowledgment statement.");
      return;
    }
    setSaving(true);
    try {
      await queueJsaAcknowledgment(ownerKey, {
        jsaId: jsa.id,
        statement: statement.trim(),
      });
      setQueued(true);
      await onQueued(
        online
          ? "JSA acknowledgment queued for secure synchronization."
          : "JSA acknowledgment encrypted and saved offline."
      );
      if (online) onSync();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header
        eyebrow={`${jsa.reference} v${jsa.version}`}
        title={jsa.title}
        onBack={onBack}
      />
      <Card accent={jsa.status === "ACTIVE"}>
        <Text style={styles.kicker}>{humanize(jsa.status)}</Text>
        <Text style={styles.muted}>{jsa.jobDescription}</Text>
        <Text style={styles.meta}>
          {jsa.site.name}
          {jsa.department ? ` · ${jsa.department.name}` : ""}
          {jsa.workLocation ? ` · ${jsa.workLocation}` : ""}
        </Text>
        {jsa.requiredCompetency ? (
          <Text style={styles.meta}>Competency: {jsa.requiredCompetency}</Text>
        ) : null}
        {jsa.requiredPpe ? (
          <Text style={styles.meta}>Required PPE: {jsa.requiredPpe}</Text>
        ) : null}
        {jsa.emergencyRequirements ? (
          <Text style={styles.meta}>
            Emergency requirements: {jsa.emergencyRequirements}
          </Text>
        ) : null}
      </Card>
      <Text style={styles.sectionTitle}>Job steps and controls</Text>
      {jsa.steps.map((step) => (
        <Card key={step.id}>
          <Text style={styles.kicker}>STEP {step.sequence}</Text>
          <Text style={styles.cardTitle}>{step.taskStep}</Text>
          {step.hazards.map((hazard) => (
            <View key={hazard.id} style={styles.hazardPanel}>
              <Text style={styles.hazardTitle}>Hazard: {hazard.hazard}</Text>
              <Text style={styles.muted}>
                Consequence: {hazard.potentialConsequence}
              </Text>
              <Text style={styles.meta}>
                Initial score {hazard.initialScore} · Residual score{" "}
                {hazard.residualScore}
              </Text>
              {hazard.controls.map((control) => (
                <View key={control.id} style={styles.controlRow}>
                  <Text style={styles.controlBullet}>✓</Text>
                  <View style={styles.controlCopy}>
                    <Text style={styles.controlText}>{control.description}</Text>
                    <Text style={styles.meta}>
                      {humanize(control.hierarchy)}
                      {control.responsibleRole
                        ? ` · ${control.responsibleRole}`
                        : ""}
                      {control.verificationRequired
                        ? " · Verification required"
                        : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </Card>
      ))}
      {!jsa.steps.length ? <Empty text="No task steps are available in this JSA." /> : null}
      {jsa.acknowledgment ? (
        <Card accent>
          <Text style={styles.success}>Acknowledgment complete</Text>
          <Text style={styles.muted}>{jsa.acknowledgment.statement}</Text>
          <Text style={styles.meta}>
            {formatDate(jsa.acknowledgment.acknowledgedAt)}
          </Text>
        </Card>
      ) : queued ? (
        <Card accent>
          <Text style={styles.success}>Acknowledgment securely queued</Text>
          <Text style={styles.muted}>
            It will be recorded against your tenant account when synchronization
            completes.
          </Text>
        </Card>
      ) : canAcknowledge ? (
        <Card accent>
          <Text style={styles.cardTitle}>Worker acknowledgment</Text>
          <Text style={styles.muted}>
            Confirm only after reviewing every job step, hazard, and required
            control above.
          </Text>
          <Input value={statement} onChangeText={setStatement} multiline />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={saving ? "Securing acknowledgment…" : "Acknowledge JSA / JHA"}
            disabled={saving}
            onPress={() => {
              void acknowledge();
            }}
          />
        </Card>
      ) : (
        <Text style={styles.muted}>
          Acknowledgment is available only while this JSA/JHA is active.
        </Text>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageInner}
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
      <SecondaryButton label="← Back" onPress={onBack} />
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
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

function Rating({
  label,
  level,
  score,
}: {
  label: string;
  level: string;
  score: number;
}) {
  return (
    <View style={styles.rating}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.ratingScore}>{score}</Text>
      <Text style={riskTextStyle(level)}>{humanize(level)}</Text>
    </View>
  );
}

function RiskBadge({ level, score }: { level: string; score: number }) {
  return (
    <View style={styles.riskBadge}>
      <Text style={riskTextStyle(level)}>
        {humanize(level)} · {score}
      </Text>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#64748b"
      style={[
        styles.input,
        props.multiline && styles.multiline,
        props.style,
      ]}
    />
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChipGroup({
  values,
  selected,
  onSelect,
}: {
  values: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {values.map((item) => (
        <Chip
          key={`${item.value}:${item.label}`}
          label={item.label}
          active={selected === item.value}
          onPress={() => onSelect(item.value)}
        />
      ))}
    </View>
  );
}

function EnumChips<T extends string>({
  values,
  selected,
  onSelect,
}: {
  values: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {values.map((value) => (
        <Chip
          key={value}
          label={humanize(value)}
          active={selected === value}
          onPress={() => onSelect(value)}
        />
      ))}
    </View>
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

function isElevated(level: string) {
  return level === "HIGH" || level === "CRITICAL";
}

function overdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function validFutureDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function riskTextStyle(level: string) {
  if (level === "CRITICAL") return styles.critical;
  if (level === "HIGH") return styles.high;
  if (level === "MEDIUM") return styles.medium;
  return styles.low;
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#07111f" },
  pageInner: { padding: 20, paddingBottom: 120, gap: 13 },
  header: { gap: 8, marginBottom: 2 },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 4,
  },
  title: { color: "#f8fafc", fontSize: 30, lineHeight: 37, fontWeight: "800" },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 7,
  },
  muted: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  meta: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  due: { color: "#67e8f9", fontSize: 12, lineHeight: 18 },
  overdue: { color: "#fda4af", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  success: { color: "#6ee7b7", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
  offlineBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f59e0b55",
    backgroundColor: "#78350f33",
    padding: 14,
  },
  offlineText: { color: "#fde68a", fontSize: 13, lineHeight: 19 },
  card: {
    borderRadius: 18,
    padding: 17,
    gap: 8,
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#172a43",
  },
  cardAccent: { borderColor: "#22d3ee" },
  cardHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  kicker: {
    flex: 1,
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardTitle: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
  riskBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263a55",
    backgroundColor: "#091525",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  critical: { color: "#fda4af", fontSize: 12, fontWeight: "800" },
  high: { color: "#fdba74", fontSize: 12, fontWeight: "800" },
  medium: { color: "#fde68a", fontSize: 12, fontWeight: "800" },
  low: { color: "#6ee7b7", fontSize: 12, fontWeight: "800" },
  ratingGrid: { flexDirection: "row", gap: 10 },
  rating: {
    flex: 1,
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#172a43",
    padding: 15,
    justifyContent: "space-between",
  },
  ratingScore: { color: "#f8fafc", fontSize: 30, fontWeight: "800" },
  hazardPanel: {
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#263a55",
    paddingTop: 11,
    marginTop: 3,
  },
  hazardTitle: { color: "#dbeafe", fontSize: 14, fontWeight: "700" },
  controlRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  controlBullet: { color: "#6ee7b7", fontSize: 14, fontWeight: "900" },
  controlCopy: { flex: 1, gap: 2 },
  controlText: { color: "#cbd5e1", fontSize: 13, lineHeight: 18 },
  label: { color: "#dbeafe", fontWeight: "700", fontSize: 13, marginTop: 4 },
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263a55",
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#091525",
  },
  chipActive: { borderColor: "#67e8f9", backgroundColor: "#123047" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#cffafe" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 5,
  },
  primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 },
  secondaryButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2d4964",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.55 },
  empty: {
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
    borderRadius: 18,
    padding: 24,
  },
});
