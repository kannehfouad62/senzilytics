import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Network from "expo-network";
import * as Linking from "expo-linking";
import { beginMobileSignIn, clearMobileSession, getStoredMobileOwnerKey, loadMobileWorkspace, logoutMobileSession, mobileApi, MobileApiError, mobileWebUrl, restoreMobileSession } from "./src/api";
import { ActionCenterScreen, type ActionCenterView } from "./src/action-center";
import { RiskFieldScreen, type RiskFieldView } from "./src/risk-field";
import {
  capturePhotoEvidence,
  MAX_EVIDENCE_FILES_PER_RECORD,
  pickEvidenceFiles,
  pickPhotoEvidence,
  type SelectedEvidence,
} from "./src/evidence";
import { registerForMobilePush, subscribeToMobileNotificationResponses } from "./src/push";
import { MOBILE_WORKSPACE_MAX_OFFLINE_AGE_MS } from "./src/session-lifecycle";
import {
  cacheWorkspace,
  clearWorkspaceCache,
  initializeOfflineStore,
  pendingOfflineCount,
  queueAuditResponse,
  queueAuditStart,
  queueIncident,
  queueInspectionResponse,
  queueObservation,
  readCachedWorkspace,
  synchronizeOfflineItems,
} from "./src/storage";
import type {
  AuditResponsePayload,
  AuditResponseResult,
  CapturedAnswer,
  CapturedForm,
  IncidentPayload,
  InspectionResponsePayload,
  MobileBootstrap,
  MobileAudit,
  MobileAuditQuestion,
  MobileInspection,
  MobileInspectionItem,
  MobileModule,
  ObservationPayload,
  RuntimeField,
  RuntimeForm,
} from "./src/types";

type Tab = "home" | "workspace" | "capture" | "inspections" | "audits" | "risks" | "actions" | "settings";
type CaptureMode = "observation" | "incident";
type FieldValue = string | boolean | string[];
const observationTypes = ["UNSAFE_ACT", "UNSAFE_CONDITION", "POSITIVE_PRACTICE", "ENVIRONMENTAL", "QUALITY", "OTHER"] as const;
const incidentTypes = ["INJURY", "NEAR_MISS", "PROPERTY_DAMAGE", "ENVIRONMENTAL", "VEHICLE", "SECURITY", "OTHER"] as const;
const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default function App() {
  const network = Network.useNetworkState();
  const [authState, setAuthState] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [workspace, setWorkspace] = useState<MobileBootstrap | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [actionCenterView, setActionCenterView] = useState<ActionCenterView>("tasks");
  const [riskFieldView, setRiskFieldView] = useState<RiskFieldView>("risks");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("observation");
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const syncInFlight = useRef(false);

  const ownerKey = workspace ? `${workspace.organization.id}:${workspace.user.id}` : "";
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const openWorkspacePath = async (path: string) => {
    if (!online) {
      setNotice("Connect to the internet to open the complete operational workspace.");
      return;
    }
    try {
      await Linking.openURL(mobileWebUrl(path));
    } catch (error) {
      setNotice(messageOf(error));
    }
  };

  const refreshWorkspace = useCallback(async () => {
    const next = await loadMobileWorkspace();
    const nextOwner = `${next.organization.id}:${next.user.id}`;
    const verified = new Date().toISOString();
    setWorkspace(next);
    setVerifiedAt(Date.parse(verified));
    await cacheWorkspace(nextOwner, next, verified);
    setPending(await pendingOfflineCount(nextOwner));
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await initializeOfflineStore();
        try {
          const session = await restoreMobileSession();
          if (!session) { if (active) setAuthState("signed-out"); return; }
          await refreshWorkspace();
          if (active) setAuthState("signed-in");
        } catch (error) {
          const storedOwner = await getStoredMobileOwnerKey();
          const cached = storedOwner ? await readCachedWorkspace(storedOwner) : null;
          const cachedOwner = cached ? `${cached.workspace.organization.id}:${cached.workspace.user.id}` : null;
          if (active && storedOwner && cached && cachedOwner === storedOwner) {
            setWorkspace(cached.workspace);
            setVerifiedAt(Date.parse(cached.verifiedAt));
            setPending(await pendingOfflineCount(storedOwner));
            setNotice("Live verification is unavailable. You are using encrypted device data and can continue authorized field work offline.");
            setAuthState("signed-in");
            return;
          }
          throw error;
        }
      } catch (error) {
        if (active) {
          setNotice(messageOf(error));
          setAuthState("signed-out");
        }
      }
    })();
    return () => { active = false; };
  }, [refreshWorkspace]);

  const signIn = async () => {
    setBusy(true); setNotice("");
    try { await beginMobileSignIn(); await refreshWorkspace(); setAuthState("signed-in"); }
    catch (error) { setNotice(messageOf(error)); }
    finally { setBusy(false); }
  };

  const sync = useCallback(async (silent = false) => {
    if (!ownerKey || syncInFlight.current) return;
    if (!online) { if (!silent) setNotice("You are offline. Records remain securely queued on this device."); return; }
    syncInFlight.current = true;
    setBusy(true); setNotice("");
    try {
      const result = await synchronizeOfflineItems(ownerKey);
      setPending(await pendingOfflineCount(ownerKey));
      if (result.synchronized || result.failed || !silent) setNotice(result.synchronized ? `${result.synchronized} record${result.synchronized === 1 ? "" : "s"} synchronized.` : result.failed ? "Queued records still require attention." : "Everything is synchronized.");
      await refreshWorkspace();
    } catch (error) { setNotice(`Synchronization paused: ${messageOf(error)}`); }
    finally { syncInFlight.current = false; setBusy(false); }
  }, [online, ownerKey, refreshWorkspace]);

  useEffect(() => {
    if (authState === "signed-in" && ownerKey && online) void sync(true);
  }, [authState, online, ownerKey, sync]);

  useEffect(() => subscribeToMobileNotificationResponses(() => {
    setActionCenterView("alerts");
    setTab("actions");
    if (authState === "signed-in" && online) void refreshWorkspace().catch((error) => setNotice(`Notification refresh paused: ${messageOf(error)}`));
  }), [authState, online, refreshWorkspace]);

  useEffect(() => {
    if (authState !== "signed-in" || verifiedAt === null) return;
    const remaining = verifiedAt + MOBILE_WORKSPACE_MAX_OFFLINE_AGE_MS - Date.now();
    let active = true;
    const verifyOrLock = async () => {
      try { await refreshWorkspace(); }
      catch {
        await clearMobileSession();
        if (active) {
          setWorkspace(null);
          setVerifiedAt(null);
          setAuthState("signed-out");
          setNotice("The 72-hour offline authorization window expired. Connect to the internet and sign in again.");
        }
      }
    };
    const timer = setTimeout(() => { void verifyOrLock(); }, Math.max(remaining, 0));
    return () => { active = false; clearTimeout(timer); };
  }, [authState, refreshWorkspace, verifiedAt]);

  if (authState === "loading") return <LoadingScreen />;
  if (authState === "signed-out" || !workspace) return <SignInScreen busy={busy} notice={notice} onSignIn={signIn} />;

  const unread = workspace.notifications.filter((item) => !item.readAt).length;
  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerBrandRow}><View style={styles.headerLogo}><Image source={require("./assets/app-icon.png")} style={styles.headerLogoImage} resizeMode="contain" /></View><View><Text style={styles.brand}>SENZILYTICS</Text><Text style={styles.headerTitle}>{workspace.organization.name}</Text></View></View>
        <View style={[styles.onlineDot, { backgroundColor: network.isConnected === false ? "#fb7185" : "#34d399" }]} />
      </View>
      {notice ? <Pressable onPress={() => setNotice("")} style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></Pressable> : null}
      {tab === "home" && <HomeScreen workspace={workspace} pending={pending} busy={busy} onRefresh={async () => { try { return await refreshWorkspace(); } catch (error) { setNotice(`Refresh paused: ${messageOf(error)}`); return workspace; } }} onSync={sync} onNavigate={setTab} onOpenActions={(view) => { setActionCenterView(view); setTab("actions"); }} />}
      {tab === "workspace" && <WorkspaceScreen modules={workspace.modules ?? []} online={online} onCapture={(mode) => { setCaptureMode(mode); setTab("capture"); }} onInspect={() => setTab("inspections")} onAudit={() => setTab("audits")} onRisk={(view) => { setRiskFieldView(view); setTab("risks"); }} onActions={(view) => { setActionCenterView(view); setTab("actions"); }} onOpen={async (module) => openWorkspacePath(module.href)} />}
      {tab === "capture" && <CaptureScreen mode={captureMode} onModeChange={setCaptureMode} workspace={workspace} ownerKey={ownerKey} online={online} onQueued={async (message) => { setPending(await pendingOfflineCount(ownerKey)); setNotice(message); }} onSync={sync} />}
      {tab === "inspections" && <InspectionsScreen inspections={workspace.inspections ?? []} ownerKey={ownerKey} online={online} onBack={() => setTab("workspace")} onQueued={async (message) => { setPending(await pendingOfflineCount(ownerKey)); setNotice(message); }} onSync={sync} />}
      {tab === "audits" && <AuditsScreen audits={workspace.audits ?? []} ownerKey={ownerKey} online={online} onBack={() => setTab("workspace")} onQueued={async (message) => { setPending(await pendingOfflineCount(ownerKey)); setNotice(message); }} onSync={sync} />}
      {tab === "risks" && <RiskFieldScreen workspace={workspace} ownerKey={ownerKey} online={online} initialView={riskFieldView} onBack={() => setTab("workspace")} onQueued={async (message) => { setPending(await pendingOfflineCount(ownerKey)); setNotice(message); }} onSync={sync} />}
      {tab === "actions" && <ActionCenterScreen workspace={workspace} ownerKey={ownerKey} online={online} view={actionCenterView} onViewChange={setActionCenterView} onQueued={async (message) => { setPending(await pendingOfflineCount(ownerKey)); setNotice(message); }} onSync={sync} onOpenPath={openWorkspacePath} onReadNotification={async (id) => { if (!online) { setNotice("Notification status will remain unchanged until the device is online."); return; } try { await mobileApi("/api/mobile/notifications", { method: "PATCH", body: JSON.stringify({ notificationId: id }) }); setWorkspace((current) => current ? { ...current, notifications: current.notifications.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item) } : current); } catch (error) { setNotice(`Notification update paused: ${messageOf(error)}`); } }} />}
      {tab === "settings" && <SettingsScreen workspace={workspace} pending={pending} onEnablePush={async () => { setBusy(true); try { setNotice(await registerForMobilePush()); } catch (error) { setNotice(messageOf(error)); } finally { setBusy(false); } }} onLogout={async () => { setBusy(true); try { await logoutMobileSession(); await clearWorkspaceCache(ownerKey); setWorkspace(null); setVerifiedAt(null); setAuthState("signed-out"); setTab("home"); } finally { setBusy(false); } }} />}
      <View style={styles.tabs}>
        <TabButton active={tab === "home"} label="Home" onPress={() => setTab("home")} />
        <TabButton active={tab === "workspace"} label="Workspace" onPress={() => setTab("workspace")} />
        <TabButton active={tab === "capture" || tab === "inspections" || tab === "audits" || tab === "risks"} label="Capture" badge={pending || undefined} onPress={() => setTab("capture")} />
        <TabButton active={tab === "actions"} label="Actions" badge={unread + workspace.tasks.length || undefined} onPress={() => setTab("actions")} />
        <TabButton active={tab === "settings"} label="Settings" onPress={() => setTab("settings")} />
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen() { return <SafeAreaView style={[styles.app, styles.center]}><ActivityIndicator color="#67e8f9" size="large" /><Text style={styles.loadingText}>Securing your mobile workspace…</Text></SafeAreaView>; }

function SignInScreen({ busy, notice, onSignIn }: { busy: boolean; notice: string; onSignIn: () => void }) {
  return <SafeAreaView style={[styles.app, styles.center]}><View style={styles.signInCard}><Image source={require("./assets/app-icon.png")} style={styles.logo} resizeMode="contain" /><Text style={styles.eyebrow}>SENZILYTICS · EHS INTELLIGENCE</Text><Text style={styles.signInTitle}>Your complete EHS workspace.</Text><Text style={styles.muted}>Use your Senzilytics, Microsoft, or Okta account. The authorization screen always identifies the active account and lets you choose a different user before access is issued.</Text>{notice ? <Text style={styles.error}>{notice}</Text> : null}<PrimaryButton label={busy ? "Opening account selection…" : "Choose account and sign in"} disabled={busy} onPress={onSignIn} /><Text style={styles.securityNote}>Device-bound session · Encrypted credential storage · Role-aware Premium access</Text></View></SafeAreaView>;
}

function HomeScreen({ workspace, pending, busy, onRefresh, onSync, onNavigate, onOpenActions }: { workspace: MobileBootstrap; pending: number; busy: boolean; onRefresh: () => Promise<MobileBootstrap>; onSync: () => void; onNavigate: (tab: Tab) => void; onOpenActions: (view: ActionCenterView) => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const unread = workspace.notifications.filter((item) => !item.readAt).length;
  const assignedCapas = (workspace.correctiveActions ?? []).filter((action) => action.isAssignedToCurrentUser && !["COMPLETED", "CLOSED"].includes(action.status)).length;
  return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} refreshControl={<RefreshControl tintColor="#67e8f9" refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }} />}><Text style={styles.eyebrow}>MOBILE COMMAND CENTER</Text><Text style={styles.pageTitle}>Welcome, {workspace.user.name.split(" ")[0]}</Text><Text style={styles.muted}>{workspace.organization.subscriptionPlan} workspace · {humanize(workspace.user.role)}</Text><View style={styles.metricGrid}><Metric label="Workflow tasks" value={workspace.tasks.length} /><Metric label="My open CAPAs" value={assignedCapas} /><Metric label="Unread alerts" value={unread} /><Metric label="Offline queue" value={pending} /></View><Card accent><Text style={styles.cardTitle}>Your authorized workspace</Text><Text style={styles.muted}>Open every Senzilytics function assigned to your role. Modules and native actions you cannot access are automatically hidden.</Text><SecondaryButton label="Explore my workspace" onPress={() => onNavigate("workspace")} /></Card><Card accent><Text style={styles.cardTitle}>Native Action Center</Text><Text style={styles.muted}>Review assigned workflow steps, update corrective actions with evidence, and respond to notifications from one operational inbox.</Text><SecondaryButton label="Open my actions" onPress={() => onOpenActions("tasks")} /></Card><Card><Text style={styles.cardTitle}>Fast field actions</Text><Text style={styles.muted}>Capture authorized field records and complete assigned inspections and Audits even when connectivity is unreliable. Every queued record remains tenant- and user-scoped.</Text><View style={styles.row}><SecondaryButton label="Open field workspace" onPress={() => onNavigate("workspace")} /><SecondaryButton label={busy ? "Syncing…" : "Sync now"} onPress={onSync} disabled={busy} /></View></Card><Text style={styles.sectionTitle}>Assigned workflow</Text>{workspace.tasks.length ? workspace.tasks.slice(0, 8).map((task) => <Pressable key={task.id} onPress={() => onOpenActions("tasks")}><Card><Text style={styles.cardTitle}>{task.name}</Text><Text style={styles.muted}>{task.instance.template.name} · {humanize(task.instance.entityType)}</Text><Text style={styles.due}>{task.dueAt ? `Due ${formatDate(task.dueAt)}` : "No due date"}</Text></Card></Pressable>) : <EmptyState text="No active workflow steps are assigned to you." />}</ScrollView>;
}

function WorkspaceScreen({ modules, online, onCapture, onInspect, onAudit, onRisk, onActions, onOpen }: { modules: MobileModule[]; online: boolean; onCapture: (mode: CaptureMode) => void; onInspect: () => void; onAudit: () => void; onRisk: (view: RiskFieldView) => void; onActions: (view: ActionCenterView) => void; onOpen: (module: MobileModule) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visible = modules.filter((module) => !normalized || `${module.label} ${module.description} ${humanize(module.category)}`.toLowerCase().includes(normalized));
  const categories: MobileModule["category"][] = ["COMMAND", "SAFETY", "ASSURANCE", "GOVERNANCE", "ADMINISTRATION"];
  return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>ROLE-AWARE ACCESS</Text><Text style={styles.pageTitle}>My workspace</Text><Text style={styles.muted}>Your tenant and role determine what appears here. Operational pages open in Senzilytics&apos; responsive secure workspace; authorized native field workflows remain available offline.</Text><Input value={query} onChangeText={setQuery} placeholder="Search my authorized modules" autoCapitalize="none" />{!online ? <View style={styles.offlineBanner}><Text style={styles.offlineBannerText}>You are offline. Native capture, Risk/JSA field work, assigned inspections and Audits, and corrective-action progress remain available.</Text></View> : null}{categories.map((category) => { const categoryModules = visible.filter((module) => module.category === category); if (!categoryModules.length) return null; return <View key={category} style={styles.moduleSection}><Text style={styles.sectionTitle}>{humanize(category)}</Text>{categoryModules.map((module) => <Card key={module.key} accent={Boolean(module.nativeCapability)}><View style={styles.moduleHeading}><View style={styles.moduleMark}><Text style={styles.moduleMarkText}>{module.label.slice(0, 1)}</Text></View><View style={styles.moduleCopy}><Text style={styles.cardTitle}>{module.label}</Text><Text style={styles.muted}>{module.description}</Text></View></View><View style={styles.row}>{module.nativeCapability === "ACTION_CENTER" ? <SecondaryButton label="Open native task inbox" onPress={() => onActions("tasks")} /> : null}{module.nativeCapability === "CAPA_EXECUTION" ? <SecondaryButton label="Open native CAPA" onPress={() => onActions("capa")} /> : null}{module.nativeCapability === "OBSERVATION_CAPTURE" ? <SecondaryButton label="Capture observation" onPress={() => onCapture("observation")} /> : null}{module.nativeCapability === "INCIDENT_CAPTURE" ? <SecondaryButton label="Report incident" onPress={() => onCapture("incident")} /> : null}{module.nativeCapability === "INSPECTION_EXECUTION" ? <SecondaryButton label="Assigned inspections" onPress={onInspect} /> : null}{module.nativeCapability === "AUDIT_EXECUTION" ? <SecondaryButton label="Assigned Audits" onPress={onAudit} /> : null}{module.nativeCapability === "RISK_FIELD" ? <SecondaryButton label="Open native Risk Register" onPress={() => onRisk("risks")} /> : null}{module.nativeCapability === "JSA_FIELD" ? <SecondaryButton label="Open native JSA / JHA" onPress={() => onRisk("jsa")} /> : null}<SecondaryButton label={online ? "Open workspace" : "Connection required"} disabled={!online} onPress={() => { void onOpen(module); }} /></View></Card>)}</View>; })}{!visible.length ? <EmptyState text="No authorized module matches your search." /> : null}</ScrollView>;
}

function CaptureScreen({ mode, onModeChange, ...props }: { mode: CaptureMode; onModeChange: (mode: CaptureMode) => void; workspace: MobileBootstrap; ownerKey: string; online: boolean; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
  const modes = [
    ...(props.workspace.permissions.includes("CREATE_OBSERVATION") ? [{ value: "observation", label: "Observation" }] : []),
    ...(props.workspace.permissions.includes("CREATE_INCIDENT") ? [{ value: "incident", label: "Incident / near miss" }] : []),
  ] as Array<{ value: CaptureMode; label: string }>;
  if (!modes.length) return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><EmptyState text="Your role does not include a native field-capture permission." /></ScrollView>;
  const activeMode = modes.some((item) => item.value === mode) ? mode : modes[0].value;
  return <View style={styles.flex}>{modes.length > 1 ? <View style={styles.captureSwitcher}><ChipGroup values={modes} selected={activeMode} onSelect={(value) => onModeChange(value as CaptureMode)} /></View> : null}{activeMode === "incident" ? <IncidentCaptureScreen {...props} /> : <ObservationCaptureScreen {...props} />}</View>;
}

function ObservationCaptureScreen({ workspace, ownerKey, online, onQueued, onSync }: { workspace: MobileBootstrap; ownerKey: string; online: boolean; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
  const allowed = workspace.permissions.includes("CREATE_OBSERVATION");
  const [siteId, setSiteId] = useState(workspace.sites[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [type, setType] = useState<ObservationPayload["type"]>("UNSAFE_CONDITION");
  const [riskLevel, setRiskLevel] = useState<ObservationPayload["riskLevel"]>("MEDIUM");
  const [anonymous, setAnonymous] = useState(false);
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!allowed) return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><EmptyState text="Your role does not include permission to create safety observations." /></ScrollView>;

  const save = async () => {
    setError("");
    if (!siteId || title.trim().length < 2 || description.trim().length < 2) { setError("Site, title, and description are required."); return; }
    let customForms: CapturedForm[];
    try { customForms = buildCapturedForms(workspace.observationForms, answers); }
    catch (reason) { setError(messageOf(reason)); return; }
    setSaving(true);
    try {
      await queueObservation(ownerKey, { siteId, title: title.trim(), description: description.trim(), type, riskLevel, location: location.trim() || undefined, immediateAction: immediateAction.trim() || undefined, observedAt: new Date().toISOString(), isAnonymous: anonymous, customForms }, evidence);
      setTitle(""); setDescription(""); setLocation(""); setImmediateAction(""); setAnswers({}); setEvidence([]);
      await onQueued(online ? "Observation queued. Synchronizing now…" : "Observation saved offline and will synchronize when connectivity returns.");
      if (online) onSync();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setSaving(false); }
  };

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>{online ? "ONLINE" : "OFFLINE READY"}</Text><Text style={styles.pageTitle}>Capture observation</Text><FieldLabel text="Site *" /><ChipGroup values={workspace.sites.map((site) => ({ value: site.id, label: site.name }))} selected={siteId} onSelect={setSiteId} /><FieldLabel text="Title *" /><Input value={title} onChangeText={setTitle} placeholder="What did you observe?" /><FieldLabel text="Description *" /><Input value={description} onChangeText={setDescription} placeholder="Describe the condition, behavior, or positive practice" multiline /><FieldLabel text="Observation type" /><ChipGroup values={observationTypes.map((value) => ({ value, label: humanize(value) }))} selected={type} onSelect={(value) => setType(value as ObservationPayload["type"])} /><FieldLabel text="Risk level" /><ChipGroup values={riskLevels.map((value) => ({ value, label: humanize(value) }))} selected={riskLevel} onSelect={(value) => setRiskLevel(value as ObservationPayload["riskLevel"])} /><FieldLabel text="Location" /><Input value={location} onChangeText={setLocation} placeholder="Area, building, or equipment" /><FieldLabel text="Immediate action" /><Input value={immediateAction} onChangeText={setImmediateAction} placeholder="What was done immediately?" multiline /><EvidenceAttachmentPicker value={evidence} onChange={setEvidence} label="Observation evidence" /><Pressable style={styles.checkRow} onPress={() => setAnonymous((value) => !value)}><View style={[styles.checkbox, anonymous && styles.checkboxOn]}>{anonymous ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.checkLabel}>Hide my identity from standard observation views</Text></Pressable>{workspace.observationForms.map((form) => <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />)}{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label={saving ? "Saving securely…" : online ? "Save and synchronize" : "Save offline"} disabled={saving} onPress={save} /></ScrollView></KeyboardAvoidingView>;
}

function IncidentCaptureScreen({ workspace, ownerKey, online, onQueued, onSync }: { workspace: MobileBootstrap; ownerKey: string; online: boolean; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
  const allowed = workspace.permissions.includes("CREATE_INCIDENT");
  const [siteId, setSiteId] = useState(workspace.sites[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<IncidentPayload["type"]>("NEAR_MISS");
  const [riskLevel, setRiskLevel] = useState<IncidentPayload["riskLevel"]>("MEDIUM");
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!allowed) return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><EmptyState text="Your role does not include permission to create incidents or near misses." /></ScrollView>;

  const save = async () => {
    setError("");
    if (!siteId || title.trim().length < 2 || description.trim().length < 2) { setError("Site, title, and description are required."); return; }
    let customForms: CapturedForm[];
    try { customForms = buildCapturedForms(workspace.incidentForms ?? [], answers); }
    catch (reason) { setError(messageOf(reason)); return; }
    setSaving(true);
    try {
      await queueIncident(ownerKey, { siteId, title: title.trim(), description: description.trim(), type, riskLevel, location: location.trim() || undefined, occurredAt: new Date().toISOString(), customForms }, evidence);
      setTitle(""); setDescription(""); setLocation(""); setAnswers({}); setEvidence([]);
      await onQueued(online ? "Incident queued. Synchronizing now…" : "Incident saved offline and will synchronize when connectivity returns.");
      if (online) onSync();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setSaving(false); }
  };

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>{online ? "ONLINE" : "OFFLINE READY"}</Text><Text style={styles.pageTitle}>Report incident</Text><Text style={styles.muted}>Record an injury, near miss, environmental event, property damage, or other reportable event at the point of work.</Text><FieldLabel text="Site *" /><ChipGroup values={workspace.sites.map((site) => ({ value: site.id, label: site.name }))} selected={siteId} onSelect={setSiteId} /><FieldLabel text="Title *" /><Input value={title} onChangeText={setTitle} placeholder="Brief incident or near-miss title" /><FieldLabel text="Description *" /><Input value={description} onChangeText={setDescription} placeholder="Describe what happened and the immediate conditions" multiline /><FieldLabel text="Incident type" /><ChipGroup values={incidentTypes.map((value) => ({ value, label: humanize(value) }))} selected={type} onSelect={(value) => setType(value as IncidentPayload["type"])} /><FieldLabel text="Risk level" /><ChipGroup values={riskLevels.map((value) => ({ value, label: humanize(value) }))} selected={riskLevel} onSelect={(value) => setRiskLevel(value as IncidentPayload["riskLevel"])} /><FieldLabel text="Location" /><Input value={location} onChangeText={setLocation} placeholder="Area, building, vehicle, or equipment" /><EvidenceAttachmentPicker value={evidence} onChange={setEvidence} label="Incident evidence" />{(workspace.incidentForms ?? []).map((form) => <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />)}{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label={saving ? "Saving securely…" : online ? "Save and synchronize" : "Save offline"} disabled={saving} onPress={save} /></ScrollView></KeyboardAvoidingView>;
}

function InspectionsScreen({ inspections, ownerKey, online, onBack, onQueued, onSync }: { inspections: MobileInspection[]; ownerKey: string; online: boolean; onBack: () => void; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = inspections.find((inspection) => inspection.id === selectedId) ?? null;
  if (!selected) {
    return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><SecondaryButton label="← Back to workspace" onPress={onBack} /><Text style={styles.eyebrow}>{online ? "ASSIGNED FIELD WORK" : "OFFLINE ASSIGNMENTS"}</Text><Text style={styles.pageTitle}>My inspections</Text><Text style={styles.muted}>Only active inspections assigned to you as lead inspector or team member are stored on this device.</Text>{inspections.length ? inspections.map((inspection) => { const answered = inspection.checklistItems.filter((item) => item.response && item.response.result !== "NOT_ASSESSED").length; return <Card key={inspection.id} accent><Text style={styles.cardTitle}>{inspection.title}</Text><Text style={styles.muted}>{inspection.site.name}{inspection.area ? ` · ${inspection.area}` : ""}</Text><Text style={styles.due}>{answered} of {inspection.checklistItems.length} questions answered{inspection.dueDate ? ` · Due ${formatDate(inspection.dueDate)}` : ""}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${inspection.checklistItems.length ? Math.round((answered / inspection.checklistItems.length) * 100) : 0}%` }]} /></View><PrimaryButton label={answered ? "Continue inspection" : "Start inspection"} onPress={() => setSelectedId(inspection.id)} /></Card>; }) : <EmptyState text="No active inspections are assigned to you. Connect to refresh assignments or ask an inspection manager to add you to the team." />}</ScrollView>;
  }

  const sections = Array.from(new Set(selected.checklistItems.map((item) => item.sectionName)));
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled"><SecondaryButton label="← All assigned inspections" onPress={() => setSelectedId(null)} /><Text style={styles.eyebrow}>{online ? "INSPECTION EXECUTION" : "OFFLINE EXECUTION"}</Text><Text style={styles.pageTitle}>{selected.title}</Text><Text style={styles.muted}>{selected.site.name}{selected.area ? ` · ${selected.area}` : ""}{selected.reference ? ` · ${selected.reference}` : ""}</Text>{selected.description ? <Text style={styles.muted}>{selected.description}</Text> : null}{sections.map((section) => <View key={section} style={styles.moduleSection}><Text style={styles.sectionTitle}>{section || "Checklist"}</Text>{selected.checklistItems.filter((item) => item.sectionName === section).map((item) => <InspectionItemEditor key={item.id} inspectionId={selected.id} item={item} ownerKey={ownerKey} online={online} onQueued={onQueued} onSync={onSync} />)}</View>)}</ScrollView></KeyboardAvoidingView>;
}

function InspectionItemEditor({ inspectionId, item, ownerKey, online, onQueued, onSync }: { inspectionId: string; item: MobileInspectionItem; ownerKey: string; online: boolean; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
  const initialResult = item.response?.result && item.response.result !== "NOT_ASSESSED" ? item.response.result : "";
  const [result, setResult] = useState<InspectionResponsePayload["result"] | "">(initialResult);
  const [responseText, setResponseText] = useState(item.response?.responseText ?? "");
  const [numericValue, setNumericValue] = useState(item.response?.numericValue?.toString() ?? "");
  const [comments, setComments] = useState(item.response?.comments ?? "");
  const [createFinding, setCreateFinding] = useState(item.response?.finding !== null && item.response?.finding !== undefined);
  const [findingTitle, setFindingTitle] = useState(item.response?.finding?.title ?? "");
  const [findingDescription, setFindingDescription] = useState("");
  const [findingRiskLevel, setFindingRiskLevel] = useState<NonNullable<InspectionResponsePayload["findingRiskLevel"]>>(item.response?.finding?.riskLevel ?? "MEDIUM");
  const [findingDueDate, setFindingDueDate] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!result) { setError("Select a result before saving this response."); return; }
    if (item.isRequired && item.questionType === "TEXT" && !responseText.trim()) { setError("A written response is required for this question."); return; }
    if (item.questionType === "PHOTO" && !evidence.some((file) => file.kind === "PHOTO")) { setError("Capture or select a photo before saving this photo-verification question."); return; }
    const parsedNumber = numericValue.trim() ? Number(numericValue) : undefined;
    if (item.questionType === "NUMBER" && (parsedNumber === undefined || !Number.isFinite(parsedNumber))) { setError("Enter a valid numeric response."); return; }
    let dueDate: string | undefined;
    if (findingDueDate.trim()) {
      const parsed = new Date(`${findingDueDate.trim()}T23:59:59.000Z`);
      if (Number.isNaN(parsed.getTime())) { setError("Finding due date must use YYYY-MM-DD."); return; }
      dueDate = parsed.toISOString();
    }
    setSaving(true);
    try {
      await queueInspectionResponse(ownerKey, {
        inspectionId,
        checklistItemId: item.id,
        result,
        responseText: responseText.trim() || undefined,
        numericValue: parsedNumber,
        booleanValue: item.questionType === "YES_NO" ? result === "COMPLIANT" : undefined,
        comments: comments.trim() || undefined,
        createFinding: result === "NON_COMPLIANT" && createFinding,
        findingTitle: findingTitle.trim() || undefined,
        findingDescription: findingDescription.trim() || undefined,
        findingRiskLevel,
        findingDueDate: dueDate,
      }, evidence);
      setQueued(true);
      setEvidence([]);
      await onQueued(online ? "Inspection response queued. Synchronizing now…" : "Inspection response saved securely on this device.");
      if (online) onSync();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setSaving(false); }
  };

  return <Card accent={queued || Boolean(item.response)}><Text style={styles.questionNumber}>Question {item.sequence}</Text><Text style={styles.cardTitle}>{item.questionText}{item.isRequired ? " *" : ""}</Text>{item.guidance ? <Text style={styles.fieldHelp}>{item.guidance}</Text> : null}<FieldLabel text="Result" /><ChipGroup values={[{ value: "COMPLIANT", label: item.questionType === "YES_NO" ? "Yes / compliant" : "Compliant" }, { value: "NON_COMPLIANT", label: item.questionType === "YES_NO" ? "No / noncompliant" : "Noncompliant" }, { value: "NOT_APPLICABLE", label: "Not applicable" }]} selected={result} onSelect={(value) => { setResult(value as InspectionResponsePayload["result"]); if (value !== "NON_COMPLIANT") setCreateFinding(false); }} />{item.questionType === "TEXT" ? <><FieldLabel text="Response" /><Input value={responseText} onChangeText={setResponseText} placeholder="Enter the inspection response" multiline /></> : null}{item.questionType === "NUMBER" ? <><FieldLabel text="Numeric response" /><Input value={numericValue} onChangeText={setNumericValue} placeholder="Enter a number" keyboardType="decimal-pad" /></> : null}{item.questionType === "PHOTO" ? <Text style={styles.fieldHelp}>This verification requires a photo captured or selected below.</Text> : null}<FieldLabel text="Comments" /><Input value={comments} onChangeText={setComments} placeholder="Evidence, conditions, or follow-up notes" multiline /><EvidenceAttachmentPicker value={evidence} onChange={setEvidence} label={item.questionType === "PHOTO" ? "Photo evidence *" : "Inspection evidence"} />{result === "NON_COMPLIANT" ? <><Pressable style={styles.checkRow} onPress={() => setCreateFinding((value) => !value)}><View style={[styles.checkbox, createFinding && styles.checkboxOn]}>{createFinding ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.checkLabel}>Create a linked inspection finding</Text></Pressable>{createFinding ? <View style={styles.findingPanel}><FieldLabel text="Finding title" /><Input value={findingTitle} onChangeText={setFindingTitle} placeholder={`Noncompliance: ${item.questionText}`} /><FieldLabel text="Finding description" /><Input value={findingDescription} onChangeText={setFindingDescription} placeholder="Describe the deficiency and objective evidence" multiline /><FieldLabel text="Risk level" /><ChipGroup values={riskLevels.map((value) => ({ value, label: humanize(value) }))} selected={findingRiskLevel} onSelect={(value) => setFindingRiskLevel(value as NonNullable<InspectionResponsePayload["findingRiskLevel"]>)} /><FieldLabel text="Due date" /><Input value={findingDueDate} onChangeText={setFindingDueDate} placeholder="YYYY-MM-DD" autoCapitalize="none" /></View> : null}</> : null}{queued ? <Text style={styles.successText}>Saved to the encrypted synchronization queue.</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label={saving ? "Saving securely…" : item.response ? "Save updated response" : "Save response"} disabled={saving} onPress={save} /></Card>;
}

function AuditsScreen({ audits, ownerKey, online, onBack, onQueued, onSync }: { audits: MobileAudit[]; ownerKey: string; online: boolean; onBack: () => void; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locallyStarted, setLocallyStarted] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const selected = audits.find((audit) => audit.id === selectedId) ?? null;

  if (!selected) {
    return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><SecondaryButton label="← Back to workspace" onPress={onBack} /><Text style={styles.eyebrow}>{online ? "ASSIGNED ASSURANCE WORK" : "OFFLINE AUDIT WORK"}</Text><Text style={styles.pageTitle}>My Audits</Text><Text style={styles.muted}>Active and startable Audits available through your management role, lead-auditor assignment, or editable Audit team membership are stored securely on this device.</Text>{audits.length ? audits.map((audit) => { const progress = audit.totalQuestionCount ? Math.round((audit.answeredQuestionCount / audit.totalQuestionCount) * 100) : 0; return <Card key={audit.id} accent><Text style={styles.questionNumber}>{audit.reference} · {humanize(audit.auditType)}</Text><Text style={styles.cardTitle}>{audit.title}</Text><Text style={styles.muted}>{audit.site.name}{audit.department ? ` · ${audit.department.name}` : ""}</Text><Text style={styles.due}>{audit.answeredQuestionCount} of {audit.totalQuestionCount} questions answered{audit.dueDate ? ` · Due ${formatDate(audit.dueDate)}` : ""}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View><PrimaryButton label={audit.status === "IN_PROGRESS" ? "Continue Audit" : "Review and start Audit"} onPress={() => setSelectedId(audit.id)} /></Card>; }) : <EmptyState text="No active Audits are assigned to you. Connect to refresh assignments or ask an Audit manager to grant editable team access." />}</ScrollView>;
  }

  const started = selected.status === "IN_PROGRESS" || locallyStarted.includes(selected.id);
  const start = async () => {
    setError("");
    setStarting(true);
    try {
      await queueAuditStart(ownerKey, { auditId: selected.id });
      setLocallyStarted((current) => current.includes(selected.id) ? current : [...current, selected.id]);
      await onQueued(online ? "Audit start queued. Synchronizing now…" : "Audit started on this device. Responses will synchronize in order when connectivity returns.");
      if (online) onSync();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setStarting(false); }
  };

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled"><SecondaryButton label="← All assigned Audits" onPress={() => setSelectedId(null)} /><Text style={styles.eyebrow}>{online ? "AUDIT EXECUTION" : "OFFLINE AUDIT EXECUTION"}</Text><Text style={styles.pageTitle}>{selected.title}</Text><Text style={styles.muted}>{selected.reference} · {selected.site.name}{selected.department ? ` · ${selected.department.name}` : ""}</Text>{selected.description ? <Text style={styles.muted}>{selected.description}</Text> : null}<View style={styles.metricGrid}><Metric label="Questions" value={selected.totalQuestionCount} /><Metric label="Answered" value={selected.answeredQuestionCount} /><Metric label="Failed" value={selected.failedQuestionCount} /><Metric label="Score" value={Math.round(selected.scorePercentage ?? 0)} /></View>{selected.scope || selected.objectives || selected.criteria ? <Card><Text style={styles.cardTitle}>Audit plan</Text>{selected.objectives ? <><FieldLabel text="Objectives" /><Text style={styles.muted}>{selected.objectives}</Text></> : null}{selected.scope ? <><FieldLabel text="Scope" /><Text style={styles.muted}>{selected.scope}</Text></> : null}{selected.criteria ? <><FieldLabel text="Criteria" /><Text style={styles.muted}>{selected.criteria}</Text></> : null}</Card> : null}{!started ? <Card accent><Text style={styles.cardTitle}>Start execution</Text><Text style={styles.muted}>Starting creates a governed Audit history entry. If offline, this action is queued before every response so synchronization preserves lifecycle order.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label={starting ? "Starting securely…" : online ? "Start Audit" : "Start Audit offline"} disabled={starting} onPress={start} /></Card> : selected.sections.map((section) => <View key={section.id} style={styles.moduleSection}><Text style={styles.sectionTitle}>{section.sequence}. {section.title}</Text>{section.guidance ? <Text style={styles.muted}>{section.guidance}</Text> : null}<Text style={styles.due}>{section.answeredQuestionCount} of {section.totalQuestionCount} answered</Text>{section.questions.map((question) => <AuditQuestionEditor key={question.id} auditId={selected.id} question={question} ownerKey={ownerKey} online={online} onQueued={onQueued} onSync={onSync} />)}</View>)}</ScrollView></KeyboardAvoidingView>;
}

function AuditQuestionEditor({ auditId, question, ownerKey, online, onQueued, onSync }: { auditId: string; question: MobileAuditQuestion; ownerKey: string; online: boolean; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
  const initialResult = question.response?.result && question.response.result !== "NOT_ASSESSED" ? question.response.result : "";
  const [result, setResult] = useState<AuditResponseResult | "">(initialResult);
  const [responseText, setResponseText] = useState(question.response?.responseText ?? "");
  const [numericValue, setNumericValue] = useState(question.response?.numericValue?.toString() ?? "");
  const [selectedOptions, setSelectedOptions] = useState<string[]>(question.response?.selectedOptionValues ?? []);
  const [comments, setComments] = useState(question.response?.comments ?? "");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidence, setEvidence] = useState<SelectedEvidence[]>([]);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");
  const resultOptions = auditResultsFor(question);

  const save = async () => {
    setError("");
    if (!result) { setError("Select an assessment result."); return; }
    if (question.requireComment && !comments.trim()) { setError("A comment is required for this Audit question."); return; }
    const parsedNumber = numericValue.trim() ? Number(numericValue) : undefined;
    if (question.responseType === "NUMERIC" && (parsedNumber === undefined || !Number.isFinite(parsedNumber))) { setError("Enter a valid numeric response."); return; }
    if (question.responseType === "MULTIPLE_CHOICE" && question.isRequired && selectedOptions.length === 0) { setError("Select at least one response option."); return; }
    if (question.requireEvidence && !evidenceNote.trim() && !evidenceUrl.trim() && !evidence.length && !question.evidenceCount) { setError("Add an evidence note, file, photo, or approved evidence URL."); return; }
    if (question.requirePhoto && !evidenceUrl.trim() && !evidence.some((file) => file.kind === "PHOTO") && !question.photoEvidenceCount) { setError("Capture or select a photo before saving this Audit response."); return; }
    if (evidenceUrl.trim()) {
      try {
        const parsedUrl = new URL(evidenceUrl.trim());
        if (parsedUrl.protocol !== "https:") throw new Error("HTTPS is required.");
      }
      catch { setError("Evidence URL must be a complete https:// address."); return; }
    }
    setSaving(true);
    try {
      await queueAuditResponse(ownerKey, {
        auditId,
        questionId: question.id,
        result,
        responseText: responseText.trim() || undefined,
        numericValue: parsedNumber,
        booleanValue: question.responseType === "YES_NO" ? result === "YES" : undefined,
        selectedOptionValues: selectedOptions,
        comments: comments.trim() || undefined,
        evidenceNote: evidenceNote.trim() || undefined,
        evidenceUrl: evidenceUrl.trim() || undefined,
      }, evidence);
      setQueued(true);
      setEvidenceNote("");
      setEvidenceUrl("");
      setEvidence([]);
      await onQueued(online ? "Audit response queued. Synchronizing now…" : "Audit response saved securely on this device.");
      if (online) onSync();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setSaving(false); }
  };

  return <Card accent={queued || Boolean(question.response)}><Text style={styles.questionNumber}>Question {question.sequence}{question.standardClause ? ` · ${question.standardClause}` : ""}</Text><Text style={styles.cardTitle}>{question.questionText}{question.isRequired ? " *" : ""}</Text>{question.guidance ? <Text style={styles.fieldHelp}>{question.guidance}</Text> : null}<FieldLabel text="Assessment result" /><ChipGroup values={resultOptions.map((value) => ({ value, label: humanize(value) }))} selected={result} onSelect={(value) => setResult(value as AuditResponseResult)} />{question.responseType === "NUMERIC" ? <><FieldLabel text="Numeric value" /><Input value={numericValue} onChangeText={setNumericValue} placeholder={numericAuditPlaceholder(question)} keyboardType="decimal-pad" /></> : null}{question.options.length ? <View style={styles.fieldBlock}><FieldLabel text="Response options" /><View style={styles.chips}>{question.options.map((option) => { const selected = selectedOptions.includes(option.value); return <Pressable key={option.id} style={[styles.chip, selected && styles.chipOn]} onPress={() => setSelectedOptions((current) => selected ? current.filter((value) => value !== option.value) : [...current, option.value])}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}{option.triggersFinding ? " · finding rule" : ""}</Text></Pressable>; })}</View></View> : null}<FieldLabel text="Response narrative" /><Input value={responseText} onChangeText={setResponseText} placeholder="Record the assessment narrative" multiline /><FieldLabel text={`Comments${question.requireComment ? " *" : ""}`} /><Input value={comments} onChangeText={setComments} placeholder="Record objective observations and follow-up context" multiline /><FieldLabel text={`Evidence note${question.requireEvidence ? " *" : ""}`} /><Input value={evidenceNote} onChangeText={setEvidenceNote} placeholder={question.evidenceCount ? `${question.evidenceCount} evidence record(s) already attached` : "Describe the evidence reviewed or collected"} multiline /><EvidenceAttachmentPicker value={evidence} onChange={setEvidence} label={question.requirePhoto ? "Photo evidence *" : question.requireEvidence ? "Evidence file *" : "Audit evidence"} /><FieldLabel text="Approved evidence URL" /><Input value={evidenceUrl} onChangeText={setEvidenceUrl} placeholder="https://… (optional)" autoCapitalize="none" keyboardType="url" />{question.requirePhoto ? <Text style={styles.fieldHelp}>A securely captured photo, an existing photo attachment, or an approved HTTPS evidence URL satisfies this question.</Text> : null}{question.findingCount ? <Text style={styles.due}>{question.findingCount} linked finding{question.findingCount === 1 ? "" : "s"}</Text> : null}{queued ? <Text style={styles.successText}>Saved to the encrypted synchronization queue.</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label={saving ? "Saving securely…" : question.response ? "Save updated response" : "Save Audit response"} disabled={saving} onPress={save} /></Card>;
}

function auditResultsFor(question: MobileAuditQuestion): AuditResponseResult[] {
  let values: AuditResponseResult[];
  if (question.responseType === "PASS_FAIL") values = ["PASS", "FAIL"];
  else if (question.responseType === "YES_NO") values = ["YES", "NO"];
  else if (question.responseType === "NOT_APPLICABLE") values = ["NOT_APPLICABLE"];
  else if (question.responseType === "FREE_TEXT" || question.responseType === "OBSERVATION") values = ["OBSERVATION", "INFORMATION_ONLY", "COMPLIANT", "NON_COMPLIANT"];
  else values = ["COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT"];
  if (question.allowNotApplicable && !values.includes("NOT_APPLICABLE")) values.push("NOT_APPLICABLE");
  return values;
}

function numericAuditPlaceholder(question: MobileAuditQuestion) {
  if (question.minimumNumericValue !== null && question.maximumNumericValue !== null) return `${question.minimumNumericValue}–${question.maximumNumericValue}`;
  if (question.minimumNumericValue !== null) return `Minimum ${question.minimumNumericValue}`;
  if (question.maximumNumericValue !== null) return `Maximum ${question.maximumNumericValue}`;
  return "Enter the measured value";
}

function EvidenceAttachmentPicker({
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
      const selected = source === "camera"
        ? await capturePhotoEvidence()
        : source === "photos"
          ? await pickPhotoEvidence(MAX_EVIDENCE_FILES_PER_RECORD - value.length)
          : await pickEvidenceFiles();
      if (value.length + selected.length > MAX_EVIDENCE_FILES_PER_RECORD) {
        throw new Error(`Attach no more than ${MAX_EVIDENCE_FILES_PER_RECORD} evidence files to one record.`);
      }
      onChange([...value, ...selected]);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.evidencePanel}><FieldLabel text={label} /><Text style={styles.fieldHelp}>Photos and documents are copied into the encrypted offline store, isolated to this tenant and user, and uploaded privately during synchronization. Maximum 10 MB per file.</Text><View style={styles.row}><SecondaryButton label={busy ? "Opening…" : "Take photo"} disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD} onPress={() => { void add("camera"); }} /><SecondaryButton label={busy ? "Opening…" : "Choose photos"} disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD} onPress={() => { void add("photos"); }} /><SecondaryButton label={busy ? "Opening…" : "Choose document"} disabled={busy || value.length >= MAX_EVIDENCE_FILES_PER_RECORD} onPress={() => { void add("files"); }} /></View>{value.map((file) => <View key={file.id} style={styles.evidenceFile}><View style={styles.evidenceFileCopy}><Text style={styles.evidenceFileName} numberOfLines={1}>{file.fileName}</Text><Text style={styles.fieldHelp}>{humanize(file.kind)} · {formatFileSize(file.sizeBytes)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.fileName}`} onPress={() => onChange(value.filter((item) => item.id !== file.id))}><Text style={styles.removeEvidence}>Remove</Text></Pressable></View>)}{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

function DynamicForm({ form, answers, setAnswers }: { form: RuntimeForm; answers: Record<string, FieldValue>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, FieldValue>>> }) {
  return <Card><Text style={styles.cardTitle}>{form.name}</Text>{form.version.instructions ? <Text style={styles.muted}>{form.version.instructions}</Text> : null}{form.version.fields.filter((field) => isVisible(field, form, answers)).map((field) => <DynamicField key={field.id} field={field} value={answers[field.id]} onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))} />)}</Card>;
}

function DynamicField({ field, value, onChange }: { field: RuntimeField; value: FieldValue | undefined; onChange: (value: FieldValue) => void }) {
  const options = Array.isArray(field.options) ? field.options.filter((item): item is string => typeof item === "string") : [];
  if (field.fieldType === "FILE") return <View style={styles.fieldBlock}><FieldLabel text={`${field.label}${field.isRequired ? " *" : ""}`} /><Text style={styles.muted}>Files can be attached from the web workspace after this record synchronizes.</Text></View>;
  if (field.fieldType === "BOOLEAN") return <Pressable style={styles.checkRow} onPress={() => onChange(value !== true)}><View style={[styles.checkbox, value === true && styles.checkboxOn]}>{value === true ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.checkLabel}>{field.label}{field.isRequired ? " *" : ""}</Text></Pressable>;
  if (field.fieldType === "SINGLE_SELECT") return <View style={styles.fieldBlock}><FieldLabel text={`${field.label}${field.isRequired ? " *" : ""}`} /><ChipGroup values={options.map((option) => ({ value: option, label: option }))} selected={typeof value === "string" ? value : ""} onSelect={onChange} /></View>;
  if (field.fieldType === "MULTI_SELECT") { const selected = Array.isArray(value) ? value : []; return <View style={styles.fieldBlock}><FieldLabel text={`${field.label}${field.isRequired ? " *" : ""}`} /><View style={styles.chips}>{options.map((option) => <Pressable key={option} style={[styles.chip, selected.includes(option) && styles.chipOn]} onPress={() => onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])}><Text style={[styles.chipText, selected.includes(option) && styles.chipTextOn]}>{option}</Text></Pressable>)}</View></View>; }
  return <View style={styles.fieldBlock}><FieldLabel text={`${field.label}${field.isRequired ? " *" : ""}`} />{field.description ? <Text style={styles.fieldHelp}>{field.description}</Text> : null}<Input value={typeof value === "string" ? value : ""} onChangeText={onChange} placeholder={field.placeholder || placeholderFor(field.fieldType)} multiline={field.fieldType === "LONG_TEXT"} keyboardType={field.fieldType === "NUMBER" ? "decimal-pad" : field.fieldType === "EMAIL" ? "email-address" : field.fieldType === "PHONE" ? "phone-pad" : "default"} /></View>;
}

function SettingsScreen({ workspace, pending, onEnablePush, onLogout }: { workspace: MobileBootstrap; pending: number; onEnablePush: () => void; onLogout: () => void }) {
  return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><Text style={styles.eyebrow}>ACCOUNT</Text><Text style={styles.pageTitle}>Mobile settings</Text><Card><Text style={styles.cardTitle}>{workspace.user.name}</Text><Text style={styles.muted}>{workspace.user.email}</Text><Text style={styles.due}>{humanize(workspace.user.role)} · {workspace.organization.name}</Text></Card><Card><Text style={styles.cardTitle}>Data protection</Text><Text style={styles.muted}>Credentials are stored in the device Keychain or Android Keystore. Offline records and evidence file bytes are encrypted and isolated by tenant and user. Private uploads revalidate your role, assignment, subscription, and record ownership.</Text></Card><Card><Text style={styles.cardTitle}>Account switching</Text><Text style={styles.muted}>Signing out revokes this device session. The next sign-in screen will show the active browser identity and provide a clear option to use another Senzilytics, Microsoft, or Okta account.</Text></Card><Card><Text style={styles.cardTitle}>Offline queue</Text><Text style={styles.muted}>{pending} queued field item{pending === 1 ? "" : "s"} waiting on this device.</Text></Card><PrimaryButton label="Enable push notifications" onPress={onEnablePush} /><SecondaryButton label="Privacy policy" onPress={() => { void Linking.openURL("https://www.senzilytics.cloud/privacy"); }} /><SecondaryButton label="Support center" onPress={() => { void Linking.openURL("https://www.senzilytics.cloud/support"); }} /><SecondaryButton label="Account and data deletion" onPress={() => { void Linking.openURL("https://www.senzilytics.cloud/account-deletion"); }} /><SecondaryButton label="Sign out and choose another account" onPress={onLogout} /></ScrollView>;
}

function buildCapturedForms(forms: RuntimeForm[], answers: Record<string, FieldValue>): CapturedForm[] {
  return forms.map((form) => {
    const captured: CapturedAnswer[] = [];
    for (const field of form.version.fields) {
      if (!isVisible(field, form, answers) || field.fieldType === "FILE") continue;
      const value = answers[field.id];
      const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
      if (field.isRequired && (empty || (field.fieldType === "BOOLEAN" && value !== true))) throw new Error(`${field.label} is required.`);
      if (empty) continue;
      if (field.fieldType === "NUMBER") { const number = Number(value); if (!Number.isFinite(number)) throw new Error(`${field.label} must be a valid number.`); captured.push({ fieldId: field.id, value: number }); }
      else captured.push({ fieldId: field.id, value });
    }
    return { definitionId: form.id, versionId: form.version.id, answers: captured };
  });
}

function isVisible(field: RuntimeField, form: RuntimeForm, answers: Record<string, FieldValue>) {
  const rule = field.visibilityRule;
  if (!rule || Array.isArray(rule) || typeof rule !== "object") return true;
  const value = rule as { fieldKey?: unknown; operator?: unknown; value?: unknown };
  if (typeof value.fieldKey !== "string" || value.operator !== "EQUALS" || typeof value.value !== "string") return true;
  const controlling = form.version.fields.find((item) => item.key === value.fieldKey);
  const actual = controlling ? answers[controlling.id] : undefined;
  return Array.isArray(actual) ? actual.includes(value.value) : String(actual ?? "") === value.value;
}

function Metric({ label, value }: { label: string; value: number }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Card({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) { return <View style={[styles.card, accent && styles.cardAccent]}>{children}</View>; }
function FieldLabel({ text }: { text: string }) { return <Text style={styles.fieldLabel}>{text}</Text>; }
function Input(props: React.ComponentProps<typeof TextInput>) { return <TextInput {...props} placeholderTextColor="#64748b" style={[styles.input, props.multiline && styles.multiline, props.style]} />; }
function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.disabled]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>; }
function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.disabled]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>; }
function ChipGroup({ values, selected, onSelect }: { values: Array<{ value: string; label: string }>; selected: string; onSelect: (value: string) => void }) { return <View style={styles.chips}>{values.map((item) => <Pressable key={item.value} style={[styles.chip, selected === item.value && styles.chipOn]} onPress={() => onSelect(item.value)}><Text style={[styles.chipText, selected === item.value && styles.chipTextOn]}>{item.label}</Text></Pressable>)}</View>; }
function TabButton({ active, label, badge, onPress }: { active: boolean; label: string; badge?: number; onPress: () => void }) { return <Pressable style={styles.tab} onPress={onPress}><View><Text style={[styles.tabText, active && styles.tabTextOn]}>{label}</Text>{badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text></View> : null}</View></Pressable>; }
function EmptyState({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function humanize(value: string) { return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatFileSize(value: number) { return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`; }
function placeholderFor(type: RuntimeField["fieldType"]) { if (type === "DATE") return "YYYY-MM-DD"; if (type === "DATETIME") return "YYYY-MM-DDTHH:mm:ssZ"; if (type === "SIGNATURE") return "Type your full name"; return "Enter a response"; }
function messageOf(error: unknown) { return error instanceof MobileApiError || error instanceof Error ? error.message : "Something went wrong."; }

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#07111f", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  flex: { flex: 1 }, center: { alignItems: "center", justifyContent: "center", padding: 24 }, loadingText: { color: "#94a3b8", marginTop: 16 },
  header: { minHeight: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#172033" }, headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 11 }, headerLogo: { width: 38, height: 38, borderRadius: 11, overflow: "hidden", backgroundColor: "#07111f" }, headerLogoImage: { width: "100%", height: "100%" },
  brand: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 2.4 }, headerTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "700", marginTop: 3 }, onlineDot: { width: 10, height: 10, borderRadius: 5 },
  notice: { backgroundColor: "#123047", paddingHorizontal: 18, paddingVertical: 10 }, noticeText: { color: "#bae6fd", fontSize: 13, lineHeight: 18 },
  content: { flex: 1 }, contentInner: { padding: 20, paddingBottom: 120, gap: 14 }, eyebrow: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 2 }, pageTitle: { color: "#f8fafc", fontSize: 30, lineHeight: 37, fontWeight: "800" }, muted: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  captureSwitcher: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#172033" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, metric: { width: "48%", minHeight: 100, borderRadius: 18, padding: 16, justifyContent: "space-between", backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43" }, metricValue: { color: "#f8fafc", fontSize: 30, fontWeight: "800" }, metricLabel: { color: "#94a3b8", fontSize: 13 },
  card: { borderRadius: 18, padding: 17, gap: 8, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43" }, cardAccent: { borderColor: "#22d3ee" }, cardTitle: { color: "#f8fafc", fontWeight: "700", fontSize: 16 }, due: { color: "#67e8f9", fontSize: 12, marginTop: 3 }, sectionTitle: { color: "#e2e8f0", fontSize: 19, fontWeight: "700", marginTop: 8 }, empty: { borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 18, padding: 24 },
  moduleSection: { gap: 12 }, moduleHeading: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, moduleMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#123047", borderWidth: 1, borderColor: "#1e7494" }, moduleMarkText: { color: "#67e8f9", fontSize: 16, fontWeight: "900" }, moduleCopy: { flex: 1, gap: 5 }, offlineBanner: { borderRadius: 16, borderWidth: 1, borderColor: "#f59e0b55", backgroundColor: "#78350f33", padding: 14 }, offlineBannerText: { color: "#fde68a", fontSize: 13, lineHeight: 19 },
  progressTrack: { height: 7, borderRadius: 999, overflow: "hidden", backgroundColor: "#1e293b", marginTop: 5 }, progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#22d3ee" }, questionNumber: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, findingPanel: { gap: 8, borderTopWidth: 1, borderTopColor: "#263a55", marginTop: 3, paddingTop: 8 }, successText: { color: "#6ee7b7", fontSize: 13, lineHeight: 18 },
  evidencePanel: { gap: 7, marginTop: 8, borderRadius: 15, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", padding: 13 }, evidenceFile: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 10 }, evidenceFileCopy: { flex: 1 }, evidenceFileName: { color: "#dbeafe", fontSize: 13, fontWeight: "700" }, removeEvidence: { color: "#fda4af", fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 7 },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: "#67e8f9", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 8 }, primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 }, secondaryButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: "#2d4964", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 8 }, secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 14 }, disabled: { opacity: 0.55 },
  fieldLabel: { color: "#dbeafe", fontWeight: "700", fontSize: 13, marginTop: 6 }, fieldHelp: { color: "#64748b", fontSize: 12 }, fieldBlock: { gap: 6, marginTop: 6 }, input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", color: "#f8fafc", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }, multiline: { minHeight: 104, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { borderRadius: 999, borderWidth: 1, borderColor: "#263a55", paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "#091525" }, chipOn: { borderColor: "#67e8f9", backgroundColor: "#123047" }, chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" }, chipTextOn: { color: "#cffafe" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 11, marginVertical: 8 }, checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center" }, checkboxOn: { backgroundColor: "#22d3ee", borderColor: "#22d3ee" }, checkmark: { color: "#07111f", fontWeight: "900" }, checkLabel: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 18 }, error: { color: "#fda4af", fontSize: 13, lineHeight: 19, marginTop: 8 },
  tabs: { position: "absolute", bottom: 0, left: 0, right: 0, minHeight: 74, paddingBottom: Platform.OS === "ios" ? 16 : 6, flexDirection: "row", alignItems: "center", backgroundColor: "#081321", borderTopWidth: 1, borderTopColor: "#172033" }, tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 54 }, tabText: { color: "#64748b", fontSize: 10.5, fontWeight: "700" }, tabTextOn: { color: "#67e8f9" }, badge: { position: "absolute", right: -13, top: -10, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#fb7185", alignItems: "center", justifyContent: "center" }, badgeText: { color: "white", fontSize: 9, fontWeight: "800" },
  signInCard: { width: "100%", maxWidth: 440, borderRadius: 28, padding: 26, gap: 14, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#1f3852" }, logo: { width: 76, height: 76, borderRadius: 23, overflow: "hidden", alignSelf: "flex-start", shadowColor: "#22d3ee", shadowOpacity: 0.2, shadowRadius: 18, elevation: 5 }, signInTitle: { color: "#f8fafc", fontSize: 31, lineHeight: 38, fontWeight: "800" }, securityNote: { color: "#64748b", textAlign: "center", fontSize: 11, marginTop: 3 },
});
