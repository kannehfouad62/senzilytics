import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import { Cable, FileCode2, KeyRound, RadioTower, ShieldCheck } from "lucide-react";
import { IntegrationWorkspace } from "@/features/integrations/integration-workspace";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { listIntegrationWorkspaceService } from "@/modules/integrations/integration.service";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { organizationId } = await getCurrentUserTenant();
  const workspace = await listIntegrationWorkspaceService(organizationId);
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><Cable size={18} />Enterprise Integrations Hub</p><h1 className="mt-2 text-4xl font-bold">Connect governed EHS data</h1><p className="mt-2 max-w-3xl text-slate-400">Issue scoped API credentials, deliver signed operational events, and monitor every external exchange without weakening tenant isolation.</p></div><Link href="/integrations/api-docs" className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-200"><FileCode2 size={17} />Integration guide</Link></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric icon={KeyRound} label="Active API credentials" value={workspace.credentials.filter((item) => item.status === "ACTIVE").length} /><Metric icon={RadioTower} label="Active webhooks" value={workspace.endpoints.filter((item) => item.status === "ACTIVE").length} /><Metric icon={ShieldCheck} label="API requests (24h)" value={workspace.requestCount} /></div><IntegrationWorkspace credentials={workspace.credentials.map((item) => ({ ...item, expiresAt: item.expiresAt?.toISOString() ?? null, lastUsedAt: item.lastUsedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(), requestCount: item._count.requestLogs }))} endpoints={workspace.endpoints.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), rotatedAt: item.rotatedAt?.toISOString() ?? null, deliveryCount: item._count.deliveries }))} deliveries={workspace.deliveries.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), deliveredAt: item.deliveredAt?.toISOString() ?? null }))} /></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof KeyRound; label: string; value: number }) { return <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold text-cyan-200">{value}</p></div><Icon className="text-cyan-300" /></div></div>; }
