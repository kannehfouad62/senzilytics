import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { MobileAuditServiceEngagement, MobileBootstrap } from "./types";

export function AuditServicesScreen({
  workspace,
  online,
  onBack,
  onRefresh,
  onNotice,
}: {
  workspace: MobileBootstrap;
  online: boolean;
  onBack: () => void;
  onRefresh: () => Promise<MobileBootstrap>;
  onNotice: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const normalized = query.trim().toLowerCase();
  const engagements = useMemo(() => workspace.auditServiceEngagements.filter((record) =>
    !normalized || `${record.reference} ${record.title} ${record.client?.name ?? "internal"} ${record.status}`.toLowerCase().includes(normalized),
  ), [normalized, workspace.auditServiceEngagements]);
  const metrics = workspace.auditServiceMetrics;

  const refresh = async () => {
    if (!online) {
      onNotice("Connect to refresh audit-service coordination. The last encrypted workspace remains available read-only.");
      return;
    }
    setRefreshing(true);
    try {
      await onRefresh();
      onNotice("Audit-service workspace refreshed.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Audit-service refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Pressable onPress={onBack}><Text style={styles.back}>← Authorized workspace</Text></Pressable>
    <Text style={styles.eyebrow}>AUDIT & ASSURANCE SERVICES</Text>
    <Text style={styles.title}>Delivery command center</Text>
    <Text style={styles.muted}>Assigned client engagements, evidence requests, meetings, secure external reviews, findings, and governed deliverables. External clients continue to use expiring passcode-protected links—not tenant accounts.</Text>
    <View style={styles.actions}>
      <Button label={refreshing ? "Refreshing…" : "Refresh"} disabled={refreshing} onPress={() => void refresh()} />
    </View>
    {workspace.auditServiceCapabilities.onlineOnlyWrites ? <Text style={styles.controlNote}>Governed changes require an authenticated online session.</Text> : null}
    {!online ? <View style={styles.warning}><Text style={styles.warningText}>Offline snapshot · coordination changes and external-access administration require a secure connection.</Text></View> : null}
    <View style={styles.metrics}>
      <Metric label="Active" value={metrics.activeEngagements} />
      <Metric label="Overdue" value={metrics.overdueEngagements} alert={metrics.overdueEngagements > 0} />
      <Metric label="Open requests" value={metrics.openRequests} />
      <Metric label="External review" value={metrics.externalReviewsPending} />
      <Metric label="Deliverables" value={metrics.deliverablesInReview} />
      <Metric label="Released" value={metrics.releasedDeliverables} />
    </View>
    <TextInput value={query} onChangeText={setQuery} placeholder="Search engagement, client, status…" placeholderTextColor="#64748b" style={styles.search} autoCapitalize="none" />
    <Text style={styles.section}>Engagement portfolio · {engagements.length}</Text>
    {engagements.map((engagement) => <EngagementCard key={engagement.id} engagement={engagement} />)}
    {!engagements.length ? <View style={styles.empty}><Text style={styles.muted}>{normalized ? "No authorized engagement matches this search." : "No audit-service engagement is assigned or available to this user."}</Text></View> : null}
    <Text style={styles.timestamp}>Verified {new Date(workspace.auditServiceGeneratedAt).toLocaleString()}</Text>
  </ScrollView>;
}

function EngagementCard({ engagement }: { engagement: MobileAuditServiceEngagement }) {
  const [expanded, setExpanded] = useState(false);
  const openRequests = engagement.informationRequests.filter((item) => !["ACCEPTED", "CLOSED", "CANCELLED"].includes(item.status)).length;
  const pendingReviews = engagement.externalAccesses.filter((item) => item.status === "ACTIVE" && !item.decision && !item.findingResponse).length;
  const reviewDeliverables = engagement.deliverables.filter((item) => ["UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED"].includes(item.status)).length;
  return <View style={styles.card}>
    <View style={styles.cardHeader}><View style={styles.flex}><Text style={styles.reference}>{engagement.reference} · {humanize(engagement.kind)}</Text><Text style={styles.cardTitle}>{engagement.title}</Text><Text style={styles.muted}>{engagement.client?.name ?? "Internal assurance engagement"}</Text></View><Status value={engagement.status} /></View>
    <Text style={styles.detail} numberOfLines={2}>{engagement.purpose}</Text>
    <View style={styles.factRow}><Fact label="Planning" value={humanize(engagement.planningStatus)} /><Fact label="Risk" value={humanize(engagement.riskRating)} /><Fact label="Due" value={engagement.dueDate ? formatDate(engagement.dueDate) : "Not set"} /></View>
    <Text style={styles.people}>Manager: {engagement.manager?.name ?? "Unassigned"} · Lead: {engagement.leadAuditor?.name ?? "Unassigned"} · Team: {engagement.teamMembers.length}</Text>
    <View style={styles.queue}><Queue label="Requests" value={openRequests} /><Queue label="Meetings" value={engagement.meetings.filter((item) => item.status === "SCHEDULED").length} /><Queue label="Client review" value={pendingReviews} /><Queue label="Reports" value={reviewDeliverables} /></View>
    {(expanded ? engagement.externalAccesses : engagement.externalAccesses.slice(0, 2)).map((access) => <Text key={access.id} style={styles.signal}>External: {humanize(access.scope)} · {access.decision ? humanize(access.decision.decision) : access.findingResponse ? humanize(access.findingResponse.reviewStatus) : humanize(access.status)} · {access.contact.name}</Text>)}
    {expanded ? <View style={styles.nativeDetail}><Text style={styles.detail}>Information requests: {engagement.informationRequests.length}</Text><Text style={styles.detail}>Meetings: {engagement.meetings.length}</Text><Text style={styles.detail}>External review links: {engagement.externalAccesses.length}</Text><Text style={styles.detail}>Governed deliverables: {engagement.deliverables.length}</Text><Text style={styles.controlNote}>This engagement remains inside the native app. Refresh to retrieve authorized online changes.</Text></View> : null}
    <Button label={expanded ? "Hide native details" : "View native engagement details"} onPress={() => setExpanded((value) => !value)} />
  </View>;
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <View style={[styles.metric, alert && styles.alert]}><Text style={[styles.metricValue, alert && styles.alertText]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Fact({ label, value }: { label: string; value: string }) { return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>; }
function Queue({ label, value }: { label: string; value: number }) { return <View style={styles.queueItem}><Text style={styles.queueValue}>{value}</Text><Text style={styles.queueLabel}>{label}</Text></View>; }
function Status({ value }: { value: string }) { return <View style={styles.status}><Text style={styles.statusText}>{humanize(value)}</Text></View>; }
function Button({ label, disabled = false, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>; }
const humanize = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const formatDate = (value: string) => new Date(value).toLocaleDateString();

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07111f" }, content: { padding: 20, paddingBottom: 120, gap: 14 }, back: { color: "#67e8f9", fontWeight: "700", marginBottom: 4 }, eyebrow: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, title: { color: "#f8fafc", fontSize: 30, fontWeight: "800" }, muted: { color: "#94a3b8", lineHeight: 20 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, controlNote: { color: "#64748b", fontSize: 11 }, warning: { borderColor: "#f59e0b55", borderWidth: 1, borderRadius: 14, backgroundColor: "#f59e0b12", padding: 12 }, warningText: { color: "#fcd34d", fontSize: 12, lineHeight: 18 }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, metric: { width: "31%", minWidth: 96, borderWidth: 1, borderColor: "#ffffff18", borderRadius: 14, backgroundColor: "#ffffff08", padding: 12 }, alert: { borderColor: "#fb718555", backgroundColor: "#fb718510" }, metricValue: { color: "#f8fafc", fontSize: 24, fontWeight: "800" }, alertText: { color: "#fda4af" }, metricLabel: { color: "#94a3b8", fontSize: 11, marginTop: 3 }, search: { color: "#f8fafc", borderWidth: 1, borderColor: "#ffffff20", borderRadius: 14, backgroundColor: "#020617aa", paddingHorizontal: 14, paddingVertical: 12 }, section: { color: "#e2e8f0", fontSize: 18, fontWeight: "700", marginTop: 4 }, card: { borderWidth: 1, borderColor: "#ffffff18", borderRadius: 20, backgroundColor: "#ffffff08", padding: 16, gap: 12 }, cardHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, flex: { flex: 1 }, reference: { color: "#67e8f9", fontSize: 11, fontWeight: "700" }, cardTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "800", marginTop: 3 }, detail: { color: "#cbd5e1", lineHeight: 19 }, nativeDetail: { gap: 5, borderRadius: 12, borderWidth: 1, borderColor: "#22d3ee33", backgroundColor: "#02061766", padding: 12 }, status: { backgroundColor: "#22d3ee18", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: "#67e8f9", fontSize: 10, fontWeight: "700" }, factRow: { flexDirection: "row", gap: 8 }, fact: { flex: 1, borderTopWidth: 1, borderTopColor: "#ffffff12", paddingTop: 8 }, factLabel: { color: "#64748b", fontSize: 10 }, factValue: { color: "#e2e8f0", fontSize: 11, fontWeight: "700", marginTop: 3 }, people: { color: "#94a3b8", fontSize: 11 }, queue: { flexDirection: "row", gap: 6 }, queueItem: { flex: 1, alignItems: "center", backgroundColor: "#02061766", borderRadius: 10, padding: 8 }, queueValue: { color: "#f8fafc", fontWeight: "800" }, queueLabel: { color: "#64748b", fontSize: 9, marginTop: 2 }, signal: { color: "#cbd5e1", fontSize: 11, borderLeftWidth: 2, borderLeftColor: "#22d3ee", paddingLeft: 8 }, button: { borderWidth: 1, borderColor: "#22d3ee55", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" }, buttonText: { color: "#67e8f9", fontWeight: "700", fontSize: 12 }, disabled: { opacity: 0.45 }, empty: { borderWidth: 1, borderStyle: "dashed", borderColor: "#ffffff20", borderRadius: 18, padding: 24 }, timestamp: { color: "#475569", textAlign: "center", fontSize: 10, marginTop: 8 },
});
