import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { ZONE_ICONS } from "@/features/shared/shell/ZoneDocument";
import { serverEnv } from "@/lib/env/server";
import { fontClassNames } from "@/ui/fonts";

import "@/app/globals.css";

/**
 * The gate tablet's own `<html>` (JW4): the owner zone's document without what a kiosk never uses — no theme switch
 * (always the light theme, read in sunlight; the guard cannot change it), no console error or not-found boundaries
 * of `[locale]` — so `/gate` stays inside its 180 KB first load (D-179). `data-zone="owner"` keeps the owner tokens;
 * `data-surface="gate"` (set by the frame) raises the type scale.
 */
export async function GateDocument({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const env = serverEnv();
  return (
    <html
      lang={locale}
      data-theme="light"
      data-zone="owner"
      data-sentry-dsn={env.NEXT_PUBLIC_SENTRY_DSN}
      data-env={env.NEXT_PUBLIC_ENV_BADGE}
      className={fontClassNames}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

export async function gateMetadata() {
  const t = await getTranslations("owner.guard");
  return { title: t("brand"), robots: { index: false, follow: false }, icons: ZONE_ICONS };
}
