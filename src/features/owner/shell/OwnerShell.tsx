import { getTranslations } from "next-intl/server";

import { ReadOnlyProvider } from "@/features/shared/providers/ReadOnlyProvider";
import { ReadOnlyBanner } from "@/features/shared/shell/ReadOnlyBanner";
import { SessionSummary } from "@/features/shared/shell/SessionSummary";
import { SignOutButton } from "@/features/shared/shell/SignOutButton";
import type { Schemas } from "@/lib/api/types";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Wordmark } from "@/ui/brand";
import { AppShell, TopBar } from "@/ui/components/AppShell";

/** The owner console frame (F1 1.2: session header + read-only mode; navigation arrives in 1.3). */
export async function OwnerShell({
  me,
  locale,
  children,
}: {
  me: Schemas["OperatorMeDto"] & { currentTenant: Schemas["CurrentTenantDto"] };
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = await getTranslations("shell");
  const readOnly = me.subscription?.readOnly ?? false;
  return (
    <ReadOnlyProvider initial={readOnly}>
      <AppShell
        skipLabel={t("skipToContent")}
        header={
          <TopBar>
            <Wordmark size="sm" />
            <SessionSummary zone="owner" me={me} />
            <span className="ms-auto">
              <SignOutButton loginHref={getPathname({ href: "/login", locale })} />
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
