import { StaffShell } from "@/features/staff/shell/StaffShell";
import { requireOperator } from "@/lib/auth/guards";

/** The staff PWA: signed in on the staff host, working in one tenant (F1 1.2 guard). */
export default async function StaffConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireOperator("staff", { login: "/login", selectTenant: "/select-tenant" });
  return <StaffShell me={actor.me}>{children}</StaffShell>;
}
