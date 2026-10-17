import { getTranslations } from "next-intl/server";

import { ReadOnlyProvider } from "@/features/shared/providers/ReadOnlyProvider";
import { ReadOnlyBanner } from "@/features/shared/shell/ReadOnlyBanner";
import { SessionSummary } from "@/features/shared/shell/SessionSummary";
import { SignOutButton } from "@/features/shared/shell/SignOutButton";
import type { Schemas } from "@/lib/api/types";
import { Wordmark } from "@/ui/brand";
import { AppShell, TopBar } from "@/ui/components/AppShell";

/** The staff PWA frame (F1 1.2: session header + read-only mode; bottom nav and offline in 1.3). */
export async function StaffShell({
  me,
  children,
}: {
  me: Schemas["OperatorMeDto"] & { currentTenant: Schemas["CurrentTenantDto"] };
  children: React.ReactNode;
}) {
  const t = await getTranslations("shell");
  const readOnly = me.subscription?.readOnly ?? false;
  return (
    <ReadOnlyProvider initial={readOnly}>
      <AppShell
        variant="mobile"
        skipLabel={t("skipToContent")}
        header={
          <TopBar>
            <Wordmark size="sm" />
            <SessionSummary zone="staff" me={me} />
            <span className="ms-auto">
              <SignOutButton loginHref="/login" />
            </span>
          </TopBar>
        }
      >
        {readOnly ? <ReadOnlyBanner /> : null}
        {children}
      </AppShell>
    </ReadOnlyProvider>
  );
}
