import { getTranslations } from "next-intl/server";

import { VIEWING_ACCESS_STATUS, VIEWING_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconResident } from "@/ui/icons/glyphs/resident";
import { cn } from "@/ui/lib/cn";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";
import { attention, bangkokDay, byDay, selfViewingRules, viewingWeek, type Attention } from "./selfViewing";

type Viewing = Schemas["OwnerViewingDto"];
const HIDDEN = new Set<Viewing["state"]>(["declined", "cancelled"]);

/**
 * The viewing calendar (G7, D-295 on B7.3): one week, Monday to Sunday in Bangkok time, every viewing of every
 * listing with who comes, whether someone shows the unit or the visitor lets themself in with a time-boxed code, and
 * the code window's state. Self viewings that need the owner now (an incident, a visitor still inside after the
 * window) are listed first. Each row opens its enquiry, where the viewing is confirmed, the entry log read and the
 * access ended.
 */
export async function ViewingCalendarView({ context, week: weekParam }: { context: OwnerContext; week?: string }) {
  const t = await getTranslations("owner.viewings.calendar");
  const m = await getTranslations("owner.viewings");
  const { api, locale } = context;
  const now = currentTime();
  const week = viewingWeek(weekParam, now);
  const [viewings, settings] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/listing-viewings", { params: { query: { from: week.from, to: week.to } } }))),
    section(unwrap(api.GET("/v1/owner/settings"))),
  ]);
  const rules = selfViewingRules(settings.data);
  const shown = (viewings.data ?? []).filter((viewing) => !HIDDEN.has(viewing.state));
  const grouped = byDay(shown, week.days);
  const urgent = shown
    .map((viewing) => ({ viewing, need: attention(viewing.access, now) }))
    .filter((row): row is { viewing: Viewing; need: Exclude<Attention, null> } => row.need !== null);
  const today = bangkokDay(now);
  const base = ownerPath(locale, "/leads/viewings");
  const selfCount = shown.filter((viewing) => viewing.mode === "self").length;
  const range = `${formatDate(`${week.days[0]}T12:00:00+07:00`, locale, { style: "dayMonth" })} – ${formatDate(
    `${week.days[6]}T12:00:00+07:00`,
    locale,
  )}`;

  return (
    <OwnerPage testId="viewing-calendar">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: m("crumb"), href: ownerPath(locale, "/leads") }, { label: t("title") }]}
      />

      {!rules.enabled ? (
        <Callout tone="neutral" icon={IconKey} title={m("availability.offTitle")}>
          <span data-testid="calendar-self-off">{m("availability.offBody")}</span>
        </Callout>
      ) : null}

      {urgent.length ? (
        <Callout tone="danger" title={t("urgentTitle", { count: urgent.length })}>
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="calendar-urgent">
            {urgent.map(({ viewing, need }) => (
              <li key={viewing.id}>
                <a
                  className="font-medium underline-offset-4 hover:underline"
                  href={ownerPath(locale, `/leads/${viewing.leadId}`)}
                >
                  {t(`urgent.${need}`, {
                    name: viewing.prospectName,
                    listing: viewing.listing.title,
                    time: formatTime(viewing.startsAt, locale),
                  })}
                </a>
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <nav
        aria-label={t("weekNav")}
        className="flex flex-wrap items-center justify-between gap-3"
        data-testid="calendar-week"
        data-week={week.start}
      >
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" iconStart={IconChevronLeft}>
            <a href={`${base}?week=${week.previous}`} data-testid="calendar-previous">
              {t("previous")}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={base} data-testid="calendar-today">
              {t("thisWeek")}
            </a>
          </Button>
          <Button asChild variant="secondary" size="sm" iconEnd={IconChevronRight}>
            <a href={`${base}?week=${week.next}`} data-testid="calendar-next">
              {t("next")}
            </a>
          </Button>
        </div>
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{range}</span>
          <span className="text-muted">{t("counts", { total: shown.length, self: selfCount })}</span>
        </p>
      </nav>

      {!viewings.data ? (
        <SectionError error={viewings.error} />
      ) : shown.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={IconCalendar}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/listings")}>{t("empty.action")}</a>
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <ol className="divide-border m-0 list-none divide-y p-0" data-testid="calendar-days">
            {week.days.map((day) => {
              const rows = grouped.get(day) ?? [];
              const isToday = day === today;
              return (
                <li
                  key={day}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[9rem_1fr] md:gap-4 md:px-5"
                  data-testid="calendar-day"
                  data-day={day}
                >
                  <p
                    className={cn(
                      "m-0 flex items-baseline gap-2 text-sm md:flex-col md:gap-0",
                      isToday && "text-primary",
                    )}
                  >
                    <span className="font-semibold">
                      {formatDate(`${day}T12:00:00+07:00`, locale, { style: "dayMonth" })}
                    </span>
                    <span className={cn("text-xs", isToday ? "font-semibold" : "text-muted")}>
                      {isToday ? t("today") : weekdayName(day, locale)}
                    </span>
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-muted m-0 self-center text-sm">{t("none")}</p>
                  ) : (
                    <ul className="m-0 grid list-none gap-2 p-0 xl:grid-cols-2">
                      {rows.map((viewing) => (
                        <CalendarRow key={viewing.id} viewing={viewing} locale={locale} now={now} />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </OwnerPage>
  );
}

function weekdayName(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

async function CalendarRow({ viewing, locale, now }: { viewing: Viewing; locale: Locale; now: number }) {
  const m = await getTranslations("owner.viewings");
  const need = attention(viewing.access, now);
  return (
    <li data-testid="calendar-viewing" data-mode={viewing.mode} data-state={viewing.state}>
      <a
        href={ownerPath(locale, `/leads/${viewing.leadId}`)}
        className={cn(
          "rounded-card border-border hover:bg-bg-subtle focus-visible:ring-focus flex h-full items-start gap-3 border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none",
          need === "incident" || need === "overstay" ? "border-border-strong bg-bg-subtle" : null,
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            viewing.mode === "self" ? "bg-primary-subtle text-primary-subtle-fg" : "bg-bg-subtle text-fg",
          )}
        >
          <Icon icon={viewing.mode === "self" ? IconKey : IconResident} label={m(`mode.${viewing.mode}`)} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold tabular-nums">
            {formatTime(viewing.startsAt, locale)}–{formatTime(viewing.endsAt, locale)}
          </span>
          <span className="truncate text-sm">{viewing.prospectName}</span>
          <span className="text-muted truncate text-xs">{viewing.listing.title}</span>
          <span className="flex flex-wrap items-center gap-1">
            <Badge tone={viewing.mode === "self" ? "primary" : "neutral"} size="sm">
              {m(`mode.${viewing.mode}`)}
            </Badge>
            <StatusBadgeOf map={VIEWING_STATUS} value={viewing.state} size="sm" />
            {viewing.access ? (
              <StatusBadgeOf map={VIEWING_ACCESS_STATUS} value={viewing.access.state} size="sm" />
            ) : null}
            {need === "incident" || need === "overstay" ? (
              <Badge tone="danger" size="sm" icon={IconAlert}>
                {m(`attention.${need}`)}
              </Badge>
            ) : null}
          </span>
        </span>
      </a>
    </li>
  );
}
