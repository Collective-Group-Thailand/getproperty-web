import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import { PATH_HEADER } from "@/lib/auth/guards-shared";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Wordmark } from "@/ui/brand";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconMenu } from "@/ui/icons/glyphs/menu";

import { MarketingLanguageLink } from "./MarketingLanguageLink";
import { ownerHref } from "./seo";

const LINKS = [
  { key: "rent", path: "/rent", match: (p: string) => p === "/rent" || p.startsWith("/rent/") },
  { key: "apartments", path: "/", match: (p: string) => p === "/" },
  { key: "owners", path: "/landlords", match: (p: string) => p === "/landlords" },
  { key: "pricing", path: "/pricing", match: (p: string) => p === "/pricing" },
] as const;

/**
 * The public header (redesign 2026-10-24): the wordmark, four destinations in the middle — find a home, for
 * dormitories, for owners, pricing — with the current one underlined, and on the right the language, sign-in and
 * the one call to action. On a phone the destinations fold into a disclosure menu (`<details>`, no JS).
 */
export async function MarketingNav({ locale }: { locale: Locale }) {
  const t = await getTranslations("owner.marketing");
  const path = ((await headers()).get(PATH_HEADER) ?? "/").split("?")[0]!.replace(/^\/(th|en)(?=\/|$)/, "") || "/";
  const href = (p: string) => getPathname({ href: p, locale });
  const signIn = ownerHref("/login", locale);
  // Sign-up is the sign-in (phone, Google, Apple or LINE, D-255): the call to action starts an owner account,
  // worded for the page — "list for free" where the visitor is a renter or a house/condo owner, else "start free".
  const listing = path === "/landlords" || path === "/rent" || path.startsWith("/rent/");

  return (
    <header className="bg-bg/95 border-border sticky top-0 z-30 border-b backdrop-blur print:hidden">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-6 px-4">
        <a href={href("/")} aria-label={t("nav.home")} className="rounded-control inline-flex shrink-0 items-center">
          <Wordmark size="sm" decorative className="max-[419px]:hidden" />
          <Wordmark compact size="sm" decorative className="min-[420px]:hidden" />
        </a>

        <nav aria-label={t("nav.label")} className="hidden h-full flex-1 justify-center lg:flex">
          <ul className="m-0 flex h-full list-none items-stretch gap-1 p-0">
            {LINKS.map((link) => {
              const current = link.match(path);
              return (
                <li key={link.key} className="flex">
                  <a
                    href={href(link.path)}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center border-b-2 px-3 text-sm font-medium transition-colors ${
                      current ? "border-primary text-fg" : "text-muted hover:text-fg border-transparent"
                    }`}
                  >
                    {t(`nav.${link.key}`)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <MarketingLanguageLink className="text-muted hover:text-fg hidden px-2 text-sm font-medium lg:inline-flex lg:items-center" />
          <a href={signIn} className="text-muted hover:text-fg hidden px-2 text-sm font-medium lg:inline">
            {t("nav.signIn")}
          </a>
          <Button asChild size="sm">
            <a href={signIn}>{listing ? t("nav.list") : t("nav.start")}</a>
          </Button>

          <details className="group relative lg:hidden">
            <summary
              className="hover:bg-bg-subtle rounded-control flex size-10 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden"
              aria-label={t("nav.menu")}
            >
              <Icon icon={IconMenu} className="text-xl" />
            </summary>
            <div className="bg-surface border-border rounded-card shadow-overlay absolute end-0 top-12 w-72 border p-2">
              <nav aria-label={t("nav.label")}>
                <ul className="m-0 flex list-none flex-col p-0">
                  {LINKS.map((link) => (
                    <li key={link.key}>
                      <a
                        href={href(link.path)}
                        aria-current={link.match(path) ? "page" : undefined}
                        className="hover:bg-bg-subtle rounded-control aria-[current=page]:text-primary flex min-h-11 items-center px-3 font-medium"
                      >
                        {t(`nav.${link.key}`)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="border-border mt-2 flex flex-col border-t pt-2">
                <a href={signIn} className="hover:bg-bg-subtle rounded-control flex min-h-11 items-center px-3">
                  {t("nav.signIn")}
                </a>
                <MarketingLanguageLink className="hover:bg-bg-subtle rounded-control flex min-h-11 items-center px-3" />
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
