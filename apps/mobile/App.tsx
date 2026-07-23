import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { registerForMobilePush, subscribeToMobileNotificationResponses } from "./src/push";
import { MOBILE_WORKSPACE_MAX_OFFLINE_AGE_MS } from "./src/session-lifecycle";
import { cacheWorkspace, clearWorkspaceCache, initializeOfflineStore, pendingObservationCount, queueObservation, readCachedWorkspace, synchronizeObservations } from "./src/storage";
import type { CapturedAnswer, CapturedForm, MobileBootstrap, MobileModule, MobileNotification, ObservationPayload, RuntimeField, RuntimeForm } from "./src/types";

type Tab = "home" | "workspace" | "capture" | "notifications" | "settings";
type FieldValue = string | boolean | string[];
const observationTypes = ["UNSAFE_ACT", "UNSAFE_CONDITION", "POSITIVE_PRACTICE", "ENVIRONMENTAL", "QUALITY", "OTHER"] as const;
const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default function App() {
  const network = Network.useNetworkState();
  const [authState, setAuthState] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [workspace, setWorkspace] = useState<MobileBootstrap | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const syncInFlight = useRef(false);

  const ownerKey = workspace ? `${workspace.organization.id}:${workspace.user.id}` : "";
  const online = network.isConnected !== false && network.isInternetReachable !== false;

  const refreshWorkspace = useCallback(async () => {
    const next = await loadMobileWorkspace();
    const nextOwner = `${next.organization.id}:${next.user.id}`;
    const verified = new Date().toISOString();
    setWorkspace(next);
    setVerifiedAt(Date.parse(verified));
    await cacheWorkspace(nextOwner, next, verified);
    setPending(await pendingObservationCount(nextOwner));
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
            setPending(await pendingObservationCount(storedOwner));
            setNotice("Live verification is unavailable. You are using encrypted device data and can continue capturing observations offline.");
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
      const result = await synchronizeObservations(ownerKey);
      setPending(await pendingObservationCount(ownerKey));
      if (result.synchronized || result.failed || !silent) setNotice(result.synchronized ? `${result.synchronized} record${result.synchronized === 1 ? "" : "s"} synchronized.` : result.failed ? "Queued records still require attention." : "Everything is synchronized.");
      await refreshWorkspace();
    } catch (error) { setNotice(`Synchronization paused: ${messageOf(error)}`); }
    finally { syncInFlight.current = false; setBusy(false); }
  }, [online, ownerKey, refreshWorkspace]);

  useEffect(() => {
    if (authState === "signed-in" && ownerKey && online) void sync(true);
  }, [authState, online, ownerKey, sync]);

  useEffect(() => subscribeToMobileNotificationResponses(() => {
    setTab("notifications");
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
      {tab === "home" && <HomeScreen workspace={workspace} pending={pending} busy={busy} onRefresh={async () => { try { return await refreshWorkspace(); } catch (error) { setNotice(`Refresh paused: ${messageOf(error)}`); return workspace; } }} onSync={sync} onNavigate={setTab} />}
      {tab === "workspace" && <WorkspaceScreen modules={workspace.modules ?? []} online={online} onCapture={() => setTab("capture")} onOpen={async (module) => { if (!online) { setNotice("Connect to the internet to open the complete operational workspace. Offline field capture remains available."); return; } try { await Linking.openURL(mobileWebUrl(module.href)); } catch (error) { setNotice(messageOf(error)); } }} />}
      {tab === "capture" && <CaptureScreen workspace={workspace} ownerKey={ownerKey} online={online} onQueued={async (message) => { setPending(await pendingObservationCount(ownerKey)); setNotice(message); }} onSync={sync} />}
      {tab === "notifications" && <NotificationsScreen notifications={workspace.notifications} onRead={async (id) => { if (!online) { setNotice("Notification status will remain unchanged until the device is online."); return; } try { await mobileApi("/api/mobile/notifications", { method: "PATCH", body: JSON.stringify({ notificationId: id }) }); setWorkspace((current) => current ? { ...current, notifications: current.notifications.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item) } : current); } catch (error) { setNotice(`Notification update paused: ${messageOf(error)}`); } }} />}
      {tab === "settings" && <SettingsScreen workspace={workspace} pending={pending} onEnablePush={async () => { setBusy(true); try { setNotice(await registerForMobilePush()); } catch (error) { setNotice(messageOf(error)); } finally { setBusy(false); } }} onLogout={async () => { setBusy(true); try { await logoutMobileSession(); await clearWorkspaceCache(ownerKey); setWorkspace(null); setVerifiedAt(null); setAuthState("signed-out"); setTab("home"); } finally { setBusy(false); } }} />}
      <View style={styles.tabs}>
        <TabButton active={tab === "home"} label="Home" onPress={() => setTab("home")} />
        <TabButton active={tab === "workspace"} label="Workspace" onPress={() => setTab("workspace")} />
        <TabButton active={tab === "capture"} label="Capture" badge={pending || undefined} onPress={() => setTab("capture")} />
        <TabButton active={tab === "notifications"} label="Alerts" badge={unread || undefined} onPress={() => setTab("notifications")} />
        <TabButton active={tab === "settings"} label="Settings" onPress={() => setTab("settings")} />
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen() { return <SafeAreaView style={[styles.app, styles.center]}><ActivityIndicator color="#67e8f9" size="large" /><Text style={styles.loadingText}>Securing your mobile workspace…</Text></SafeAreaView>; }

function SignInScreen({ busy, notice, onSignIn }: { busy: boolean; notice: string; onSignIn: () => void }) {
  return <SafeAreaView style={[styles.app, styles.center]}><View style={styles.signInCard}><Image source={require("./assets/app-icon.png")} style={styles.logo} resizeMode="contain" /><Text style={styles.eyebrow}>SENZILYTICS · EHS INTELLIGENCE</Text><Text style={styles.signInTitle}>Your complete EHS workspace.</Text><Text style={styles.muted}>Use your Senzilytics, Microsoft, or Okta account. The authorization screen always identifies the active account and lets you choose a different user before access is issued.</Text>{notice ? <Text style={styles.error}>{notice}</Text> : null}<PrimaryButton label={busy ? "Opening account selection…" : "Choose account and sign in"} disabled={busy} onPress={onSignIn} /><Text style={styles.securityNote}>Device-bound session · Encrypted credential storage · Role-aware Premium access</Text></View></SafeAreaView>;
}

function HomeScreen({ workspace, pending, busy, onRefresh, onSync, onNavigate }: { workspace: MobileBootstrap; pending: number; busy: boolean; onRefresh: () => Promise<MobileBootstrap>; onSync: () => void; onNavigate: (tab: Tab) => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const unread = workspace.notifications.filter((item) => !item.readAt).length;
  return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} refreshControl={<RefreshControl tintColor="#67e8f9" refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }} />}><Text style={styles.eyebrow}>MOBILE COMMAND CENTER</Text><Text style={styles.pageTitle}>Welcome, {workspace.user.name.split(" ")[0]}</Text><Text style={styles.muted}>{workspace.organization.subscriptionPlan} workspace · {humanize(workspace.user.role)}</Text><View style={styles.metricGrid}><Metric label="Active tasks" value={workspace.tasks.length} /><Metric label="Unread alerts" value={unread} /><Metric label="Offline queue" value={pending} /><Metric label="My modules" value={(workspace.modules ?? []).length} /></View><Card accent><Text style={styles.cardTitle}>Your authorized workspace</Text><Text style={styles.muted}>Open every Senzilytics function assigned to your role. Modules you cannot access are automatically hidden.</Text><SecondaryButton label="Explore my workspace" onPress={() => onNavigate("workspace")} /></Card><Card><Text style={styles.cardTitle}>Fast field actions</Text><Text style={styles.muted}>Capture observations even when connectivity is unreliable. Every queued record remains tenant- and user-scoped.</Text><View style={styles.row}><SecondaryButton label="New observation" onPress={() => onNavigate("capture")} /><SecondaryButton label={busy ? "Syncing…" : "Sync now"} onPress={onSync} disabled={busy} /></View></Card><Text style={styles.sectionTitle}>Assigned workflow</Text>{workspace.tasks.length ? workspace.tasks.slice(0, 8).map((task) => <Card key={task.id}><Text style={styles.cardTitle}>{task.name}</Text><Text style={styles.muted}>{task.instance.template.name} · {humanize(task.instance.entityType)}</Text><Text style={styles.due}>{task.dueAt ? `Due ${formatDate(task.dueAt)}` : "No due date"}</Text></Card>) : <EmptyState text="No active workflow steps are assigned to you." />}</ScrollView>;
}

function WorkspaceScreen({ modules, online, onCapture, onOpen }: { modules: MobileModule[]; online: boolean; onCapture: () => void; onOpen: (module: MobileModule) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visible = modules.filter((module) => !normalized || `${module.label} ${module.description} ${humanize(module.category)}`.toLowerCase().includes(normalized));
  const categories: MobileModule["category"][] = ["COMMAND", "SAFETY", "ASSURANCE", "GOVERNANCE", "ADMINISTRATION"];
  return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>ROLE-AWARE ACCESS</Text><Text style={styles.pageTitle}>My workspace</Text><Text style={styles.muted}>Your tenant and role determine what appears here. Operational pages open in Senzilytics&apos; responsive secure workspace; native offline field capture remains available from the Capture tab.</Text><Input value={query} onChangeText={setQuery} placeholder="Search my authorized modules" autoCapitalize="none" />{!online ? <View style={styles.offlineBanner}><Text style={styles.offlineBannerText}>You are offline. Complete operational workspaces require a connection, but observation capture and queued records remain available.</Text></View> : null}{categories.map((category) => { const categoryModules = visible.filter((module) => module.category === category); if (!categoryModules.length) return null; return <View key={category} style={styles.moduleSection}><Text style={styles.sectionTitle}>{humanize(category)}</Text>{categoryModules.map((module) => <Card key={module.key} accent={Boolean(module.nativeCapability)}><View style={styles.moduleHeading}><View style={styles.moduleMark}><Text style={styles.moduleMarkText}>{module.label.slice(0, 1)}</Text></View><View style={styles.moduleCopy}><Text style={styles.cardTitle}>{module.label}</Text><Text style={styles.muted}>{module.description}</Text></View></View><View style={styles.row}>{module.nativeCapability === "OBSERVATION_CAPTURE" ? <SecondaryButton label="Capture offline" onPress={onCapture} /> : null}<SecondaryButton label={online ? "Open workspace" : "Connection required"} disabled={!online} onPress={() => { void onOpen(module); }} /></View></Card>)}</View>; })}{!visible.length ? <EmptyState text="No authorized module matches your search." /> : null}</ScrollView>;
}

function CaptureScreen({ workspace, ownerKey, online, onQueued, onSync }: { workspace: MobileBootstrap; ownerKey: string; online: boolean; onQueued: (message: string) => Promise<void>; onSync: () => void }) {
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
      await queueObservation(ownerKey, { siteId, title: title.trim(), description: description.trim(), type, riskLevel, location: location.trim() || undefined, immediateAction: immediateAction.trim() || undefined, observedAt: new Date().toISOString(), isAnonymous: anonymous, customForms });
      setTitle(""); setDescription(""); setLocation(""); setImmediateAction(""); setAnswers({});
      await onQueued(online ? "Observation queued. Synchronizing now…" : "Observation saved offline and will synchronize when connectivity returns.");
      if (online) onSync();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setSaving(false); }
  };

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>{online ? "ONLINE" : "OFFLINE READY"}</Text><Text style={styles.pageTitle}>Capture observation</Text><FieldLabel text="Site *" /><ChipGroup values={workspace.sites.map((site) => ({ value: site.id, label: site.name }))} selected={siteId} onSelect={setSiteId} /><FieldLabel text="Title *" /><Input value={title} onChangeText={setTitle} placeholder="What did you observe?" /><FieldLabel text="Description *" /><Input value={description} onChangeText={setDescription} placeholder="Describe the condition, behavior, or positive practice" multiline /><FieldLabel text="Observation type" /><ChipGroup values={observationTypes.map((value) => ({ value, label: humanize(value) }))} selected={type} onSelect={(value) => setType(value as ObservationPayload["type"])} /><FieldLabel text="Risk level" /><ChipGroup values={riskLevels.map((value) => ({ value, label: humanize(value) }))} selected={riskLevel} onSelect={(value) => setRiskLevel(value as ObservationPayload["riskLevel"])} /><FieldLabel text="Location" /><Input value={location} onChangeText={setLocation} placeholder="Area, building, or equipment" /><FieldLabel text="Immediate action" /><Input value={immediateAction} onChangeText={setImmediateAction} placeholder="What was done immediately?" multiline /><Pressable style={styles.checkRow} onPress={() => setAnonymous((value) => !value)}><View style={[styles.checkbox, anonymous && styles.checkboxOn]}>{anonymous ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.checkLabel}>Hide my identity from standard observation views</Text></Pressable>{workspace.observationForms.map((form) => <DynamicForm key={form.id} form={form} answers={answers} setAnswers={setAnswers} />)}{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label={saving ? "Saving securely…" : online ? "Save and synchronize" : "Save offline"} disabled={saving} onPress={save} /></ScrollView></KeyboardAvoidingView>;
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

function NotificationsScreen({ notifications, onRead }: { notifications: MobileNotification[]; onRead: (id: string) => Promise<void> }) {
  return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><Text style={styles.eyebrow}>ACTION CENTER</Text><Text style={styles.pageTitle}>Notifications</Text>{notifications.length ? notifications.map((item) => <Pressable key={item.id} onPress={() => { if (!item.readAt) void onRead(item.id); }}><Card accent={!item.readAt}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{item.message}</Text><Text style={styles.due}>{formatDate(item.createdAt)}{item.readAt ? "" : " · New"}</Text></Card></Pressable>) : <EmptyState text="You have no notifications." />}</ScrollView>;
}

function SettingsScreen({ workspace, pending, onEnablePush, onLogout }: { workspace: MobileBootstrap; pending: number; onEnablePush: () => void; onLogout: () => void }) {
  return <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><Text style={styles.eyebrow}>ACCOUNT</Text><Text style={styles.pageTitle}>Mobile settings</Text><Card><Text style={styles.cardTitle}>{workspace.user.name}</Text><Text style={styles.muted}>{workspace.user.email}</Text><Text style={styles.due}>{humanize(workspace.user.role)} · {workspace.organization.name}</Text></Card><Card><Text style={styles.cardTitle}>Data protection</Text><Text style={styles.muted}>Credentials are stored in the device Keychain or Android Keystore. Offline submissions are isolated by tenant and user. The server revalidates your access on every synchronization.</Text></Card><Card><Text style={styles.cardTitle}>Account switching</Text><Text style={styles.muted}>Signing out revokes this device session. The next sign-in screen will show the active browser identity and provide a clear option to use another Senzilytics, Microsoft, or Okta account.</Text></Card><Card><Text style={styles.cardTitle}>Offline queue</Text><Text style={styles.muted}>{pending} observation{pending === 1 ? "" : "s"} waiting on this device.</Text></Card><PrimaryButton label="Enable push notifications" onPress={onEnablePush} /><SecondaryButton label="Privacy policy" onPress={() => { void Linking.openURL("https://www.senzilytics.cloud/privacy"); }} /><SecondaryButton label="Support center" onPress={() => { void Linking.openURL("https://www.senzilytics.cloud/support"); }} /><SecondaryButton label="Account and data deletion" onPress={() => { void Linking.openURL("https://www.senzilytics.cloud/account-deletion"); }} /><SecondaryButton label="Sign out and choose another account" onPress={onLogout} /></ScrollView>;
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
function placeholderFor(type: RuntimeField["fieldType"]) { if (type === "DATE") return "YYYY-MM-DD"; if (type === "DATETIME") return "YYYY-MM-DDTHH:mm:ssZ"; if (type === "SIGNATURE") return "Type your full name"; return "Enter a response"; }
function messageOf(error: unknown) { return error instanceof MobileApiError || error instanceof Error ? error.message : "Something went wrong."; }

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#07111f", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  flex: { flex: 1 }, center: { alignItems: "center", justifyContent: "center", padding: 24 }, loadingText: { color: "#94a3b8", marginTop: 16 },
  header: { minHeight: 72, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#172033" }, headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 11 }, headerLogo: { width: 38, height: 38, borderRadius: 11, overflow: "hidden", backgroundColor: "#07111f" }, headerLogoImage: { width: "100%", height: "100%" },
  brand: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 2.4 }, headerTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "700", marginTop: 3 }, onlineDot: { width: 10, height: 10, borderRadius: 5 },
  notice: { backgroundColor: "#123047", paddingHorizontal: 18, paddingVertical: 10 }, noticeText: { color: "#bae6fd", fontSize: 13, lineHeight: 18 },
  content: { flex: 1 }, contentInner: { padding: 20, paddingBottom: 120, gap: 14 }, eyebrow: { color: "#67e8f9", fontSize: 11, fontWeight: "800", letterSpacing: 2 }, pageTitle: { color: "#f8fafc", fontSize: 30, lineHeight: 37, fontWeight: "800" }, muted: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, metric: { width: "48%", minHeight: 100, borderRadius: 18, padding: 16, justifyContent: "space-between", backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43" }, metricValue: { color: "#f8fafc", fontSize: 30, fontWeight: "800" }, metricLabel: { color: "#94a3b8", fontSize: 13 },
  card: { borderRadius: 18, padding: 17, gap: 8, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#172a43" }, cardAccent: { borderColor: "#22d3ee" }, cardTitle: { color: "#f8fafc", fontWeight: "700", fontSize: 16 }, due: { color: "#67e8f9", fontSize: 12, marginTop: 3 }, sectionTitle: { color: "#e2e8f0", fontSize: 19, fontWeight: "700", marginTop: 8 }, empty: { borderWidth: 1, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 18, padding: 24 },
  moduleSection: { gap: 12 }, moduleHeading: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, moduleMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#123047", borderWidth: 1, borderColor: "#1e7494" }, moduleMarkText: { color: "#67e8f9", fontSize: 16, fontWeight: "900" }, moduleCopy: { flex: 1, gap: 5 }, offlineBanner: { borderRadius: 16, borderWidth: 1, borderColor: "#f59e0b55", backgroundColor: "#78350f33", padding: 14 }, offlineBannerText: { color: "#fde68a", fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 7 },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: "#67e8f9", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 8 }, primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 }, secondaryButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: "#2d4964", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 8 }, secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 14 }, disabled: { opacity: 0.55 },
  fieldLabel: { color: "#dbeafe", fontWeight: "700", fontSize: 13, marginTop: 6 }, fieldHelp: { color: "#64748b", fontSize: 12 }, fieldBlock: { gap: 6, marginTop: 6 }, input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#263a55", backgroundColor: "#091525", color: "#f8fafc", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }, multiline: { minHeight: 104, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { borderRadius: 999, borderWidth: 1, borderColor: "#263a55", paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "#091525" }, chipOn: { borderColor: "#67e8f9", backgroundColor: "#123047" }, chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" }, chipTextOn: { color: "#cffafe" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 11, marginVertical: 8 }, checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center" }, checkboxOn: { backgroundColor: "#22d3ee", borderColor: "#22d3ee" }, checkmark: { color: "#07111f", fontWeight: "900" }, checkLabel: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 18 }, error: { color: "#fda4af", fontSize: 13, lineHeight: 19, marginTop: 8 },
  tabs: { position: "absolute", bottom: 0, left: 0, right: 0, minHeight: 74, paddingBottom: Platform.OS === "ios" ? 16 : 6, flexDirection: "row", alignItems: "center", backgroundColor: "#081321", borderTopWidth: 1, borderTopColor: "#172033" }, tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 54 }, tabText: { color: "#64748b", fontSize: 10.5, fontWeight: "700" }, tabTextOn: { color: "#67e8f9" }, badge: { position: "absolute", right: -13, top: -10, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#fb7185", alignItems: "center", justifyContent: "center" }, badgeText: { color: "white", fontSize: 9, fontWeight: "800" },
  signInCard: { width: "100%", maxWidth: 440, borderRadius: 28, padding: 26, gap: 14, backgroundColor: "#0d1a2c", borderWidth: 1, borderColor: "#1f3852" }, logo: { width: 76, height: 76, borderRadius: 23, overflow: "hidden", alignSelf: "flex-start", shadowColor: "#22d3ee", shadowOpacity: 0.2, shadowRadius: 18, elevation: 5 }, signInTitle: { color: "#f8fafc", fontSize: 31, lineHeight: 38, fontWeight: "800" }, securityNote: { color: "#64748b", textAlign: "center", fontSize: 11, marginTop: 3 },
});
