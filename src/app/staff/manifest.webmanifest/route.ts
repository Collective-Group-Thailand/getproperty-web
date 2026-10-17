import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { isLocale, LOCALE_COOKIE } from "@/i18n/routing";

/** The staff host's web app manifest (installable PWA, F1 1.3 §5), in the staff member's language. */
export async function GET() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : "th";
  const t = await getTranslations({ locale, namespace: "staff.shell.manifest" });
  const manifest = {
    id: "/",
    name: t("name"),
    short_name: t("shortName"),
    description: t("description"),
    lang: locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f6f2",
    theme_color: "#1f7a66",
    icons: [
      { src: "/pwa/staff-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/staff-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/staff-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
