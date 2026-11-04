import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { cn } from "@/ui/lib/cn";

import { StaffList, StaffSection } from "../shell/StaffList";
import type { StaffScope } from "../shared/server";

const TEST_ID: Record<Schemas["StaffTaskType"], string> = {
  work_order: "today-work-orders",
  inspection: "today-inspections",
  reading: "today-reading-requests",
  parcel: "today-parcels",
  install: "today-installs",
};

/** Where a task is done (its own screen). */
function taskHref(task: Pick<Schemas["StaffTaskDto"], "type" | "id">): string {
  switch (task.type) {
    case "work_order":
      return `/work-orders/${task.id}`;
    case "inspection":
      return `/inspections/${task.id}`;
    case "reading":
      return "/readings";
    case "parcel":
      return `/parcels#parcel-${task.id}`;
    case "install":
      return "/devices";
  }
}

/**
 * Today (F4 4.1 / 4.4, D-213; redesign G7): one hero — the reading round before the cut-off, the page's only filled
 * action — then the day's tasks from `GET /v1/staff/tasks`, mine (and unassigned) or everyone's, grouped by kind in
 * one card each, rows by floor (building-wide first), most urgent first. A row opens the task's own screen, where it
 * is done: no "Finish" or "Hand over" buttons repeated under the rows. Server-rendered: the PWA's start page paints
 * from the network or the service worker's cache.
 */
export async function TodayView({
  scope,
  menu,
  mine,
  tenantName,
}: {
  scope: StaffScope;
  /** The organisation, beside the date: the building is in the top bar. */
  tenantName: string;
  menu: readonly Schemas["StaffMenuKey"][];
  mine: boolean;
}) {
  const t = await getTranslations("staff.today");
  const locale = (await getLocale()) as Locale;
  const has = (key: Schemas["StaffMenuKey"]) => menu.includes(key);

  const day = scope.buildingId
    ? await unwrap(
        scope.api.GET("/v1/staff/tasks", {
          params: { query: { building: scope.buildingId, mine: mine || undefined } },
        }),
      ).catch(() => null)
    : null;

  const round = scope.rounds?.find((candidate) => candidate.buildingId === scope.buildingId);

  return (
    <div className="flex flex-col gap-8 py-6" data-testid="staff-today">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">
          {[formatDate(new Date(), locale, { style: "long" }), tenantName].filter(Boolean).join(" · ")}
        </p>
      </header>

      {has("readings") ? (
        scope.rounds === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : round ? (
          <ReadingsHero round={round} locale={locale} />
        ) : (
          <p className="text-muted">{t("readings.none")}</p>
        )
      ) : null}

      <StaffSection
        id="today-tasks-title"
        title={t("tasks.title")}
        count={day?.total}
        testId="today-tasks"
        className="gap-4"
      >
        <nav
          aria-label={t("tasks.whose")}
          className="rounded-control border-border bg-surface grid grid-cols-2 gap-1 border p-1"
        >
          {[
            { href: "/", on: mine, label: t("tasks.mine"), testId: "tasks-mine" },
            { href: "/?mine=0", on: !mine, label: t("tasks.everyone"), testId: "tasks-everyone" },
          ].map((option) => (
            <a
              key={option.href}
              href={option.href}
              aria-current={option.on ? "page" : undefined}
              className={cn(
                "rounded-thumb duration-fast flex h-12 items-center justify-center font-medium transition-colors",
                option.on ? "bg-primary-subtle text-primary-subtle-fg" : "text-muted hover:bg-bg-subtle hover:text-fg",
              )}
              data-testid={option.testId}
            >
              {option.label}
            </a>
          ))}
        </nav>

        {!scope.buildingId ? null : day === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : day.groups.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconCheckCircle}
            title={t("allDone")}
            description={t("allDoneHint")}
            action={
              <Button asChild variant="secondary" size="lg">
                <a href={mine ? "/?mine=0" : "/"}>{mine ? t("tasks.seeEveryone") : t("tasks.seeMine")}</a>
              </Button>
            }
          />
        ) : (
          day.groups.map((group) => (
            <section
              key={group.type}
              aria-labelledby={`group-${group.type}`}
              className="flex flex-col gap-2"
              data-testid={TEST_ID[group.type]}
              data-count={group.count}
            >
              <h3 id={`group-${group.type}`} className="text-muted text-sm font-semibold">
                {t(`tasks.type.${group.type}`)} <span className="font-normal tabular-nums">{group.count}</span>
              </h3>
              <StaffList
                label={t(`tasks.type.${group.type}`)}
                groups={group.floors.map((floor) => ({
                  key: floor.floorId ?? "building",
                  label: floor.floorName ?? t("tasks.buildingWide"),
                  labelTestId: "task-floor",
                  rows: floor.tasks.map((task) => ({
                    key: task.id,
                    href: taskHref(task),
                    // The API's subject often names the unit already ("Move-out inspection A-201").
                    title:
                      task.unitNo && !task.subject.includes(task.unitNo)
                        ? t("tasks.subjectUnit", { subject: task.subject, unit: task.unitNo })
                        : task.subject,
                    meta: [
                      task.dueAt ? t("tasks.due", { at: formatDateTime(task.dueAt, locale) }) : null,
                      task.completable ? null : t("tasks.readOnly"),
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    status:
                      task.overdue || task.priority === "high" || task.priority === "urgent" ? (
                        <>
                          {task.overdue ? (
                            <Badge tone="danger" size="sm" icon={IconAlert}>
                              {t("tasks.overdue")}
                            </Badge>
                          ) : null}
                          {task.priority === "high" || task.priority === "urgent" ? (
                            <Badge tone="warning" size="sm" icon={IconFlag}>
                              {t(`tasks.priority.${task.priority}`)}
                            </Badge>
                          ) : null}
                        </>
                      ) : undefined,
                    testId: "task",
                    data: { type: task.type, overdue: task.overdue },
                  })),
                }))}
              />
            </section>
          ))
        )}
      </StaffSection>
    </div>
  );
}

/**
 * The reading round as the day's hero: the cut-off, how many meters are left (the key figure, in brand blue), the
 * floors to walk, and the one filled action. The whole card is the link — a gloved thumb can land anywhere on it.
 */
async function ReadingsHero({ round, locale }: { round: Schemas["RoundBuildingDto"]; locale: Locale }) {
  const t = await getTranslations("staff.today");
  const left = round.remaining;
  const floors = round.floors.filter((floor) => floor.items.length > 0);
  return (
    <Link
      href="/readings"
      aria-label={t("readings.label", { count: left })}
      className="rounded-card border-border bg-surface shadow-card hover:border-border-strong duration-fast group flex flex-col gap-4 border p-5 transition-colors"
      data-testid="today-readings"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("readings.title")}</h2>
          <p className="text-muted text-sm">{t("readings.cutoff", { date: formatDate(round.cutoffAt, locale) })}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span
            className={cn("text-3xl leading-none font-semibold tabular-nums", left > 0 ? "text-primary" : "text-fg")}
            data-testid="big-action-count"
          >
            {left}
          </span>
          <span className="text-muted mt-1 text-xs">{t("readings.leftCaption")}</span>
        </div>
      </div>
      {floors.length > 0 ? (
        <ul className="divide-border border-border divide-y border-y" data-testid="today-floors">
          {floors.map((floor) => (
            <li key={floor.floorId ?? "none"} className="flex min-h-11 items-center justify-between gap-3 text-base">
              <span className="sr-only">
                {t("readings.floor", { floor: floor.floorName ?? t("readings.noFloor"), count: floor.items.length })}
              </span>
              <span aria-hidden="true">{floor.floorName ?? t("readings.noFloor")}</span>
              <span aria-hidden="true" className="text-muted tabular-nums">
                {t("readings.floorLeft", { count: floor.items.length })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {left > 0 ? (
        <span className="rounded-control bg-primary text-primary-fg group-hover:bg-primary-hover flex h-14 items-center justify-center gap-2 text-lg font-semibold">
          <Icon icon={IconMeter} size={22} />
          {t("readings.action")}
        </span>
      ) : (
        <span className="text-success-subtle-fg flex items-center gap-2 font-medium">
          <Icon icon={IconCheckCircle} size={22} />
          {t("readings.done")}
          <Icon icon={IconChevronRight} size={20} className="text-subtle ms-auto rtl:rotate-180" />
        </span>
      )}
    </Link>
  );
}
