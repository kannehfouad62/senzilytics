import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || !session.user.sessionValid) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
