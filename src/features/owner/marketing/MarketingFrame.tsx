import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Wordmark } from "@/ui/brand";

import { MarketingNav } from "./MarketingNav";
import { lineOaHref } from "./seo";

/** The public pages' frame (public site, or the owner host): header with pricing and sign-in, footer with the legal pages. */
export async function MarketingFrame({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = await getTranslations("owner.marketing");
  const shell = await getTranslations("shell");
  const href = (path: string) => getPathname({ href: path, locale });
  const line = lineOaHref();
  const link = (path: string, key: string) => ({ href: href(path), label: t(`nav.${key}`), external: false });
  const columns = [
    {
      key: "owners",
      links: [
        link("/", "apartments"),
        link("/landlords", "owners"),
        link("/pricing", "pricing"),
        ...(line ? [{ href: line, label: t("nav.contact"), external: true }] : []),
      ],
    },
    { key: "renters", links: [link("/rent", "rent"), link("/foreign-renters", "foreignRenters")] },
    { key: "resources", links: [link("/guides", "guides"), link("/tools", "tools"), link("/help", "help")] },
    {
      key: "company",
      links: [link("/about", "about"), link("/contact", "contactPage"), link("/security", "security")],
    },
  ];
  const legal = ["terms", "privacy", "pdpa", "dpa"] as const;
  return (
    <div data-type-scale="marketing" className="bg-bg print:bg-surface flex min-h-dvh flex-col">
      <a href="#main" className="skip-link print:hidden">
        {shell("skipToContent")}
      </a>
      <MarketingNav locale={locale} />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <footer className="border-fg mt-10 border-t-2 print:hidden">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-12">
          <div className="flex flex-col gap-4 md:col-span-4">
            <Wordmark size="md" decorative />
            <p className="font-display max-w-sm text-lg font-medium">{t("footer.tagline")}</p>
            <p className="text-muted text-sm">{t("footer.company")}</p>
          </div>
          {columns.map((column) => (
            <nav key={column.key} aria-label={t(`footer.columns.${column.key}`)} className="text-sm md:col-span-2">
              <p className="text-muted mb-3 font-semibold">{t(`footer.columns.${column.key}`)}</p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      className="hover:text-primary"
                      href={link.href}
                      {...(link.external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-border text-muted mx-auto flex max-w-7xl flex-wrap justify-between gap-x-6 gap-y-2 border-t px-4 py-5 text-xs">
          <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {legal.map((doc) => (
              <li key={doc}>
                <a className="hover:text-fg" href={href(`/legal/${doc}`)}>
                  {t(`legal.docs.${doc}.title`)}
                </a>
              </li>
            ))}
          </ul>
          <p>{t("footer.photos")}</p>
        </div>
      </footer>
    </div>
  );
}
