import { useState, type ComponentProps, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { mobileApi } from "./api";
import type {
  MobileBootstrap,
  MobileExecutiveActionResponse,
  MobileExecutiveAiAnalysis,
  MobileExecutiveReport,
  MobileOperationalAssurance,
} from "./types";

export type ExecutiveCommandView =
  | "overview"
  | "assurance"
  | "reports"
  | "ai";

type Props = {
  workspace: MobileBootstrap;
  online: boolean;
  initialView: ExecutiveCommandView;
  onBack: () => void;
  onRefresh: () => Promise<MobileBootstrap>;
  onNotice: (message: string) => void;
  onOpenPath: (path: string) => Promise<void>;
};

const useCases = [
  "DAILY_BRIEFING",
  "EXECUTIVE_RISK",
  "AUDIT_FOCUS",
  "REGULATORY_IMPACT",
  "CONTROL_EFFECTIVENESS",
  "CUSTOM_QUERY",
] as const;

export function ExecutiveCommandScreen(props: Props) {
  const available = availableViews(props.workspace);
  const [view, setView] = useState<ExecutiveCommandView>(
    available.includes(props.initialView)
      ? props.initialView
      : (available[0] ?? "overview")
  );
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const analysis = props.workspace.executiveAiAnalyses?.find(
    (item) => item.id === analysisId
  );

  if (analysis) {
    return (
      <AnalysisDetail
        {...props}
        analysis={analysis}
        onBack={() => setAnalysisId(null)}
      />
    );
  }

  return (
    <Page>
      <Header title="Executive command center" onBack={props.onBack} />
      <Text style={styles.caption}>
        Tenant-scoped performance, connected assurance, reporting, and governed
        Premium intelligence in one leadership workspace.
      </Text>
      <Banner
        tone={props.online ? "good" : "warning"}
        text={
          props.online
            ? `Live tenant data · refreshed ${formatDate(
                props.workspace.executiveGeneratedAt
              )}`
            : "Showing the last encrypted workspace snapshot. Connect to refresh or generate intelligence."
        }
      />
      <View style={styles.chips}>
        {available.map((item) => (
          <Chip
            key={item}
            label={viewLabel(item)}
            active={view === item}
            onPress={() => setView(item)}
          />
        ))}
      </View>
      {view === "overview" ? (
        <Overview workspace={props.workspace} onOpenPath={props.onOpenPath} />
      ) : null}
      {view === "assurance" ? (
        <Assurance
          assurance={props.workspace.operationalAssurance}
          online={props.online}
          onOpenPath={props.onOpenPath}
        />
      ) : null}
      {view === "reports" ? (
        <Reports
          report={props.workspace.executiveReport}
          online={props.online}
          onOpenPath={props.onOpenPath}
        />
      ) : null}
      {view === "ai" ? (
        <Intelligence
          {...props}
          onOpenAnalysis={setAnalysisId}
        />
      ) : null}
    </Page>
  );
}

function Overview({
  workspace,
  onOpenPath,
}: {
  workspace: MobileBootstrap;
  onOpenPath: (path: string) => Promise<void>;
}) {
  const dashboard = workspace.executiveDashboard;
  const portfolio = workspace.executivePortfolio;
  if (!dashboard || !portfolio) {
    return <Empty text="Executive dashboard access is not assigned to this role." />;
  }

  return (
    <>
      <View style={styles.metrics}>
        <Metric label="Open incidents" value={dashboard.kpis.openIncidents} />
        <Metric
          label="High-risk incidents"
          value={dashboard.kpis.highRiskIncidents}
          tone={dashboard.kpis.highRiskIncidents ? "danger" : "good"}
        />
        <Metric
          label="Overdue actions"
          value={dashboard.kpis.overdueCorrectiveActions}
          tone={dashboard.kpis.overdueCorrectiveActions ? "danger" : "good"}
        />
        <Metric
          label="Portfolio attention"
          value={portfolio.attentionCount}
          tone={portfolio.attentionCount ? "warning" : "good"}
        />
      </View>

      <Section
        title="12-month operating trend"
        detail="Incidents and controlled-document activity"
      >
        <TrendRows
          rows={dashboard.charts.monthlyTrend.map((item) => ({
            label: item.month,
            primary: item.incidents,
            secondary: item.documents,
          }))}
          primaryLabel="Incidents"
          secondaryLabel="Documents"
        />
      </Section>

      <Section
        title="Enterprise portfolio"
        detail="Cross-module exposure ranked for leadership attention"
      >
        {portfolio.modules.map((module) => (
          <Pressable
            key={module.label}
            style={styles.listCard}
            onPress={() => {
              void onOpenPath(module.href);
            }}
          >
            <View style={styles.listHeading}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardTitle}>{module.label}</Text>
                <Text style={styles.muted}>{module.note}</Text>
              </View>
              <Status value={String(module.value)} tone={module.tone} />
            </View>
          </Pressable>
        ))}
      </Section>

      <Section title="Recent incidents" detail="Latest reported events">
        {dashboard.recentIncidents.map((incident) => (
          <Pressable
            key={incident.id}
            style={styles.listCard}
            onPress={() => {
              void onOpenPath(`/incidents/${incident.id}`);
            }}
          >
            <View style={styles.listHeading}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardTitle}>{incident.title}</Text>
                <Text style={styles.muted}>
                  {incident.site.name} · {formatDate(incident.occurredAt)}
                </Text>
              </View>
              <Status
                value={humanize(incident.riskLevel)}
                tone={riskTone(incident.riskLevel)}
              />
            </View>
          </Pressable>
        ))}
        {!dashboard.recentIncidents.length ? (
          <Empty text="No incidents were reported in this tenant." />
        ) : null}
      </Section>

      <Section
        title="Overdue corrective actions"
        detail="Immediate ownership attention"
      >
        {dashboard.overdueActions.map((action) => (
          <Pressable
            key={action.id}
            style={[styles.listCard, styles.dangerCard]}
            onPress={() => {
              void onOpenPath(
                action.incident ? `/incidents/${action.incident.id}` : "/actions"
              );
            }}
          >
            <Text style={styles.cardTitle}>{action.title}</Text>
            <Text style={styles.muted}>
              {action.assignedTo.name} · due {formatDate(action.dueDate)}
            </Text>
          </Pressable>
        ))}
        {!dashboard.overdueActions.length ? (
          <Empty text="No overdue corrective actions require attention." />
        ) : null}
      </Section>
    </>
  );
}

function Assurance({
  assurance,
  online,
  onOpenPath,
}: {
  assurance: MobileOperationalAssurance | null;
  online: boolean;
  onOpenPath: (path: string) => Promise<void>;
}) {
  if (!assurance) {
    return <Empty text="Operational Assurance access is not assigned to this role." />;
  }

  return (
    <>
      <View style={styles.metrics}>
        <Metric label="Elevated signals" value={assurance.signalCount} />
        <Metric
          label="Critical signals"
          value={assurance.criticalCount}
          tone={assurance.criticalCount ? "danger" : "good"}
        />
        <Metric label="Traceable links" value={assurance.connectionCount} />
      </View>
      <Section
        title="Priority signals"
        detail="Permission-filtered evidence requiring management attention"
      >
        {assurance.signals.map((signal) => (
          <Pressable
            key={signal.id}
            style={[
              styles.listCard,
              signal.severity === "CRITICAL" && styles.dangerCard,
            ]}
            disabled={!online}
            onPress={() => {
              void onOpenPath(signal.href);
            }}
          >
            <View style={styles.listHeading}>
              <View style={styles.flexCopy}>
                <Text style={styles.eyebrow}>
                  {signal.source}
                  {signal.site ? ` · ${signal.site}` : ""}
                </Text>
                <Text style={styles.cardTitle}>{signal.title}</Text>
                <Text style={styles.muted}>{signal.detail}</Text>
              </View>
              <Status
                value={signal.severity}
                tone={riskTone(signal.severity)}
              />
            </View>
          </Pressable>
        ))}
        {!assurance.signals.length ? (
          <Empty text="No elevated connected-risk signals are visible to this role." />
        ) : null}
      </Section>
      <Section
        title="Relationship coverage"
        detail="Traceable links between governed records"
      >
        {assurance.connections.map((connection) => (
          <Pressable
            key={connection.label}
            style={styles.listCard}
            disabled={!online}
            onPress={() => {
              void onOpenPath(connection.href);
            }}
          >
            <View style={styles.listHeading}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardTitle}>{connection.label}</Text>
                <Text style={styles.muted}>{connection.detail}</Text>
              </View>
              <Text style={styles.largeValue}>{connection.count}</Text>
            </View>
          </Pressable>
        ))}
      </Section>
    </>
  );
}

function Reports({
  report,
  online,
  onOpenPath,
}: {
  report: MobileExecutiveReport | null;
  online: boolean;
  onOpenPath: (path: string) => Promise<void>;
}) {
  if (!report) {
    return <Empty text="Executive reporting access is not assigned to this role." />;
  }

  return (
    <>
      <Text style={styles.caption}>
        {formatDate(report.filters.from)} through{" "}
        {formatDate(report.filters.to)} ·{" "}
        {report.filters.siteName ?? "All sites"}
      </Text>
      <View style={styles.metrics}>
        <Metric label="Total incidents" value={report.summary.totalIncidents} />
        <Metric
          label="Overdue exposure"
          value={report.summary.totalOverdueExposure}
          tone={report.summary.totalOverdueExposure ? "danger" : "good"}
        />
        <Metric
          label="CAPA closure"
          value={`${report.summary.correctiveActionClosureRate}%`}
        />
        <Metric
          label="Training completion"
          value={`${report.summary.trainingCompletionRate}%`}
        />
      </View>
      <Section
        title="Monthly performance"
        detail="Incidents compared with assurance activity"
      >
        <TrendRows
          rows={report.monthlyTrend.map((item) => ({
            label: item.month,
            primary: item.incidents,
            secondary: item.audits + item.inspections,
          }))}
          primaryLabel="Incidents"
          secondaryLabel="Audits + inspections"
        />
      </Section>
      <Section
        title="Site exposure"
        detail="Highest calculated operational exposure first"
      >
        {report.sitePerformance.map((site) => (
          <View key={site.siteId} style={styles.listCard}>
            <View style={styles.listHeading}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardTitle}>{site.siteName}</Text>
                <Text style={styles.muted}>
                  {site.openIncidents} open incidents ·{" "}
                  {site.overdueCorrectiveActions} overdue actions
                </Text>
              </View>
              <Status
                value={String(site.exposureScore)}
                tone={site.exposureScore ? "warning" : "good"}
              />
            </View>
          </View>
        ))}
      </Section>
      <Section
        title="Management attention"
        detail="Highest-priority records in the reporting period"
      >
        {report.managementAttention.map((item) => (
          <Pressable
            key={`${item.type}:${item.id}`}
            style={styles.listCard}
            disabled={!online}
            onPress={() => {
              void onOpenPath(item.link);
            }}
          >
            <View style={styles.listHeading}>
              <View style={styles.flexCopy}>
                <Text style={styles.eyebrow}>{humanize(item.type)}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.muted}>{item.description}</Text>
                <Text style={styles.due}>
                  {item.siteName ?? "All sites"}
                  {item.dueDate ? ` · due ${formatDate(item.dueDate)}` : ""}
                </Text>
              </View>
              {item.riskLevel ? (
                <Status
                  value={humanize(item.riskLevel)}
                  tone={riskTone(item.riskLevel)}
                />
              ) : null}
            </View>
          </Pressable>
        ))}
        {!report.managementAttention.length ? (
          <Empty text="No records require management attention in this period." />
        ) : null}
      </Section>
    </>
  );
}

function Intelligence(
  props: Props & { onOpenAnalysis: (id: string) => void }
) {
  const [useCase, setUseCase] =
    useState<(typeof useCases)[number]>("DAILY_BRIEFING");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const capabilities = props.workspace.executiveCapabilities;
  const metrics = props.workspace.executiveAiMetrics;

  async function generate() {
    if (!props.online) {
      setError("Connect to the internet to generate governed intelligence.");
      return;
    }
    if (useCase === "CUSTOM_QUERY" && !question.trim()) {
      setError("Enter a specific management question.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await mobileApi<MobileExecutiveActionResponse>(
        "/api/mobile/executive",
        {
          method: "POST",
          body: JSON.stringify({
            action: "GENERATE_AI_ANALYSIS",
            useCase,
            question: question.trim() || undefined,
          }),
        }
      );
      await props.onRefresh();
      props.onNotice(result.message);
      props.onOpenAnalysis(result.analysisId);
      setQuestion("");
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setBusy(false);
    }
  }

  if (!capabilities.canUseAi) {
    return <Empty text="Premium AI Intelligence is not available to this role." />;
  }

  return (
    <>
      <Banner
        tone="good"
        text="Review-only decision support · permission-filtered tenant sources · no autonomous record changes"
      />
      {metrics ? (
        <View style={styles.metrics}>
          <Metric label="Pending review" value={metrics.pending} tone="warning" />
          <Metric label="Approved" value={metrics.approved} tone="good" />
          <Metric label="Rejected" value={metrics.rejected} tone="danger" />
        </View>
      ) : null}
      <Section
        title="Generate leadership intelligence"
        detail="Every material statement must cite a captured tenant source"
      >
        <View style={styles.chips}>
          {useCases.map((item) => (
            <Chip
              key={item}
              label={humanize(item)}
              active={useCase === item}
              onPress={() => setUseCase(item)}
            />
          ))}
        </View>
        {useCase === "CUSTOM_QUERY" ? (
          <Input
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask a specific EHS management question"
            multiline
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={busy ? "Generating securely…" : "Generate analysis"}
          disabled={busy || !props.online}
          onPress={() => {
            void generate();
          }}
        />
      </Section>
      <Section
        title="Auditable intelligence register"
        detail="Recent review-only analyses and human dispositions"
      >
        {(props.workspace.executiveAiAnalyses ?? []).map((analysis) => (
          <Pressable
            key={analysis.id}
            style={styles.listCard}
            onPress={() => props.onOpenAnalysis(analysis.id)}
          >
            <View style={styles.listHeading}>
              <View style={styles.flexCopy}>
                <Text style={styles.eyebrow}>{humanize(analysis.useCase)}</Text>
                <Text style={styles.cardTitle}>{analysis.title}</Text>
                <Text style={styles.muted} numberOfLines={3}>
                  {analysis.executiveSummary}
                </Text>
                <Text style={styles.due}>
                  {analysis.sourceCount} cited sources ·{" "}
                  {formatDate(analysis.createdAt)}
                </Text>
              </View>
              <Status
                value={humanize(analysis.status)}
                tone={analysisStatusTone(analysis.status)}
              />
            </View>
          </Pressable>
        ))}
        {!props.workspace.executiveAiAnalyses?.length ? (
          <Empty text="No governed AI analyses have been generated." />
        ) : null}
      </Section>
    </>
  );
}

function AnalysisDetail(
  props: Props & {
    analysis: MobileExecutiveAiAnalysis;
    onBack: () => void;
  }
) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">(
    "APPROVED"
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [rating, setRating] = useState<"HELPFUL" | "NOT_HELPFUL">("HELPFUL");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function execute(payload: Record<string, unknown>) {
    if (!props.online) {
      setError("Connect to the internet to record this governed decision.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await mobileApi<MobileExecutiveActionResponse>(
        "/api/mobile/executive",
        { method: "POST", body: JSON.stringify(payload) }
      );
      await props.onRefresh();
      props.onNotice(result.message);
      setReviewNotes("");
      setComment("");
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Header title={props.analysis.title} onBack={props.onBack} />
      <View style={styles.listHeading}>
        <Text style={styles.eyebrow}>
          {humanize(props.analysis.useCase)} · {props.analysis.confidence} confidence
        </Text>
        <Status
          value={humanize(props.analysis.status)}
          tone={analysisStatusTone(props.analysis.status)}
        />
      </View>
      <Banner
        tone="warning"
        text="Decision support only. Qualified people must verify cited evidence and retain accountability for every operational or legal decision."
      />
      <Section title="Executive summary">
        <Text style={styles.body}>{props.analysis.executiveSummary}</Text>
        <Text style={styles.due}>
          Requested by {props.analysis.requestedBy.name} ·{" "}
          {props.analysis.sourceCount} cited sources
        </Text>
      </Section>
      <AiDetailSection
        title="Key risks"
        items={props.analysis.detail.keyRisks}
        titleKey="title"
        bodyKey="analysis"
        badgeKey="severity"
      />
      <AiDetailSection
        title="Trends"
        items={props.analysis.detail.trends}
        titleKey="title"
        bodyKey="analysis"
        badgeKey="direction"
      />
      <AiDetailSection
        title="Management priorities"
        items={props.analysis.detail.priorities}
        titleKey="title"
        bodyKey="rationale"
        badgeKey="urgency"
      />
      <AiDetailSection
        title="Questions for leadership"
        items={props.analysis.detail.managementQuestions}
        titleKey="question"
        bodyKey="rationale"
      />
      <Section title="Confidence and limitations">
        <Text style={styles.body}>{props.analysis.confidenceRationale}</Text>
        <Text style={styles.muted}>{props.analysis.limitations}</Text>
      </Section>
      <Section
        title="Cited tenant sources"
        detail="Captured evidence available when this analysis was generated"
      >
        {props.analysis.sources.map((source) => (
          <Pressable
            key={source.sourceKey}
            style={styles.listCard}
            disabled={!props.online}
            onPress={() => {
              void props.onOpenPath(source.href);
            }}
          >
            <Text style={styles.eyebrow}>
              {source.sourceKey} · {source.module}
            </Text>
            <Text style={styles.cardTitle}>{source.title}</Text>
            <Text style={styles.muted}>{source.summary}</Text>
          </Pressable>
        ))}
      </Section>
      {props.analysis.status === "PENDING_REVIEW" &&
      props.workspace.executiveCapabilities.canReviewAi ? (
        <Section
          title="Qualified human review"
          detail="The decision is final and fully auditable"
        >
          <View style={styles.chips}>
            <Chip
              label="Approve"
              active={decision === "APPROVED"}
              onPress={() => setDecision("APPROVED")}
            />
            <Chip
              label="Reject"
              active={decision === "REJECTED"}
              onPress={() => setDecision("REJECTED")}
            />
          </View>
          <Input
            value={reviewNotes}
            onChangeText={setReviewNotes}
            placeholder={
              decision === "REJECTED"
                ? "Explain the rejection (required)"
                : "Review notes (optional)"
            }
            multiline
          />
          <PrimaryButton
            label={busy ? "Recording decision…" : `Record ${decision.toLowerCase()}`}
            disabled={busy || !props.online}
            onPress={() => {
              void execute({
                action: "REVIEW_AI_ANALYSIS",
                analysisId: props.analysis.id,
                decision,
                notes: reviewNotes.trim() || undefined,
              });
            }}
          />
        </Section>
      ) : null}
      {props.analysis.reviewedBy ? (
        <Section title="Recorded review">
          <Text style={styles.body}>
            {humanize(props.analysis.status)} by{" "}
            {props.analysis.reviewedBy.name}
            {props.analysis.reviewedAt
              ? ` on ${formatDate(props.analysis.reviewedAt)}`
              : ""}
          </Text>
          {props.analysis.reviewNotes ? (
            <Text style={styles.muted}>{props.analysis.reviewNotes}</Text>
          ) : null}
        </Section>
      ) : null}
      <Section title="Analysis feedback">
        <View style={styles.chips}>
          <Chip
            label="Helpful"
            active={rating === "HELPFUL"}
            onPress={() => setRating("HELPFUL")}
          />
          <Chip
            label="Not helpful"
            active={rating === "NOT_HELPFUL"}
            onPress={() => setRating("NOT_HELPFUL")}
          />
        </View>
        <Input
          value={comment}
          onChangeText={setComment}
          placeholder="Optional feedback"
          multiline
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SecondaryButton
          label={busy ? "Saving feedback…" : "Save feedback"}
          disabled={busy || !props.online}
          onPress={() => {
            void execute({
              action: "RECORD_AI_FEEDBACK",
              analysisId: props.analysis.id,
              rating,
              comment: comment.trim() || undefined,
            });
          }}
        />
      </Section>
    </Page>
  );
}

function AiDetailSection({
  title,
  items,
  titleKey,
  bodyKey,
  badgeKey,
}: {
  title: string;
  items: AiDetailItem[];
  titleKey: string;
  bodyKey: string;
  badgeKey?: string;
}) {
  if (!items.length) return null;
  return (
    <Section title={title}>
      {items.map((item, index) => (
        <View key={`${aiItemText(item, titleKey)}:${index}`} style={styles.listCard}>
          <View style={styles.listHeading}>
            <View style={styles.flexCopy}>
              <Text style={styles.cardTitle}>{aiItemText(item, titleKey)}</Text>
              <Text style={styles.muted}>{aiItemText(item, bodyKey)}</Text>
              <Text style={styles.due}>
                {item.sourceKeys.join(" · ")}
              </Text>
            </View>
            {badgeKey ? (
              <Status value={humanize(aiItemText(item, badgeKey))} tone="neutral" />
            ) : null}
          </View>
        </View>
      ))}
    </Section>
  );
}

type AiDetailItem = {
  title?: string;
  analysis?: string;
  severity?: string;
  direction?: string;
  rationale?: string;
  urgency?: string;
  question?: string;
  sourceKeys: string[];
};

function aiItemText(item: AiDetailItem, key: string) {
  const value = item[key as keyof AiDetailItem];
  return typeof value === "string" ? value : "";
}

function TrendRows({
  rows,
  primaryLabel,
  secondaryLabel,
}: {
  rows: Array<{ label: string; primary: number; secondary: number }>;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [row.primary, row.secondary])
  );
  return (
    <>
      <Text style={styles.legend}>
        <Text style={styles.primaryLegend}>●</Text> {primaryLabel} ·{" "}
        <Text style={styles.secondaryLegend}>●</Text> {secondaryLabel}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.trendRow}>
          <Text style={styles.trendLabel}>{row.label}</Text>
          <View style={styles.barArea}>
            <View
              style={[
                styles.primaryBar,
                { width: `${Math.max(2, (row.primary / maximum) * 100)}%` },
              ]}
            />
            <View
              style={[
                styles.secondaryBar,
                { width: `${Math.max(2, (row.secondary / maximum) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.trendValue}>
            {row.primary}/{row.secondary}
          </Text>
        </View>
      ))}
    </>
  );
}

function availableViews(workspace: MobileBootstrap): ExecutiveCommandView[] {
  const views: ExecutiveCommandView[] = [];
  if (workspace.executiveCapabilities.canViewDashboard) {
    views.push("overview", "assurance");
  }
  if (workspace.executiveCapabilities.canViewReports) views.push("reports");
  if (workspace.executiveCapabilities.canUseAi) views.push("ai");
  return views.length ? views : ["overview"];
}

function Page({ children }: { children: ReactNode }) {
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

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: Tone;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === "danger" && styles.dangerText,
          tone === "warning" && styles.warningText,
          tone === "good" && styles.goodText,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Banner({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: Tone;
}) {
  return (
    <View
      style={[
        styles.banner,
        tone === "good" && styles.goodBanner,
        tone === "warning" && styles.warningBanner,
      ]}
    >
      <Text style={styles.bannerText}>{text}</Text>
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
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Input(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.multiline && styles.multiline]}
      placeholderTextColor="#64748b"
      textAlignVertical={props.multiline ? "top" : "center"}
    />
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.secondaryButton, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

type Tone = "danger" | "warning" | "good" | "neutral";

function Status({ value, tone }: { value: string; tone: Tone }) {
  return (
    <View
      style={[
        styles.status,
        tone === "danger" && styles.dangerStatus,
        tone === "warning" && styles.warningStatus,
        tone === "good" && styles.goodStatus,
      ]}
    >
      <Text style={styles.statusText}>{value}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function riskTone(value: string): Tone {
  return value === "CRITICAL"
    ? "danger"
    : value === "HIGH"
      ? "warning"
      : "neutral";
}

function analysisStatusTone(value: string): Tone {
  return value === "APPROVED"
    ? "good"
    : value === "REJECTED"
      ? "danger"
      : "warning";
}

function viewLabel(view: ExecutiveCommandView) {
  return view === "overview"
    ? "Overview"
    : view === "assurance"
      ? "Assurance"
      : view === "reports"
        ? "Reports"
        : "AI Intelligence";
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  });
}

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The executive action could not be completed.";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 20, paddingBottom: 120, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e3a4f",
    backgroundColor: "#0b1727",
  },
  backText: { color: "#67e8f9", fontSize: 31, lineHeight: 33 },
  title: { color: "#f8fafc", fontSize: 25, fontWeight: "800", flex: 1 },
  caption: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  body: { color: "#e2e8f0", fontSize: 15, lineHeight: 23 },
  muted: { color: "#94a3b8", fontSize: 13, lineHeight: 19 },
  due: { color: "#67e8f9", fontSize: 12, marginTop: 7 },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e3a4f",
    backgroundColor: "#0b1727",
    padding: 14,
  },
  goodBanner: { borderColor: "#14532d", backgroundColor: "#052e2b" },
  warningBanner: { borderColor: "#713f12", backgroundColor: "#291d0a" },
  bannerText: { color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1e3a4f",
    backgroundColor: "#0b1727",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: { borderColor: "#22d3ee", backgroundColor: "#083344" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#a5f3fc" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    width: "48%",
    minWidth: 145,
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0b1727",
    padding: 15,
  },
  metricLabel: { color: "#94a3b8", fontSize: 12 },
  metricValue: {
    color: "#f8fafc",
    fontSize: 27,
    fontWeight: "800",
    marginTop: 6,
  },
  dangerText: { color: "#fda4af" },
  warningText: { color: "#fcd34d" },
  goodText: { color: "#6ee7b7" },
  section: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#17263a",
    backgroundColor: "#091524",
    padding: 16,
  },
  sectionTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "800" },
  sectionBody: { marginTop: 13, gap: 10 },
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#07111f",
    padding: 14,
  },
  dangerCard: { borderColor: "#7f1d1d", backgroundColor: "#1f1017" },
  listHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  flexCopy: { flex: 1, gap: 4 },
  cardTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "700" },
  status: {
    borderRadius: 999,
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dangerStatus: { backgroundColor: "#4c0519" },
  warningStatus: { backgroundColor: "#422006" },
  goodStatus: { backgroundColor: "#052e2b" },
  statusText: { color: "#e2e8f0", fontSize: 10, fontWeight: "800" },
  largeValue: { color: "#67e8f9", fontSize: 25, fontWeight: "800" },
  legend: { color: "#94a3b8", fontSize: 11 },
  primaryLegend: { color: "#22d3ee" },
  secondaryLegend: { color: "#8b5cf6" },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trendLabel: { color: "#94a3b8", fontSize: 10, width: 63 },
  barArea: { flex: 1, gap: 3 },
  primaryBar: { height: 6, borderRadius: 6, backgroundColor: "#22d3ee" },
  secondaryBar: { height: 6, borderRadius: 6, backgroundColor: "#8b5cf6" },
  trendValue: {
    width: 45,
    textAlign: "right",
    color: "#cbd5e1",
    fontSize: 10,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#07111f",
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  multiline: { minHeight: 105 },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: "#22d3ee",
    alignItems: "center",
    padding: 14,
  },
  primaryButtonText: { color: "#06202a", fontWeight: "900", fontSize: 14 },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#22d3ee",
    alignItems: "center",
    padding: 13,
  },
  secondaryButtonText: { color: "#a5f3fc", fontWeight: "800", fontSize: 13 },
  disabled: { opacity: 0.45 },
  error: { color: "#fda4af", fontSize: 13, lineHeight: 19 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#334155",
    padding: 20,
    alignItems: "center",
  },
});
