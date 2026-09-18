import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { OfflineOutboxSnapshot } from "./storage";

export function OfflineOutboxScreen({ ownerKey, online, busy, loadSnapshot, onBack, onSync, onRetry, onDiscard }: { ownerKey: string; online: boolean; busy: boolean; loadSnapshot: () => Promise<OfflineOutboxSnapshot>; onBack: () => void; onSync: () => void; onRetry: (kind: "record" | "evidence", id: string) => Promise<void>; onDiscard: (kind: "record" | "evidence", id: string) => Promise<void> }) {
  const [snapshot, setSnapshot] = useState<OfflineOutboxSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => { if (!ownerKey) return; setError(""); try { setSnapshot(await loadSnapshot()); } catch (reason) { setError(reason instanceof Error ? reason.message : "The Offline Outbox could not be read."); } }, [loadSnapshot, ownerKey]);
  useEffect(() => { void refresh(); }, [refresh]);
  const pending = snapshot?.pendingCount ?? 0;
  const recover = async (kind: "record" | "evidence", id: string) => {
    setError("");
    try {
      await onRetry(kind, id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The queued item could not be retried.");
    }
  };
  const confirmDiscard = (kind: "record" | "evidence", id: string, attachmentCount = 0) => {
    const detail = kind === "record" && attachmentCount
      ? ` This will also permanently remove ${attachmentCount} linked local evidence attachment${attachmentCount === 1 ? "" : "s"} that have not synchronized.`
      : " This removes only the unsynchronized local item from this device.";
    Alert.alert(
      kind === "record" ? "Discard queued record?" : "Discard queued evidence?",
      `This action cannot be undone.${detail}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void onDiscard(kind, id)
              .then(refresh)
              .catch((reason) => setError(reason instanceof Error ? reason.message : "The queued item could not be discarded."));
          },
        },
      ]
    );
  };
  return <ScrollView style={styles.content} contentContainerStyle={styles.inner} refreshControl={<RefreshControl tintColor="#67e8f9" refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } }} />}>
    <Button label="← Back" onPress={onBack}/><Text style={styles.eyebrow}>OFFLINE RELIABILITY</Text><Text style={styles.title}>Offline Outbox</Text><Text style={styles.muted}>Review encrypted records and evidence waiting on this device. Record payloads and evidence contents are never displayed here.</Text>
    {!online ? <View style={styles.banner}><Text style={styles.bannerText}>You are offline. Queued work remains encrypted and available for review.</Text></View> : null}
    <View style={styles.metrics}><Metric label="Queued items" value={pending}/><Metric label="Need attention" value={snapshot?.failedCount ?? 0}/></View>
    <View style={styles.row}><Button label={busy ? "Synchronizing…" : "Sync now"} disabled={busy || !online || !pending} onPress={onSync}/><Button label="Refresh status" disabled={refreshing} onPress={() => void refresh()}/></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}{!snapshot ? <View style={styles.loading}><ActivityIndicator color="#67e8f9"/><Text style={styles.muted}>Reading encrypted outbox…</Text></View> : null}
    {snapshot && !snapshot.records.length && !snapshot.evidence.length ? <Empty text="Everything on this device is synchronized."/> : null}
    {snapshot?.records.length ? <Text style={styles.section}>Queued records</Text> : null}
    {snapshot?.records.map(item => <View key={item.id} style={[styles.card,item.status === "FAILED" && styles.failed]}><View style={styles.header}><Text style={styles.cardTitle}>{item.label}</Text><Status value={item.status}/></View><Text style={styles.muted}>Captured {formatDate(item.capturedAt)}</Text><Text style={styles.detail}>{item.attachmentCount ? `${item.attachmentCount} evidence attachment${item.attachmentCount === 1 ? "" : "s"}` : "No queued attachments"}</Text>{item.lastError ? <Text style={styles.error}>{item.lastError}</Text> : null}<View style={styles.row}>{item.status === "FAILED" ? <Button label="Retry" disabled={!online || busy} onPress={() => void recover("record", item.id)}/> : null}<Button label="Discard" disabled={busy} destructive onPress={() => confirmDiscard("record", item.id, item.attachmentCount)}/></View></View>)}
    {snapshot?.evidence.length ? <Text style={styles.section}>Queued evidence</Text> : null}
    {snapshot?.evidence.map(item => <View key={item.id} style={[styles.card,item.status === "FAILED" && styles.failed]}><View style={styles.header}><Text style={styles.cardTitle}>{item.label}</Text><Status value={item.status}/></View><Text style={styles.file}>{item.fileName}</Text><Text style={styles.muted}>{item.mimeType} · {formatSize(item.sizeBytes)} · {formatDate(item.capturedAt)}</Text><Text style={styles.detail}>{item.parentSubmissionId ? "Linked to its queued parent record" : "Evidence for an existing synchronized record"}</Text>{item.lastError ? <Text style={styles.error}>{item.lastError}</Text> : null}<View style={styles.row}>{item.status === "FAILED" ? <Button label="Retry" disabled={!online || busy} onPress={() => void recover("evidence", item.id)}/> : null}<Button label="Discard" disabled={busy} destructive onPress={() => confirmDiscard("evidence", item.id)}/></View></View>)}
    {snapshot?.history.length ? <Text style={styles.section}>Synchronization history</Text> : null}
    {snapshot?.history.map(item => <View key={item.id} style={styles.history}><View style={styles.header}><Text style={styles.cardTitle}>{item.label}</Text><Text style={styles.historyOutcome}>{historyLabel(item.outcome)}</Text></View><Text style={styles.muted}>{formatDate(item.occurredAt)}</Text>{item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}</View>)}
    <Text style={styles.security}>Outbox metadata and synchronization history are tenant- and user-scoped. History contains operational metadata only, never record payloads or evidence contents.</Text>
  </ScrollView>;
}
function Status({value}:{value:"PENDING"|"FAILED"|"EVIDENCE_PENDING"}) { const label=value==="EVIDENCE_PENDING"?"Evidence pending":value==="FAILED"?"Needs attention":"Pending"; return <View style={[styles.status,value==="FAILED"&&styles.statusFailed]}><Text style={styles.statusText}>{label}</Text></View>; }
function Metric({label,value}:{label:string;value:number}) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Button({label,onPress,disabled=false,destructive=false}:{label:string;onPress:()=>void;disabled?:boolean;destructive?:boolean}) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.button,destructive&&styles.destructiveButton,disabled&&styles.disabled]}><Text style={[styles.buttonText,destructive&&styles.destructiveText]}>{label}</Text></Pressable>; }
function Empty({text}:{text:string}) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function historyLabel(value:string) { return value.replaceAll("_"," ").toLowerCase().replace(/^./, letter => letter.toUpperCase()); }
function formatDate(value:string) { return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)); }
function formatSize(value:number) { return value>=1024*1024?`${(value/(1024*1024)).toFixed(1)} MB`:`${Math.max(1,Math.round(value/1024))} KB`; }
const styles=StyleSheet.create({content:{flex:1,backgroundColor:"#07111f"},inner:{padding:20,paddingBottom:120,gap:14},eyebrow:{color:"#67e8f9",fontSize:11,fontWeight:"800",letterSpacing:2},title:{color:"#f8fafc",fontSize:30,lineHeight:37,fontWeight:"800"},muted:{color:"#94a3b8",fontSize:13,lineHeight:19},banner:{borderRadius:16,borderWidth:1,borderColor:"#f59e0b55",backgroundColor:"#78350f33",padding:14},bannerText:{color:"#fde68a",fontSize:13,lineHeight:19},metrics:{flexDirection:"row",gap:10},metric:{flex:1,minHeight:92,borderRadius:18,padding:16,justifyContent:"space-between",backgroundColor:"#0d1a2c",borderWidth:1,borderColor:"#172a43"},metricValue:{color:"#f8fafc",fontSize:28,fontWeight:"800"},metricLabel:{color:"#94a3b8",fontSize:12},row:{flexDirection:"row",flexWrap:"wrap",gap:10},button:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:"#2d4964",alignItems:"center",justifyContent:"center",paddingHorizontal:16},buttonText:{color:"#bae6fd",fontWeight:"700",fontSize:14},destructiveButton:{borderColor:"#fb718566",backgroundColor:"#7f1d1d22"},destructiveText:{color:"#fda4af"},disabled:{opacity:.5},section:{color:"#e2e8f0",fontSize:19,fontWeight:"700",marginTop:8},card:{borderRadius:18,padding:17,gap:8,backgroundColor:"#0d1a2c",borderWidth:1,borderColor:"#172a43"},failed:{borderColor:"#fb718566"},header:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},cardTitle:{flex:1,color:"#f8fafc",fontWeight:"700",fontSize:15},file:{color:"#dbeafe",fontSize:13,fontWeight:"700"},detail:{color:"#67e8f9",fontSize:12},error:{color:"#fda4af",fontSize:12,lineHeight:18},status:{borderRadius:999,borderWidth:1,borderColor:"#2d4964",backgroundColor:"#123047",paddingHorizontal:9,paddingVertical:5},statusFailed:{borderColor:"#fb718566",backgroundColor:"#7f1d1d33"},statusText:{color:"#bae6fd",fontSize:10,fontWeight:"800"},empty:{borderWidth:1,borderColor:"#1e293b",borderStyle:"dashed",borderRadius:18,padding:24},loading:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:18},history:{borderLeftWidth:2,borderLeftColor:"#2d4964",paddingLeft:12,gap:5},historyOutcome:{color:"#67e8f9",fontSize:10,fontWeight:"800"},security:{color:"#64748b",fontSize:11,lineHeight:17,marginTop:6}});
