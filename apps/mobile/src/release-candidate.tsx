import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { mobilePublicApi, mobilePublicStatus } from "./api";
import {
  MOBILE_API_VERSION,
  MOBILE_APP_VERSION,
} from "./release-metadata";

export type MobileReleaseStatus = {
  platform: "ios" | "android" | null;
  clientVersion: string | null;
  apiVersion: string | null;
  minimumVersion: string;
  recommendedVersion: string;
  meetsMinimum: boolean;
  updateRequired: boolean;
  updateRecommended: boolean;
  enforcementEnabled: boolean;
  storeUrl: string | null;
  maintenance: boolean;
  message: string | null;
  checkedAt: string;
};

export type MobileSystemHealth = {
  status: "ready" | "degraded" | "unavailable";
  checkedAt: string;
  database: "available" | "unavailable";
  configuration: "valid" | "invalid";
};

export function loadMobileReleaseStatus() {
  return mobilePublicApi<MobileReleaseStatus>("/api/mobile/release", {
    cache: "no-store",
  });
}

export function loadMobileSystemHealth() {
  return mobilePublicStatus<MobileSystemHealth>("/api/health", {
    cache: "no-store",
  });
}

export function MobileUpdateRequiredScreen({
  status,
  onRetry,
}: {
  status: MobileReleaseStatus;
  onRetry: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>SECURE UPDATE REQUIRED</Text>
        <Text style={styles.title}>Update Senzilytics to continue</Text>
        <Text style={styles.copy}>
          Version {MOBILE_APP_VERSION} is no longer supported. Install the
          latest verified release before signing in or synchronizing tenant
          data.
        </Text>
        {status.storeUrl ? (
          <Pressable
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={() => {
              void Linking.openURL(status.storeUrl!);
            }}
          >
            <Text style={styles.primaryButtonText}>
              Open {Platform.OS === "ios" ? "App Store" : "Google Play"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={onRetry}
        >
          <Text style={styles.secondaryButtonText}>Check again</Text>
        </Pressable>
        <Text style={styles.caption}>
          App {MOBILE_APP_VERSION} · API {MOBILE_API_VERSION}
        </Text>
      </View>
    </SafeAreaView>
  );
}

export function MobileDiagnosticsPanel({
  release,
  health,
  verifiedAt,
  pending,
  onRefresh,
}: {
  release: MobileReleaseStatus | null;
  health: MobileSystemHealth | null;
  verifiedAt: number | null;
  pending: number;
  onRefresh: () => void;
}) {
  const releaseState = release?.updateRequired
    ? "Update required"
    : release?.updateRecommended
      ? "Update available"
      : release
        ? "Current"
        : "Not checked";
  const serviceState = release?.maintenance
    ? "Maintenance"
    : health?.status
      ? titleCase(health.status)
      : "Not checked";

  return (
    <View style={styles.diagnostics}>
      <Text style={styles.cardTitle}>Release and service diagnostics</Text>
      <DiagnosticRow label="App version" value={MOBILE_APP_VERSION} />
      <DiagnosticRow label="Mobile API" value={MOBILE_API_VERSION} />
      <DiagnosticRow label="Release status" value={releaseState} />
      <DiagnosticRow label="Service status" value={serviceState} />
      <DiagnosticRow
        label="Database"
        value={health?.database ? titleCase(health.database) : "Not checked"}
      />
      <DiagnosticRow
        label="Last live verification"
        value={verifiedAt ? new Date(verifiedAt).toLocaleString() : "Not verified"}
      />
      <DiagnosticRow label="Offline queue" value={String(pending)} />
      {release?.updateRecommended && release.storeUrl ? (
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={() => {
            void Linking.openURL(release.storeUrl!);
          }}
        >
          <Text style={styles.secondaryButtonText}>Install available update</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={onRefresh}
      >
        <Text style={styles.secondaryButtonText}>Refresh diagnostics</Text>
      </Pressable>
      <Text style={styles.caption}>
        Diagnostics contain service state only. Credentials and tenant record
        content are never displayed here.
      </Text>
    </View>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

type ErrorBoundaryState = { failed: boolean };

export class MobileErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    console.error("The native application encountered an unexpected error.");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>RECOVERY MODE</Text>
          <Text style={styles.title}>This page could not load</Text>
          <Text style={styles.copy}>
            Your queued offline work remains on this device. Try reopening the
            workspace. If the problem continues, contact Senzilytics Support.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={() => this.setState({ failed: false })}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() => {
              void Linking.openURL("https://www.senzilytics.cloud/support");
            }}
          >
            <Text style={styles.secondaryButtonText}>Open support center</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07111f",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  panel: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1f3852",
    backgroundColor: "#0d1a2c",
    padding: 24,
    gap: 14,
  },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: { color: "#f8fafc", fontSize: 28, lineHeight: 35, fontWeight: "800" },
  copy: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  cardTitle: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
  diagnostics: {
    borderRadius: 18,
    padding: 17,
    gap: 9,
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#172a43",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: "#172a43",
    paddingTop: 9,
  },
  rowLabel: { flex: 1, color: "#94a3b8", fontSize: 13 },
  rowValue: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: "#07111f", fontWeight: "800", fontSize: 15 },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2d4964",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: "#bae6fd", fontWeight: "700", fontSize: 14 },
  caption: { color: "#64748b", fontSize: 11, lineHeight: 16, textAlign: "center" },
});
