import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import type { Zone } from "@/lib/zones";
import { fontClassNames } from "@/ui/fonts";
import { TooltipProvider } from "@/ui/components/Tooltip";
import { Toaster } from "@/ui/components/Toast";
import { ThemeProvider } from "@/ui/theme/ThemeProvider";
import { readThemeChoice } from "@/ui/theme/server";
import { dataThemeAttribute } from "@/ui/theme/themes";

import { QueryProvider } from "../providers/QueryProvider";

import "@/app/globals.css";

/**
 * The `<html>` every zone's root layout renders (00-master-plan.md §2: separate root layouts, no
 * `src/app/layout.tsx`). It stamps what must be there before the first paint — `lang`, `data-theme`
 * from the `gp_theme` cookie (ADR-0003), `data-zone` for the density rules, the font variables — and
 * mounts the providers (next-intl, theme, TanStack Query, tooltips, toasts). Zone-specific chrome (nav,
 * auth, PWA manifest) is the page tree's job.
 */
export async function ZoneDocument({ zone, children }: { zone: Zone; children: React.ReactNode }) {
  const [locale, choice] = await Promise.all([getLocale(), readThemeChoice(zone)]);
  const theme = dataThemeAttribute(choice);

  return (
    <html lang={locale} data-theme={theme} data-zone={zone} className={fontClassNames} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider initialChoice={choice} zone={zone}>
            <QueryProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

/** Metadata shared by every zone: no zone is indexed in F0 (the owner marketing pages opt in later). */
export async function zoneMetadata(zone: Zone) {
  const t = await getTranslations("shell.placeholder");
  return {
    title: { default: t("title", { zone: t(`zone.${zone}`) }), template: "%s · getproperty" },
    robots: { index: false, follow: false },
  };
}
