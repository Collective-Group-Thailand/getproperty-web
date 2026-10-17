import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/features/shared/shell/SignOutButton";
import type { Schemas } from "@/lib/api/types";
import { Wordmark } from "@/ui/brand";
import { AppShell, TopBar } from "@/ui/components/AppShell";

/** The admin console frame (F1 1.2: who is signed in; navigation and command palette in 1.3). */
export async function AdminShell({ me, children }: { me: Schemas["AdminMeDto"]; children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <AppShell
      skipLabel={t("shell.skipToContent")}
      header={
        <TopBar>
          <Wordmark size="sm" />
          <span className="truncate text-sm font-semibold" data-testid="platform-user">
            {me.user.displayName}
          </span>
          <span className="text-muted hidden text-xs sm:inline" data-testid="platform-roles">
            {me.roles.map((role) => t(`glossary.platformRole.${role}`)).join(", ")}
          </span>
          <span className="ms-auto">
            <SignOutButton loginHref="/login" />
          </span>
        </TopBar>
      }
    >
      {children}
    </AppShell>
  );
}
