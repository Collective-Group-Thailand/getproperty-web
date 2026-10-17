import { setRequestLocale } from "next-intl/server";

import { OwnerShell } from "@/features/owner/shell/OwnerShell";
import { ConsoleProviders } from "@/features/shared/providers/ConsoleProviders";
import { requireOperator } from "@/lib/auth/guards";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** The owner console: signed in on the owner host, working in one tenant (F1 1.2 guard). */
export default async function OwnerConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireOperator("owner", {
    login: getPathname({ href: "/login", locale }),
    selectTenant: getPathname({ href: "/select-tenant", locale }),
  });
  return (
    <ConsoleProviders>
      <OwnerShell me={actor.me} locale={locale}>
        {children}
      </OwnerShell>
    </ConsoleProviders>
  );
}
