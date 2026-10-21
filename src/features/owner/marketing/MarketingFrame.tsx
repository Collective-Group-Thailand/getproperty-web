import { getTranslations } from "next-intl/server";

import { serverEnv } from "@/lib/env/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Wordmark } from "@/ui/brand";
import { Button } from "@/ui/components/Button";

import { MarketingLanguageLink } from "./MarketingLanguageLink";

/** The public pages' frame (owner host): header with pricing and sign-in, footer with the legal pages. */
export async function MarketingFrame({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = await getTranslations("owner.marketing");
  const shell = await getTranslations("shell");
  const href = (path: string) => getPathname({ href: path, locale });
  const lineOa = serverEnv().NEXT_PUBLIC_LINE_OA_ID;
  const legal = ["terms", "privacy", "pdpa", "dpa"] as const;
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {shell("skipToContent")}
      </a>
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <a href={href("/")} aria-label={t("nav.home")} className="rounded-control inline-flex shrink-0 items-center">
            <Wordmark size="sm" decorative className="max-[419px]:hidden" />
            <Wordmark compact size="sm" decorative className="min-[420px]:hidden" />
          </a>
          <nav aria-label={t("nav.label")} className="ms-auto flex items-center gap-2">
            <a className="hover:text-primary px-2 text-sm font-medium" href={href("/pricing")}>
              {t("nav.pricing")}
            </a>
            <MarketingLanguageLink />
            <Button asChild size="sm">
              <a href={href("/login")}>{t("nav.signIn")}</a>
            </Button>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <footer className="border-border bg-surface border-t">
        <div className="text-muted mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm md:flex-row md:items-center md:justify-between">
          <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <nav aria-label={t("nav.legal")}>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {legal.map((doc) => (
                <li key={doc}>
                  <a className="hover:text-fg underline-offset-4 hover:underline" href={href(`/legal/${doc}`)}>
                    {t(`legal.docs.${doc}.title`)}
                  </a>
                </li>
              ))}
              {lineOa ? (
                <li>
                  <a
                    className="hover:text-fg underline-offset-4 hover:underline"
                    href={`https://line.me/R/ti/p/${encodeURIComponent(lineOa)}`}
                    rel="noopener noreferrer"
                  >
                    {t("nav.contact")}
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
