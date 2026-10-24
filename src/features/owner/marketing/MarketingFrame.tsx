import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Wordmark } from "@/ui/brand";
import { Button } from "@/ui/components/Button";

import { MarketingLanguageLink } from "./MarketingLanguageLink";
import { lineOaHref, ownerHref } from "./seo";

/** The public pages' frame (public site, or the owner host): header with pricing and sign-in, footer with the legal pages. */
export async function MarketingFrame({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = await getTranslations("owner.marketing");
  const shell = await getTranslations("shell");
  const href = (path: string) => getPathname({ href: path, locale });
  const line = lineOaHref();
  const sections = ["how", "features", "faq"] as const;
  const legal = ["terms", "privacy", "pdpa", "dpa"] as const;
  return (
    <div data-type-scale="marketing" className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {shell("skipToContent")}
      </a>
      <header className="border-border bg-bg/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <a href={href("/")} aria-label={t("nav.home")} className="rounded-control inline-flex shrink-0 items-center">
            <Wordmark size="sm" decorative className="max-[419px]:hidden" />
            <Wordmark compact size="sm" decorative className="min-[420px]:hidden" />
          </a>
          <nav aria-label={t("nav.label")} className="ms-auto flex items-center gap-1 md:gap-2">
            <ul className="me-2 hidden items-center gap-1 lg:flex">
              {sections.map((section) => (
                <li key={section}>
                  <a className="hover:text-primary px-2 text-sm font-medium" href={`${href("/")}#${section}`}>
                    {t(`nav.${section}`)}
                  </a>
                </li>
              ))}
            </ul>
            <a className="hover:text-primary px-2 text-sm font-medium max-md:hidden" href={href("/landlords")}>
              {t("nav.landlords")}
            </a>
            <a className="hover:text-primary px-2 text-sm font-medium" href={href("/pricing")}>
              {t("nav.pricing")}
            </a>
            <MarketingLanguageLink />
            {line ? (
              <a
                className="hover:text-primary px-2 text-sm font-medium max-sm:hidden"
                href={ownerHref("/login", locale)}
              >
                {t("nav.signIn")}
              </a>
            ) : null}
            <Button asChild size="sm">
              {line ? (
                <a href={line} rel="noopener noreferrer" target="_blank">
                  {t("nav.start")}
                </a>
              ) : (
                <a href={ownerHref("/login", locale)}>{t("nav.signIn")}</a>
              )}
            </Button>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <footer className="border-fg mt-10 border-t-2">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-12">
          <div className="flex flex-col gap-4 md:col-span-5">
            <Wordmark size="md" decorative />
            <p className="font-display max-w-sm text-lg font-medium">{t("footer.tagline")}</p>
            <p className="text-muted text-sm">{t("footer.company")}</p>
          </div>
          <nav aria-label={t("nav.label")} className="text-sm md:col-span-3">
            <ul className="flex flex-col gap-2">
              <li>
                <a className="hover:text-primary" href={href("/landlords")}>
                  {t("nav.landlords")}
                </a>
              </li>
              <li>
                <a className="hover:text-primary" href={href("/pricing")}>
                  {t("nav.pricing")}
                </a>
              </li>
              {sections.map((section) => (
                <li key={section}>
                  <a className="hover:text-primary" href={`${href("/")}#${section}`}>
                    {t(`nav.${section}`)}
                  </a>
                </li>
              ))}
              {line ? (
                <li>
                  <a className="hover:text-primary" href={line} rel="noopener noreferrer">
                    {t("nav.contact")}
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
          <nav aria-label={t("nav.legal")} className="text-sm md:col-span-4">
            <ul className="flex flex-col gap-2">
              {legal.map((doc) => (
                <li key={doc}>
                  <a className="hover:text-primary" href={href(`/legal/${doc}`)}>
                    {t(`legal.docs.${doc}.title`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="border-border text-muted mx-auto flex max-w-7xl flex-wrap justify-between gap-2 border-t px-4 py-5 text-xs">
          <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <p>{t("footer.photos")}</p>
        </div>
      </footer>
    </div>
  );
}
