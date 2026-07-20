import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUserTenant } from "@/lib/tenant";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || !session.user.sessionValid) {
    redirect("/login");
  }

  const { organization } = await getCurrentUserTenant();

  return <AppShell isDemo={organization?.isDemo ?? false}>{children}</AppShell>;
}
