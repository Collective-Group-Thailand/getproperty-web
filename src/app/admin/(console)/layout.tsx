import { AdminShell } from "@/features/admin/shell/AdminShell";
import { requirePlatform } from "@/lib/auth/guards";

/** The platform admin console: a platform session on the admin host (F1 1.2 guard). */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatform("/login");
  return <AdminShell me={actor.me}>{children}</AdminShell>;
}
