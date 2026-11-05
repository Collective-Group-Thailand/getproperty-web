import { getTranslations } from "next-intl/server";

import { Button } from "@/ui/components/Button";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";

export interface NotFoundLink {
  href: string;
  label: string;
  icon: IconGlyph;
}

/**
 * The not-found page body of every zone (redesign G0 revision): inside the zone's own frame (the marketing header and
 * footer on the public host, the console column for signed-in operators), a thin-line door with its "404" plate, one
 * sentence, the way home (the page's one filled button), an optional second way, and the pages people usually look
 * for — a next step for every kind of visitor instead of a dead end.
 */
export async function ZoneNotFound({
  homeHref,
  homeLabel,
  secondary,
  links = [],
}: {
  homeHref: string;
  /** Replaces "กลับหน้าแรก" (the console: "ไปที่เช้านี้"). */
  homeLabel?: string;
  /** An outlined second way on (the public site: find a room). */
  secondary?: { href: string; label: string };
  /** "Pages people look for": up to four rows. */
  links?: NotFoundLink[];
}) {
  const t = await getTranslations("errors.notFound");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-14 sm:py-20" data-testid="not-found">
      <div className="flex flex-col items-center text-center">
        <DoorIllustration code={t("code")} />
        <h1 className="m-0 mt-8 text-3xl font-semibold text-balance">{t("title")}</h1>
        <p className="text-muted m-0 mt-3 max-w-md text-pretty">{t("body")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <a href={homeHref}>{homeLabel ?? t("home")}</a>
          </Button>
          {secondary ? (
            <Button asChild variant="secondary">
              <a href={secondary.href}>{secondary.label}</a>
            </Button>
          ) : null}
        </div>
      </div>
      {links.length > 0 ? (
        <nav aria-labelledby="not-found-links" className="border-border mt-12 border-t pt-8">
          <h2 id="not-found-links" className="text-muted m-0 mb-3 text-sm font-medium">
            {t("popular")}
          </h2>
          <ul className="bg-surface border-border rounded-card shadow-card divide-border m-0 list-none divide-y border p-0">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="group hover:bg-bg-subtle focus-visible:ring-focus-ring first:rounded-t-card last:rounded-b-card flex min-h-13 items-center gap-3 px-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Icon icon={link.icon} className="text-muted shrink-0 text-lg" />
                  <span className="min-w-0 flex-1 font-medium">{link.label}</span>
                  <Icon icon={IconChevronRight} className="text-subtle group-hover:text-fg shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

/** A door left ajar with a "404" plate: thin navy strokes on the pale tint — decorative. */
function DoorIllustration({ code }: { code: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 120"
      width="96"
      height="120"
      fill="none"
      className="text-primary-subtle-fg"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="6"
        y="6"
        width="84"
        height="108"
        rx="6"
        className="fill-primary-subtle"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M18 18 L60 26 L60 104 L18 110 Z" className="fill-surface" stroke="currentColor" strokeWidth="2" />
      <rect x="29" y="44" width="20" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <text x="39" y="52.5" textAnchor="middle" fontSize="7" fontWeight="600" fill="currentColor" className="font-mono">
        {code}
      </text>
      <circle cx="53" cy="70" r="2" fill="currentColor" />
      <path d="M60 26 L78 18 M60 104 L78 112" stroke="currentColor" strokeWidth="1" opacity="0.35" />
    </svg>
  );
}
