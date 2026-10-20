import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { BuildingSelect } from "../shared/BuildingSelect";
import { TaskComplete } from "./TaskComplete";
import type { StaffScope } from "../shared/server";

const ICON = {
  work_order: IconWrench,
  inspection: IconCamera,
  reading: IconMeter,
  parcel: IconParcel,
  install: IconGateway,
} as const satisfies Record<Schemas["StaffTaskType"], unknown>;

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
 * Today (F4 4.1 / 4.4, D-213): the reading round's progress, then the day's tasks from
 * `GET /v1/staff/tasks` — work orders, inspections, reading requests, parcels at the desk and install
 * orders — grouped by type and floor (building-wide first), most urgent first, overdue marked; mine (and
 * unassigned) by default, everyone's on a tap. A work order with its after photo and a parcel can be
 * finished from here; the rest open their screen. Server-rendered: the PWA's start page paints from the
 * network or the service worker's cache.
 */
export async function TodayView({
  scope,
  menu,
  mine,
}: {
  scope: StaffScope;
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
  const building = scope.buildings.find((candidate) => candidate.id === scope.buildingId);
  const nothing = (round?.remaining ?? 0) === 0 && (day?.total ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="staff-today">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {scope.buildings.length === 1 && building ? (
          <p className="text-muted text-lg" data-testid="building-name">
            {building.name}
          </p>
        ) : null}
        <BuildingSelect buildings={scope.buildings} buildingId={scope.buildingId} />
      </header>

      {has("readings") ? (
        <section aria-labelledby="today-readings" className="flex flex-col gap-3">
          <h2 id="today-readings" className="text-lg font-semibold">
            {t("readings.title")}
          </h2>
          {scope.rounds === null ? (
            <Callout tone="warning">{t("unavailable")}</Callout>
          ) : round ? (
            <>
              <BigActionButton
                href="/readings"
                tone={round.remaining > 0 ? "primary" : "default"}
                icon={IconMeter}
                title={round.remaining > 0 ? t("readings.action") : t("readings.done")}
                description={t("readings.cutoff", { date: formatDate(round.cutoffAt, locale) })}
                count={round.remaining}
                aria-label={t("readings.label", { count: round.remaining })}
                data-testid="today-readings"
              />
              {round.floors.length > 0 ? (
                <ul className="text-muted flex flex-wrap gap-2 text-sm" data-testid="today-floors">
                  {round.floors.map((floor) => (
                    <li key={floor.floorId ?? "none"} className="rounded-control bg-bg-subtle px-3 py-1.5">
                      {t("readings.floor", {
                        floor: floor.floorName ?? t("readings.noFloor"),
                        count: floor.items.length,
                      })}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-muted">{t("readings.none")}</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="today-tasks" className="flex flex-col gap-4" data-testid="today-tasks">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="today-tasks" className="text-lg font-semibold">
            {t("tasks.title")}{" "}
            {day ? <span className="text-muted tabular-nums">{t("count", { count: day.total })}</span> : null}
          </h2>
          <nav aria-label={t("tasks.whose")} className="flex gap-2">
            <Button asChild size="lg" variant={mine ? "primary" : "secondary"}>
              <Link href="/" aria-current={mine ? "page" : undefined} data-testid="tasks-mine">
                {t("tasks.mine")}
              </Link>
            </Button>
            <Button asChild size="lg" variant={mine ? "secondary" : "primary"}>
              <Link href="/?mine=0" aria-current={mine ? undefined : "page"} data-testid="tasks-everyone">
                {t("tasks.everyone")}
              </Link>
            </Button>
          </nav>
        </div>
        {!scope.buildingId ? null : day === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : day.groups.length === 0 ? (
          <p className="text-muted">{t("tasks.none")}</p>
        ) : (
          day.groups.map((group) => (
            <section
              key={group.type}
              aria-labelledby={`group-${group.type}`}
              className="flex flex-col gap-3"
              data-testid={TEST_ID[group.type]}
              data-count={group.count}
            >
              <h3 id={`group-${group.type}`} className="font-semibold">
                {t(`tasks.type.${group.type}`)}{" "}
                <span className="text-muted tabular-nums">{t("count", { count: group.count })}</span>
              </h3>
              {group.floors.map((floor) => (
                <div key={floor.floorId ?? "building"} className="flex flex-col gap-2">
                  <p className="text-muted text-sm" data-testid="task-floor">
                    {floor.floorName ?? t("tasks.buildingWide")}
                  </p>
                  <ul className="flex flex-col gap-3">
                    {floor.tasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex flex-col gap-2"
                        data-testid="task"
                        data-type={task.type}
                        data-overdue={task.overdue}
                      >
                        <BigActionButton
                          href={taskHref(task)}
                          tone={task.overdue || task.priority === "urgent" ? "primary" : "default"}
                          icon={ICON[task.type]}
                          title={
                            task.unitNo
                              ? t("tasks.subjectUnit", { subject: task.subject, unit: task.unitNo })
                              : task.subject
                          }
                          description={[
                            task.overdue ? t("tasks.overdue") : null,
                            task.dueAt ? t("tasks.due", { at: formatDateTime(task.dueAt, locale) }) : null,
                            task.priority === "high" || task.priority === "urgent"
                              ? t(`tasks.priority.${task.priority}`)
                              : null,
                            task.completable ? null : t("tasks.readOnly"),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                        {task.completable && (task.type === "work_order" || task.type === "parcel") ? (
                          <TaskComplete task={task} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))
        )}
      </section>

      {nothing ? <EmptyState icon={IconCheckCircle} title={t("allDone")} description={t("allDoneHint")} /> : null}
    </div>
  );
}
