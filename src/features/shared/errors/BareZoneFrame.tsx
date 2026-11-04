import { getTranslations } from "next-intl/server";

import { Wordmark } from "@/ui/brand";

/**
 * The frame of a staff or admin error page for a visitor who is not signed in (no console column to stand in): the
 * wordmark linking to the zone's start, one `<main>` — the same calm top row as the sign-in pages.
 */
export async function BareZoneFrame({ homeHref, children }: { homeHref: string; children: React.ReactNode }) {
  const t = await getTranslations("shell");
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t("skipToContent")}
      </a>
      <header className="border-border bg-surface flex h-14 items-center border-b px-4 sm:px-6">
        <a href={homeHref} aria-label={t("home")} className="rounded-control inline-flex items-center">
          <Wordmark size="sm" decorative />
        </a>
      </header>
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
    </div>
  );
}
