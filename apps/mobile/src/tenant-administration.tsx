import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  MobileTenantAdministrationWorkspace,
  MobileTenantUser,
} from "./types";

export type TenantAdministrationView =
  | "organization"
  | "users"
  | "workflows"
  | "devices"
  | "configuration"
  | "activity";

type Props = {
  workspace: MobileBootstrap;
  online: boolean;
  initialView: TenantAdministrationView;
  onBack: () => void;
  onRefresh: () => Promise<MobileBootstrap>;
  onNotice: (message: string) => void;
};

type AdminAction =
  | {
      action: "CREATE_SITE";
      name: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
    }
  | {
      action: "UPDATE_SITE";
      siteId: string;
      name: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
    }
  | {
      action: "CREATE_DEPARTMENT";
      siteId: string;
      name: string;
    }
  | {
      action: "UPDATE_DEPARTMENT";
      departmentId: string;
      siteId: string;
      name: string;
    }
  | {
      action: "INVITE_USER";
      name: string;
      email: string;
      role: string;
      departmentId?: string | null;
    }
  | {
      action: "UPDATE_USER_ACCESS";
      userId: string;
      role: string;
      departmentId?: string | null;
      jobTitle?: string;
    }
  | { action: "SET_USER_ACTIVE"; userId: string; active: boolean }
  | { action: "REVOKE_MOBILE_SESSION"; sessionId: string }
  | { action: "SET_WORKFLOW_ACTIVE"; workflowId: string; active: boolean };

const roles = [
  "ORG_ADMIN",
  "EHS_MANAGER",
  "SUPERVISOR",
  "EMPLOYEE",
  "AUDITOR",
] as const;

export function TenantAdministrationScreen(props: Props) {
  const available = availableViews(props.workspace);
  const [view, setView] = useState<TenantAdministrationView>(
    available.includes(props.initialView)
      ? props.initialView
      : (available[0] ?? "organization")
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!available.includes(view) && available[0]) {
      setView(available[0]);
    }
  }, [available, view]);

  const act = async (payload: AdminAction) => {
    if (!props.online) {
      props.onNotice(
        "Connect to the internet before changing tenant administration records."
      );
      return false;
    }
    setBusy(true);
    try {
      const result = await mobileApi<{ success: true; message: string }>(
        "/api/mobile/tenant-administration",
        { method: "POST", body: JSON.stringify(payload) }
      );
      props.onNotice(result.message);
      await props.onRefresh();
      return true;
    } catch (error) {
      props.onNotice(messageOf(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!available.length) {
    return (
      <Page>
        <Header title="Tenant administration" onBack={props.onBack} />
        <Empty text="Your role does not include tenant administration access." />
      </Page>
    );
  }

  return (
    <Page>
      <Header title="Tenant administration" onBack={props.onBack} />
      <Text style={styles.caption}>
        Tenant-scoped structure, people, workflows, mobile devices, and
        accountable activity.
      </Text>
      <Banner
        warning={!props.online}
        text={
          props.online
            ? `Live authorization verified · ${formatDate(
                props.workspace.tenantAdministrationGeneratedAt
              )}`
            : "Read-only encrypted snapshot. Administrative changes require a live authorization check."
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {available.map((item) => (
          <Chip
            key={item}
            label={humanize(item)}
            active={view === item}
            onPress={() => setView(item)}
          />
        ))}
      </ScrollView>
      {view === "organization" ? (
        <OrganizationWorkspace {...props} busy={busy} act={act} />
      ) : null}
      {view === "users" ? (
        <UsersWorkspace {...props} busy={busy} act={act} />
      ) : null}
      {view === "workflows" ? (
        <WorkflowWorkspace {...props} busy={busy} act={act} />
      ) : null}
      {view === "devices" ? (
        <DeviceWorkspace {...props} busy={busy} act={act} />
      ) : null}
      {view === "configuration" ? (
        <ConfigurationWorkspace {...props} />
      ) : null}
      {view === "activity" ? <ActivityWorkspace {...props} /> : null}
    </Page>
  );
}

function OrganizationWorkspace({
  workspace,
  online,
  busy,
  act,
}: Props & {
  busy: boolean;
  act: (payload: AdminAction) => Promise<boolean>;
}) {
  const organization = workspace.tenantOrganization;
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departmentSiteId, setDepartmentSiteId] = useState("");
  const [departmentName, setDepartmentName] = useState("");

  if (!organization) {
    return <Empty text="Organization administration is not assigned to your role." />;
  }

  const selectSite = (id: string) => {
    const selected = organization.sites.find((item) => item.id === id);
    if (!selected) return;
    setSiteId(selected.id);
    setSiteName(selected.name);
    setAddress(selected.address ?? "");
    setCity(selected.city ?? "");
    setState(selected.state ?? "");
    setCountry(selected.country ?? "");
    setDepartmentSiteId(selected.id);
  };
  const clearSite = () => {
    setSiteId(null);
    setSiteName("");
    setAddress("");
    setCity("");
    setState("");
    setCountry("");
  };
  const selectDepartment = (id: string) => {
    const selected = organization.sites
      .flatMap((site) =>
        site.departments.map((department) => ({
          ...department,
          siteId: site.id,
        }))
      )
      .find((item) => item.id === id);
    if (!selected) return;
    setDepartmentId(selected.id);
    setDepartmentName(selected.name);
    setDepartmentSiteId(selected.siteId);
  };

  return (
    <>
      <View style={styles.metricGrid}>
        <Metric label="Sites" value={organization.sites.length} />
        <Metric
          label="Departments"
          value={organization.sites.reduce(
            (total, site) => total + site.departments.length,
            0
          )}
        />
        <Metric label="Users" value={organization._count.users} />
        <Metric
          label="SSO connections"
          value={organization.identityProviders.length}
        />
      </View>
      <Card accent>
        <Text style={styles.cardTitle}>{organization.name}</Text>
        <Text style={styles.muted}>
          {organization.industry ?? "Industry not recorded"} ·{" "}
          {humanize(organization.subscriptionPlan)}
        </Text>
        <Text style={styles.small}>
          Approved domains:{" "}
          {organization.allowedEmailDomains.join(", ") || "None configured"}
        </Text>
        {organization.identityProviders.map((provider) => (
          <View key={provider.id} style={styles.inline}>
            <Status value={provider.type} />
            <Text style={styles.small}>
              {provider.isEnabled ? "Enabled" : "Disabled"} ·{" "}
              {provider.enforceSso ? "SSO required" : "SSO optional"} ·{" "}
              {provider.emailDomain ?? "domain not displayed"}
            </Text>
          </View>
        ))}
        <Text style={styles.help}>
          Identity-provider secrets and enforcement changes remain in the
          protected web administration workspace.
        </Text>
      </Card>
      <Section title={siteId ? "Edit site" : "Create site"}>
        <Input
          value={siteName}
          onChangeText={setSiteName}
          placeholder="Site name"
        />
        <Input value={address} onChangeText={setAddress} placeholder="Address" />
        <Input value={city} onChangeText={setCity} placeholder="City" />
        <View style={styles.row}>
          <Input
            value={state}
            onChangeText={setState}
            placeholder="State / region"
            style={styles.grow}
          />
          <Input
            value={country}
            onChangeText={setCountry}
            placeholder="Country"
            style={styles.grow}
          />
        </View>
        <PrimaryButton
          label={siteId ? "Save site" : "Create site"}
          disabled={!online || busy || !siteName.trim()}
          onPress={async () => {
            const common = {
              name: siteName,
              address,
              city,
              state,
              country,
            };
            const complete = await act(
              siteId
                ? { action: "UPDATE_SITE", siteId, ...common }
                : { action: "CREATE_SITE", ...common }
            );
            if (complete) clearSite();
          }}
        />
        {siteId ? (
          <SecondaryButton label="Cancel edit" onPress={clearSite} />
        ) : null}
      </Section>
      <Section title={departmentId ? "Edit department" : "Create department"}>
        <Text style={styles.fieldLabel}>Site</Text>
        <View style={styles.row}>
          {organization.sites.map((site) => (
            <Chip
              key={site.id}
              label={site.name}
              active={departmentSiteId === site.id}
              onPress={() => setDepartmentSiteId(site.id)}
            />
          ))}
        </View>
        <Input
          value={departmentName}
          onChangeText={setDepartmentName}
          placeholder="Department name"
        />
        <PrimaryButton
          label={departmentId ? "Save department" : "Create department"}
          disabled={
            !online ||
            busy ||
            !departmentSiteId ||
            !departmentName.trim()
          }
          onPress={async () => {
            const complete = await act(
              departmentId
                ? {
                    action: "UPDATE_DEPARTMENT",
                    departmentId,
                    siteId: departmentSiteId,
                    name: departmentName,
                  }
                : {
                    action: "CREATE_DEPARTMENT",
                    siteId: departmentSiteId,
                    name: departmentName,
                  }
            );
            if (complete) {
              setDepartmentId(null);
              setDepartmentName("");
            }
          }}
        />
        {departmentId ? (
          <SecondaryButton
            label="Cancel edit"
            onPress={() => {
              setDepartmentId(null);
              setDepartmentName("");
            }}
          />
        ) : null}
      </Section>
      <Section title="Enterprise structure">
        {organization.sites.map((site) => (
          <Card key={site.id}>
            <View style={styles.titleRow}>
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>{site.name}</Text>
                <Text style={styles.small}>
                  {[site.city, site.state, site.country]
                    .filter(Boolean)
                  .join(", ") || "Location not recorded"}{" "}
                  ·{" "}
                  {site.departments.reduce(
                    (total, department) =>
                      total + department._count.users,
                    0
                  )}{" "}
                  assigned users
                </Text>
              </View>
              <TinyButton label="Edit" onPress={() => selectSite(site.id)} />
            </View>
            {site.departments.map((department) => (
              <View key={department.id} style={styles.listRow}>
                <View style={styles.grow}>
                  <Text style={styles.itemTitle}>{department.name}</Text>
                  <Text style={styles.small}>
                    {department._count.users} users
                  </Text>
                </View>
                <TinyButton
                  label="Edit"
                  onPress={() => selectDepartment(department.id)}
                />
              </View>
            ))}
          </Card>
        ))}
      </Section>
    </>
  );
}

function UsersWorkspace({
  workspace,
  online,
  busy,
  act,
}: Props & {
  busy: boolean;
  act: (payload: AdminAction) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"directory" | "invite">("directory");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("EMPLOYEE");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const capabilities = workspace.tenantAdministrationCapabilities;
  const departments =
    workspace.tenantDirectorySites.flatMap((site) =>
      site.departments.map((department) => ({
        id: department.id,
        label: `${site.name} — ${department.name}`,
      }))
    ) ?? [];
  const normalized = query.trim().toLowerCase();
  const users = workspace.tenantUsers.filter(
    (user) =>
      !normalized ||
      `${user.name} ${user.email} ${user.role} ${
        user.department?.name ?? ""
      }`
        .toLowerCase()
        .includes(normalized)
  );
  const selected = workspace.tenantUsers.find(
    (user) => user.id === selectedId
  );

  const selectUser = (user: MobileTenantUser) => {
    setSelectedId(user.id);
    setRole(user.role);
    setDepartmentId(user.department?.id ?? null);
    setJobTitle(user.jobTitle ?? "");
  };

  if (selected) {
    return (
      <Section title="User access">
        <SecondaryButton label="Back to directory" onPress={() => setSelectedId(null)} />
        <Card accent>
          <Text style={styles.cardTitle}>{selected.name}</Text>
          <Text style={styles.muted}>{selected.email}</Text>
          <Status value={selected.isActive ? "ACTIVE" : "SUSPENDED"} />
          <Text style={styles.small}>
            Last login:{" "}
            {selected.lastLoginAt
              ? formatDate(selected.lastLoginAt)
              : "No recorded login"}
          </Text>
          <Text style={styles.small}>
            Active mobile devices: {selected._count.mobileSessions}
          </Text>
        </Card>
        {capabilities.canManageUsers ? (
          <>
            <Text style={styles.fieldLabel}>Tenant role</Text>
            <View style={styles.row}>
              {roles.map((item) => (
                <Chip
                  key={item}
                  label={humanize(item)}
                  active={role === item}
                  onPress={() => setRole(item)}
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>Department</Text>
            <View style={styles.row}>
              <Chip
                label="No department"
                active={!departmentId}
                onPress={() => setDepartmentId(null)}
              />
              {departments.map((department) => (
                <Chip
                  key={department.id}
                  label={department.label}
                  active={departmentId === department.id}
                  onPress={() => setDepartmentId(department.id)}
                />
              ))}
            </View>
            <Input
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholder="Job title"
            />
            <PrimaryButton
              label="Save access"
              disabled={!online || busy}
              onPress={() =>
                void act({
                  action: "UPDATE_USER_ACCESS",
                  userId: selected.id,
                  role,
                  departmentId,
                  jobTitle,
                })
              }
            />
            <DangerButton
              label={selected.isActive ? "Suspend user" : "Restore user"}
              disabled={!online || busy || selected.id === workspace.user.id}
              onPress={() =>
                void act({
                  action: "SET_USER_ACTIVE",
                  userId: selected.id,
                  active: !selected.isActive,
                })
              }
            />
          </>
        ) : (
          <Text style={styles.help}>Your role has view-only directory access.</Text>
        )}
      </Section>
    );
  }

  return (
    <>
      <View style={styles.row}>
        <Chip
          label="Directory"
          active={mode === "directory"}
          onPress={() => setMode("directory")}
        />
        {capabilities.canManageUsers ? (
          <Chip
            label="Invite"
            active={mode === "invite"}
            onPress={() => setMode("invite")}
          />
        ) : null}
      </View>
      {mode === "invite" ? (
        <Section title="Invite tenant user">
          <Input value={name} onChangeText={setName} placeholder="Full name" />
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Work email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.fieldLabel}>Role</Text>
          <View style={styles.row}>
            {roles.map((item) => (
              <Chip
                key={item}
                label={humanize(item)}
                active={role === item}
                onPress={() => setRole(item)}
              />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Department</Text>
          <View style={styles.row}>
            <Chip
              label="No department"
              active={!departmentId}
              onPress={() => setDepartmentId(null)}
            />
            {departments.map((department) => (
              <Chip
                key={department.id}
                label={department.label}
                active={departmentId === department.id}
                onPress={() => setDepartmentId(department.id)}
              />
            ))}
          </View>
          <PrimaryButton
            label="Send secure invitation"
            disabled={!online || busy || !name.trim() || !email.trim()}
            onPress={async () => {
              const complete = await act({
                action: "INVITE_USER",
                name,
                email,
                role,
                departmentId,
              });
              if (complete) {
                setName("");
                setEmail("");
                setRole("EMPLOYEE");
                setDepartmentId(null);
              }
            }}
          />
          <Text style={styles.help}>
            Activation links expire after 72 hours. The token is sent by email
            and is never returned to this device.
          </Text>
          {workspace.tenantInvitations.map((invitation) => (
            <Card key={invitation.id}>
              <Text style={styles.itemTitle}>{invitation.name}</Text>
              <Text style={styles.small}>{invitation.email}</Text>
              <Text style={styles.small}>
                {humanize(invitation.role)} · expires{" "}
                {formatDate(invitation.expiresAt)}
              </Text>
            </Card>
          ))}
        </Section>
      ) : (
        <Section title="Tenant directory">
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search users, roles, or departments"
          />
          {users.map((user) => (
            <Pressable key={user.id} onPress={() => selectUser(user)}>
              <Card danger={!user.isActive}>
                <View style={styles.titleRow}>
                  <View style={styles.grow}>
                    <Text style={styles.itemTitle}>{user.name}</Text>
                    <Text style={styles.small}>{user.email}</Text>
                  </View>
                  <Status value={humanize(user.role)} />
                </View>
                <Text style={styles.small}>
                  {user.department
                    ? `${user.department.site.name} — ${user.department.name}`
                    : "No department"}{" "}
                  · {user.isActive ? "Active" : "Suspended"}
                </Text>
              </Card>
            </Pressable>
          ))}
          {!users.length ? <Empty text="No users match this view." /> : null}
        </Section>
      )}
    </>
  );
}

function WorkflowWorkspace({
  workspace,
  online,
  busy,
  act,
}: Props & {
  busy: boolean;
  act: (payload: AdminAction) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"templates" | "instances">("templates");
  return (
    <>
      <View style={styles.row}>
        <Chip
          label="Templates"
          active={mode === "templates"}
          onPress={() => setMode("templates")}
        />
        <Chip
          label="Live instances"
          active={mode === "instances"}
          onPress={() => setMode("instances")}
        />
      </View>
      {mode === "templates" ? (
        <Section title="Workflow templates">
          {workspace.tenantWorkflowTemplates.map((template) => (
            <Card key={template.id} accent={template.isActive}>
              <View style={styles.titleRow}>
                <View style={styles.grow}>
                  <Text style={styles.cardTitle}>{template.name}</Text>
                  <Text style={styles.small}>
                    {humanize(template.entityType)} · {template.steps.length}{" "}
                    steps · {template._count.instances} instances
                  </Text>
                </View>
                <Status value={template.isActive ? "ACTIVE" : "PAUSED"} />
              </View>
              {template.steps.map((step) => (
                <Text key={step.id} style={styles.small}>
                  {step.sequence}. {step.name} · {humanize(step.stepType)}
                  {step.requiredRole
                    ? ` · ${humanize(step.requiredRole)}`
                    : ""}
                  {step.slaHours !== null ? ` · ${step.slaHours}h SLA` : ""}
                </Text>
              ))}
              <SecondaryButton
                label={template.isActive ? "Pause workflow" : "Activate workflow"}
                disabled={!online || busy}
                onPress={() =>
                  void act({
                    action: "SET_WORKFLOW_ACTIVE",
                    workflowId: template.id,
                    active: !template.isActive,
                  })
                }
              />
            </Card>
          ))}
          {!workspace.tenantWorkflowTemplates.length ? (
            <Empty text="No workflow templates are configured." />
          ) : null}
        </Section>
      ) : (
        <Section title="Recent workflow instances">
          {workspace.tenantWorkflowInstances.map((instance) => {
            const current = instance.steps[0];
            const overdue =
              current?.dueAt && new Date(current.dueAt).getTime() < Date.now();
            return (
              <Card key={instance.id} danger={Boolean(overdue)}>
                <View style={styles.titleRow}>
                  <View style={styles.grow}>
                    <Text style={styles.itemTitle}>
                      {instance.template.name}
                    </Text>
                    <Text style={styles.small}>
                      {humanize(instance.entityType)} · {instance.entityId}
                    </Text>
                  </View>
                  <Status value={overdue ? "OVERDUE" : instance.status} />
                </View>
                <Text style={styles.small}>
                  {current
                    ? `${current.name} · ${
                        current.assignedUser?.name ??
                        (current.assignedRole
                          ? humanize(current.assignedRole)
                          : "Unassigned")
                      }`
                    : "No active step"}
                </Text>
                {current?.dueAt ? (
                  <Text style={styles.due}>Due {formatDate(current.dueAt)}</Text>
                ) : null}
              </Card>
            );
          })}
          {!workspace.tenantWorkflowInstances.length ? (
            <Empty text="No recent workflow instances were found." />
          ) : null}
        </Section>
      )}
    </>
  );
}

function DeviceWorkspace({
  workspace,
  online,
  busy,
  act,
}: Props & {
  busy: boolean;
  act: (payload: AdminAction) => Promise<boolean>;
}) {
  return (
    <Section title="Active mobile devices">
      <Text style={styles.help}>
        Revoke a device immediately if it is lost, replaced, or no longer
        authorized. Revocation also disables its push tokens.
      </Text>
      {workspace.tenantMobileSessions.map((session) => (
        <Card key={session.id}>
          <View style={styles.titleRow}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>{session.deviceName}</Text>
              <Text style={styles.small}>
                {session.user.name} · {session.user.email}
              </Text>
            </View>
            <Status value={session.platform} />
          </View>
          <Text style={styles.small}>
            Last used:{" "}
            {session.lastUsedAt
              ? formatDate(session.lastUsedAt)
              : "Not refreshed"}{" "}
            · Push {session._count.pushTokens ? "enabled" : "not enabled"}
          </Text>
          <DangerButton
            label="Revoke device"
            disabled={!online || busy}
            onPress={() =>
              void act({
                action: "REVOKE_MOBILE_SESSION",
                sessionId: session.id,
              })
            }
          />
        </Card>
      ))}
      {!workspace.tenantMobileSessions.length ? (
        <Empty text="No active native mobile devices are registered." />
      ) : null}
    </Section>
  );
}

function ConfigurationWorkspace({ workspace }: Props) {
  const capabilities = workspace.tenantAdministrationCapabilities;
  const health = workspace.tenantConfigurationHealth;
  return (
    <Section title="Configuration health">
      <Text style={styles.help}>
        A sanitized readiness view for tenant form and integration
        administration. Counts are available offline in the encrypted,
        owner-scoped workspace snapshot.
      </Text>
      <View style={styles.metricGrid}>
        {capabilities.canViewConfigurationHealth ? (
          <>
            <Metric label="Active forms" value={health.activeForms} />
            <Metric
              label="Published versions"
              value={health.publishedVersions}
            />
            <Metric label="Draft versions" value={health.draftVersions} />
          </>
        ) : null}
        {capabilities.canViewIntegrationHealth ? (
          <>
            <Metric
              label="API credentials"
              value={health.activeApiCredentials}
            />
            <Metric label="Active webhooks" value={health.activeWebhooks} />
            <Metric
              label="Failed deliveries"
              value={health.failedWebhookDeliveries}
            />
          </>
        ) : null}
      </View>
      <Card>
        <Text style={styles.cardTitle}>Protected configuration boundary</Text>
        <Text style={styles.muted}>
          Form design, API tokens, webhook destinations, signing secrets,
          identity-provider credentials, and production configuration remain
          in their protected web administration workspaces.
        </Text>
      </Card>
    </Section>
  );
}

function ActivityWorkspace({ workspace }: Props) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const records = useMemo(
    () =>
      workspace.tenantActivityLogs.filter(
        (record) =>
          !normalized ||
          `${record.title} ${record.description ?? ""} ${record.entityType} ${
            record.user?.name ?? ""
          }`
            .toLowerCase()
            .includes(normalized)
      ),
    [workspace.tenantActivityLogs, normalized]
  );
  return (
    <Section title="Accountable tenant activity">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search activity"
      />
      {records.map((record) => (
        <Card key={record.id}>
          <View style={styles.titleRow}>
            <View style={styles.grow}>
              <Text style={styles.itemTitle}>{record.title}</Text>
              <Text style={styles.small}>
                {record.user?.name ?? "System"} ·{" "}
                {humanize(record.entityType)}
              </Text>
            </View>
            <Status value={record.action} />
          </View>
          {record.description ? (
            <Text style={styles.muted}>{record.description}</Text>
          ) : null}
          <Text style={styles.due}>{formatDate(record.createdAt)}</Text>
        </Card>
      ))}
      {!records.length ? <Empty text="No activity matches this view." /> : null}
    </Section>
  );
}

function availableViews(workspace: MobileBootstrap) {
  const capabilities = workspace.tenantAdministrationCapabilities;
  return [
    ...(capabilities.canManageOrganization
      ? (["organization"] as const)
      : []),
    ...(capabilities.canViewUsers ? (["users"] as const) : []),
    ...(capabilities.canManageUsers ? (["devices"] as const) : []),
    ...(capabilities.canManageWorkflows ? (["workflows"] as const) : []),
    ...(capabilities.canViewConfigurationHealth ||
    capabilities.canViewIntegrationHealth
      ? (["configuration"] as const)
      : []),
    ...(capabilities.canViewActivity ? (["activity"] as const) : []),
  ];
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
      <View style={styles.grow}>
        <Text style={styles.eyebrow}>ADMINISTRATION</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <TinyButton label="Back" onPress={onBack} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Card({
  children,
  accent = false,
  danger = false,
}: {
  children: ReactNode;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        accent && styles.cardAccent,
        danger && styles.cardDanger,
      ]}
    >
      {children}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Banner({ text, warning }: { text: string; warning: boolean }) {
  return (
    <View style={[styles.banner, warning && styles.bannerWarning]}>
      <Text style={[styles.bannerText, warning && styles.bannerWarningText]}>
        {text}
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
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Status({ value }: { value: string }) {
  return (
    <View style={styles.status}>
      <Text style={styles.statusText}>{humanize(value)}</Text>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#64748b"
      style={[styles.input, props.style]}
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
      style={[styles.primary, disabled && styles.disabled]}
    >
      <Text style={styles.primaryText}>{label}</Text>
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
      style={[styles.secondary, disabled && styles.disabled]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function DangerButton({
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
      style={[styles.dangerButton, disabled && styles.disabled]}
    >
      <Text style={styles.dangerText}>{label}</Text>
    </Pressable>
  );
}

function TinyButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tinyButton}>
      <Text style={styles.tinyButtonText}>{label}</Text>
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

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#07111f" },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "800", marginTop: 3 },
  caption: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  banner: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#155e75",
    backgroundColor: "#08334477",
    padding: 13,
  },
  bannerWarning: { borderColor: "#92400e", backgroundColor: "#78350f44" },
  bannerText: { color: "#a5f3fc", fontSize: 12, lineHeight: 18 },
  bannerWarningText: { color: "#fde68a" },
  tabs: { gap: 8, paddingVertical: 2 },
  section: { gap: 11, marginTop: 4 },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 4,
  },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    width: "48%",
    minHeight: 94,
    borderRadius: 17,
    padding: 15,
    justifyContent: "space-between",
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#172a43",
  },
  metricValue: { color: "#f8fafc", fontSize: 28, fontWeight: "800" },
  metricLabel: { color: "#94a3b8", fontSize: 12 },
  card: {
    borderRadius: 17,
    padding: 16,
    gap: 8,
    backgroundColor: "#0d1a2c",
    borderWidth: 1,
    borderColor: "#172a43",
  },
  cardAccent: { borderColor: "#22d3ee" },
  cardDanger: { borderColor: "#fb718566" },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  itemTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  muted: { color: "#94a3b8", fontSize: 13, lineHeight: 19 },
  small: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  help: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  due: { color: "#67e8f9", fontSize: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inline: { flexDirection: "row", alignItems: "center", gap: 9 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 10,
  },
  grow: { flex: 1 },
  fieldLabel: { color: "#dbeafe", fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#263a55",
    backgroundColor: "#091525",
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
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
  status: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22d3ee55",
    backgroundColor: "#164e6333",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: { color: "#a5f3fc", fontSize: 10, fontWeight: "800" },
  primary: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#67e8f9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { color: "#07111f", fontSize: 14, fontWeight: "800" },
  secondary: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#2d4964",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  secondaryText: { color: "#bae6fd", fontSize: 13, fontWeight: "700" },
  dangerButton: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#fb718566",
    backgroundColor: "#88133722",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  dangerText: { color: "#fda4af", fontSize: 13, fontWeight: "800" },
  tinyButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2d4964",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tinyButtonText: { color: "#bae6fd", fontSize: 11, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  empty: {
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
    borderRadius: 17,
    padding: 22,
  },
});
