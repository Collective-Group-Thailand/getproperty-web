import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import type { Zone } from "@/lib/zones";
import { fontClassNames } from "@/ui/fonts";
import { ThemeProvider } from "@/ui/theme/ThemeProvider";
import { readThemeChoice } from "@/ui/theme/server";
import { dataThemeAttribute } from "@/ui/theme/themes";

import "@/app/globals.css";

/**
 * The `<html>` every zone's root layout renders (00-master-plan.md §2: separate root layouts, no
 * `src/app/layout.tsx`). It stamps what must be there before the first paint — `lang`, `data-theme`
 * from the `gp_theme` cookie (ADR-0003), `data-zone` for the density rules, the font variables — and
 * mounts the providers every page needs (next-intl, theme). Console layouts add `ConsoleProviders`
 * (TanStack Query, tooltips, toasts) themselves — never imported here, because a client component a
 * root layout imports ships with every page of the zone, including the owner host's public pages.
 * Zone-specific chrome (nav, auth, PWA manifest) is the page tree's job.
 */
export async function ZoneDocument({ zone, children }: { zone: Zone; children: React.ReactNode }) {
  const [locale, choice] = await Promise.all([getLocale(), readThemeChoice(zone)]);
  const theme = dataThemeAttribute(choice);

  return (
    <html lang={locale} data-theme={theme} data-zone={zone} className={fontClassNames} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider initialChoice={choice} zone={zone}>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

/** Metadata shared by every zone: nothing is indexed except the owner marketing pages, which opt in. */
export async function zoneMetadata(zone: Zone) {
  const t = await getTranslations("shell.zoneName");
  return {
    title: { default: `getproperty · ${t(zone)}`, template: "%s · getproperty" },
    robots: { index: false, follow: false },
  };
}
