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
 * The viewing calendar (G7, D-295 on B7.3; G5 week grid): one week, Monday to Sunday in Bangkok time, as a time grid
 * on desktop and, under it, the week's viewings by day — every viewing of every listing with who comes, whether someone shows the unit or the visitor lets themself in with a time-boxed code, and
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
        <EmptyState
          variant="card"
          icon={IconCalendar}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/listings")}>{t("empty.action")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <WeekGrid days={week.days} today={today} viewings={shown} locale={locale} now={now} />
          <section aria-labelledby="calendar-list" className="flex flex-col gap-3">
            <h2 id="calendar-list" className="text-lg font-semibold">
              {t("listTitle")}
            </h2>
            <Card padding="none">
              <ol className="divide-border m-0 list-none divide-y p-0" data-testid="calendar-days">
                {week.days
                  .filter((day) => (grouped.get(day) ?? []).length > 0)
                  .map((day) => {
                    const rows = grouped.get(day) ?? [];
                    const isToday = day === today;
                    return (
                      <li
                        key={day}
                        className="grid gap-2 px-4 py-3 md:grid-cols-[9rem_1fr] md:gap-4 md:px-5"
                        data-testid="calendar-day"
                        data-day={day}
                      >
                        <p className="m-0 flex items-baseline gap-2 text-sm md:flex-col md:gap-0">
                          <span className={cn("font-semibold", isToday && "text-primary")}>
                            {formatDate(`${day}T12:00:00+07:00`, locale, { style: "dayMonth" })}
                          </span>
                          <span className={cn("text-xs", isToday ? "text-primary font-semibold" : "text-muted")}>
                            {isToday ? t("today") : weekdayName(day, locale)}
                          </span>
                        </p>
                        <ul className="m-0 grid list-none gap-2 p-0 xl:grid-cols-2">
                          {rows.map((viewing) => (
                            <CalendarRow key={viewing.id} viewing={viewing} locale={locale} now={now} />
                          ))}
                        </ul>
                      </li>
                    );
                  })}
              </ol>
            </Card>
          </section>
        </>
      )}
    </OwnerPage>
  );
}

/** Minutes after midnight in Bangkok (UTC+7 all year) of an API instant. */
const bangkokMinutes = (instant: string) => Math.round((Date.parse(instant) / 60_000 + 7 * 60) % (24 * 60));
const HOUR_PX = 56;

/**
 * The week as a time grid (G5): Monday to Sunday in Bangkok time, the hours from 09:00 to 18:00 (wider when a viewing
 * falls outside), today's column tinted, each viewing a pale block sized to its own duration with the person, the
 * listing and its state. Desktop only — phones read the list under it.
 */
function WeekGrid({
  days,
  today,
  viewings,
  locale,
  now,
}: {
  days: string[];
  today: string;
  viewings: Viewing[];
  locale: Locale;
  now: number;
}) {
  const starts = viewings.map((v) => bangkokMinutes(v.startsAt));
  const ends = viewings.map(
    (v) => bangkokMinutes(v.startsAt) + (Date.parse(v.endsAt) - Date.parse(v.startsAt)) / 60_000,
  );
  const first = Math.min(9, ...starts.map((m) => Math.floor(m / 60)));
  const last = Math.max(18, ...ends.map((m) => Math.ceil(m / 60)));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const height = hours.length * HOUR_PX;
  const byDayKey = byDay(viewings, days);
  return (
    <div
      className="rounded-card border-border bg-surface shadow-card hidden overflow-hidden border md:block"
      aria-hidden="true"
      data-testid="calendar-grid"
    >
      <div className="border-border grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b">
        <span />
        {days.map((day) => (
          <span
            key={day}
            className={cn(
              "border-border flex flex-col items-center border-s px-2 py-2.5 text-sm",
              day === today && "bg-primary-subtle text-primary-subtle-fg",
            )}
          >
            <span className="text-xs">{weekdayShort(day, locale)}</span>
            <span className="font-semibold tabular-nums">{Number(day.slice(8, 10))}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height }}>
          {hours.map((hour, i) => (
            <span
              key={hour}
              className="text-muted absolute end-2 -translate-y-1/2 text-xs tabular-nums first:translate-y-0"
              style={{ top: i * HOUR_PX }}
            >
              {formatTime(`2026-01-05T${String(hour).padStart(2, "0")}:00:00+07:00`, locale)}
            </span>
          ))}
        </div>
        {days.map((day) => (
          <div
            key={day}
            className={cn("border-border relative border-s", day === today && "bg-primary-subtle/40")}
            style={{ height }}
          >
            {hours.map((hour, i) => (
              <span key={hour} className="border-border absolute inset-x-0 border-t" style={{ top: i * HOUR_PX }} />
            ))}
            {(byDayKey.get(day) ?? []).map((viewing) => {
              const start = bangkokMinutes(viewing.startsAt);
              const minutes = (Date.parse(viewing.endsAt) - Date.parse(viewing.startsAt)) / 60_000;
              const need = attention(viewing.access, now);
              return (
                <a
                  key={viewing.id}
                  href={ownerPath(locale, `/leads/${viewing.leadId}`)}
                  tabIndex={-1}
                  className={cn(
                    "rounded-thumb absolute inset-x-1 flex flex-col overflow-hidden border px-1.5 py-1 text-xs leading-tight",
                    viewing.state === "confirmed"
                      ? "border-primary/30 bg-primary-subtle text-primary-subtle-fg"
                      : "border-border-strong bg-surface text-fg",
                  )}
                  style={{
                    top: ((start - first * 60) / 60) * HOUR_PX + 1,
                    height: Math.max((minutes / 60) * HOUR_PX - 2, 22),
                  }}
                  data-testid="calendar-block"
                >
                  <span className="flex items-center gap-1 truncate font-semibold tabular-nums">
                    {need === "incident" || need === "overstay" ? <Icon icon={IconAlert} className="shrink-0" /> : null}
                    {formatTime(viewing.startsAt, locale)} {viewing.prospectName}
                  </span>
                  {minutes >= 45 ? <span className="truncate opacity-80">{viewing.listing.title}</span> : null}
                </a>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function weekdayShort(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
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
