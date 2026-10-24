import en from "@/i18n/messages/en/staff/offline.json";
import th from "@/i18n/messages/th/staff/offline.json";
import { CHIMNEY_GRADIENT, CHIMNEY_PATH, HOUSE_PATH, INK_PATH, WORDMARK_VIEWBOX } from "@/ui/brand/geometry";
import { oklchCss } from "@/ui/tokens/color";
import { THEMES } from "@/ui/tokens/semantic";

/**
 * `/offline` on the staff host: the one page the service worker keeps (review H2). Static and unauthenticated — no
 * session, no user, no tenant, no script — so it can sit in Cache Storage on a shared phone. Shown when a navigation
 * finds no network; it says so in Thai and English (the language cookie is not known offline) and links back to
 * the PWA's start page.
 */
export const dynamic = "force-static";

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** The page's colours come from the design tokens (light and dark), as CSS custom properties. */
function tokenVars(theme: (typeof THEMES)["light"]): string {
  const keys = [
    "bg",
    "fg",
    "muted",
    "primary",
    "primary-fg",
    "logo-ink",
    "logo-house",
    "logo-chimney-top",
    "logo-chimney-bottom",
  ] as const;
  return keys.map((key) => `--${key}: ${oklchCss(theme[key])};`).join(" ");
}

const STYLE = `
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; ${tokenVars(THEMES.light)} }
  @media (prefers-color-scheme: dark) { :root { ${tokenVars(THEMES.dark)} } }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: var(--bg); color: var(--fg); }
  main { max-width: 26rem; padding: 2rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
  h1 { font-size: 1.5rem; margin: 0; } p { margin: 0; line-height: 1.6; } [lang="en"] { color: var(--muted); }
  .logo { display: block; height: 28px; width: auto; margin-bottom: 0.5rem; }
  .logo .i { fill: var(--logo-ink); } .logo .h { fill: var(--logo-house); }
  .logo .t { stop-color: var(--logo-chimney-top); } .logo .b { stop-color: var(--logo-chimney-bottom); }
  a { align-self: flex-start; min-height: 48px; display: inline-flex; align-items: center; padding: 0 1.25rem;
      border-radius: 0.75rem; background: var(--primary); color: var(--primary-fg); font-weight: 600;
      text-decoration: none; }
`;

/** The founder's logo (src/ui/brand/geometry.ts), coloured by the same `logo-*` tokens as `<Wordmark>`. No script. */
const { x1, y1, x2, y2 } = CHIMNEY_GRADIENT;
const LOGO = `<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK_VIEWBOX}" role="img" aria-label="getproperty">\
<defs><linearGradient id="gp-chimney" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">\
<stop offset="0" class="t"/><stop offset="1" class="b"/></linearGradient></defs>\
<path class="i" fill-rule="evenodd" d="${INK_PATH}"/><path class="h" fill-rule="evenodd" d="${HOUSE_PATH}"/>\
<path fill="url(#gp-chimney)" fill-rule="evenodd" d="${CHIMNEY_PATH}"/></svg>`;

export function GET() {
  const body = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(th.offlinePageTitle)} · getproperty</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${LOGO}
<h1>${escape(th.offlinePageTitle)}</h1>
<p>${escape(th.offlinePageBody)}</p>
<p lang="en">${escape(en.offlinePageTitle)}. ${escape(en.offlinePageBody)}</p>
<a href="/">${escape(th.offlinePageRetry)} · <span lang="en">${escape(en.offlinePageRetry)}</span></a>
</main>
</body>
</html>`;
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" },
  });
}
