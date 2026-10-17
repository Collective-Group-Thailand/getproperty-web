"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { UNIT_STATUS } from "@/domain/status/unit";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazySheet } from "@/ui/components/overlays";
import { Icon } from "@/ui/icons";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { lazyWarm } from "@/ui/lib/lazy";
import { cn } from "@/ui/lib/cn";

const UnitDrawerContent = lazyWarm(() => import("./UnitDrawerContent").then((module) => module.UnitDrawerContent));

type Filter = { status: string; q: string; issue: "" | "balance" | "meter" };

const BAD_HEALTH = new Set(["stale", "silent", "unknown"]);

/**
 * The unit board (F2 2.1, A1.1): floors × unit cards — unit code, status, resident, balance and a meter
 * health mark — with filters, keyboard navigation (arrow keys move between cards and floors, Home/End
 * along a floor, Enter opens) and the unit drawer. Floors are virtualised against the window scroll, so
 * a 300-unit building renders only the floors on screen (design-system.md §7).
 */
export function UnitBoard({ board, links }: { board: Schemas["BoardDto"]; links: { prefix: string } }) {
  const t = useTranslations("owner.units.board");
  const statuses = useTranslations("status.unit");
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<Filter>({ status: "", q: "", issue: "" });
  const [open, setOpen] = useState<Schemas["BoardUnitDto"] | null>(null);
  const [active, setActive] = useState<string | null>(board.floors[0]?.units[0]?.id ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const floors = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return board.floors
      .map((floor) => ({
        ...floor,
        units: floor.units.filter(
          (unit) =>
            (!filter.status || unit.status === filter.status) &&
            (!q || unit.unitNo.toLowerCase().includes(q) || unit.lessee?.displayName.toLowerCase().includes(q)) &&
            (filter.issue !== "balance" || (unit.balance !== null && unit.balance !== "0.00")) &&
            (filter.issue !== "meter" || (unit.meterHealth !== null && BAD_HEALTH.has(unit.meterHealth))),
        ),
      }))
      .filter((floor) => floor.units.length > 0);
  }, [board.floors, filter]);
  const shown = floors.reduce((sum, floor) => sum + floor.units.length, 0);

  useLayoutEffect(() => {
    setOffset(listRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: floors.length,
    estimateSize: (index) => 56 + Math.ceil((floors[index]?.units.length ?? 1) / 6) * 124,
    overscan: 2,
    scrollMargin: offset,
    initialRect: { width: 1280, height: 900 },
  });

  /** Focus a card by floor/position, scrolling its floor into the rendered window first. */
  const focusCard = useCallback(
    (floorIndex: number, unitIndex: number) => {
      const floor = floors[floorIndex];
      if (!floor) return;
      const unit = floor.units[Math.max(0, Math.min(unitIndex, floor.units.length - 1))];
      if (!unit) return;
      setActive(unit.id);
      virtualizer.scrollToIndex(floorIndex, { align: "auto" });
      let tries = 0;
      const attempt = () => {
        const element = document.querySelector<HTMLButtonElement>(`[data-unit-card="${unit.id}"]`);
        if (element) element.focus();
        else if (tries++ < 20) requestAnimationFrame(attempt);
      };
      requestAnimationFrame(attempt);
    },
    [floors, virtualizer],
  );

  const onKeyDown = (event: React.KeyboardEvent, floorIndex: number, unitIndex: number) => {
    const floor = floors[floorIndex]!;
    const handled = (() => {
      switch (event.key) {
        case "ArrowRight":
          if (unitIndex < floor.units.length - 1) focusCard(floorIndex, unitIndex + 1);
          else focusCard(floorIndex + 1, 0);
          return true;
        case "ArrowLeft":
          if (unitIndex > 0) focusCard(floorIndex, unitIndex - 1);
          else if (floorIndex > 0) focusCard(floorIndex - 1, floors[floorIndex - 1]!.units.length - 1);
          return true;
        case "ArrowDown":
          focusCard(Math.min(floors.length - 1, floorIndex + 1), unitIndex);
          return true;
        case "ArrowUp":
          focusCard(Math.max(0, floorIndex - 1), unitIndex);
          return true;
        case "Home":
          focusCard(event.ctrlKey ? 0 : floorIndex, 0);
          return true;
        case "End":
          focusCard(
            event.ctrlKey ? floors.length - 1 : floorIndex,
            event.ctrlKey ? Number.MAX_SAFE_INTEGER : floor.units.length - 1,
          );
          return true;
        default:
          return false;
      }
    })();
    if (handled) event.preventDefault();
  };

  const activeVisible = floors.some((floor) => floor.units.some((unit) => unit.id === active));
  const tabbable = activeVisible ? active : (floors[0]?.units[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-4" data-testid="unit-board" data-units={shown}>
      <div className="flex flex-wrap items-end gap-3" role="search">
        <Field label={t("filter.search")} className="min-w-48">
          <Input
            type="search"
            inputSize="sm"
            value={filter.q}
            placeholder={t("filter.searchPlaceholder")}
            onChange={(event) => setFilter((current) => ({ ...current, q: event.target.value }))}
            data-testid="board-search"
          />
        </Field>
        <Field label={t("filter.status")} className="min-w-40">
          <NativeSelect
            inputSize="sm"
            value={filter.status}
            placeholder={t("filter.allStatuses")}
            options={(["vacant", "reserved", "occupied", "maintenance", "inactive"] as const).map((status) => ({
              value: status,
              label: statuses(status),
            }))}
            onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}
            data-testid="board-status"
          />
        </Field>
        <Field label={t("filter.issue")} className="min-w-44">
          <NativeSelect
            inputSize="sm"
            value={filter.issue}
            placeholder={t("filter.anyIssue")}
            options={[
              { value: "balance", label: t("filter.balance") },
              { value: "meter", label: t("filter.meter") },
            ]}
            onChange={(event) => setFilter((current) => ({ ...current, issue: event.target.value as Filter["issue"] }))}
            data-testid="board-issue"
          />
        </Field>
        <p className="text-muted pb-2 text-sm" aria-live="polite" data-testid="board-count">
          {t("shown", { shown, total: board.summary.total })}
        </p>
      </div>

      <p id="board-keys" className="sr-only">
        {t("keys")}
      </p>
      {floors.length === 0 ? (
        <p className="text-muted rounded-card border-border border border-dashed p-6 text-center">{t("noMatch")}</p>
      ) : (
        <div
          ref={listRef}
          role="grid"
          aria-label={t("label", { building: board.building.name })}
          aria-describedby="board-keys"
          aria-rowcount={floors.length}
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const floor = floors[row.index]!;
            return (
              <div
                key={floor.id ?? "none"}
                role="row"
                aria-rowindex={row.index + 1}
                data-index={row.index}
                ref={virtualizer.measureElement}
                className="absolute inset-x-0 top-0 flex flex-col gap-2 pb-4"
                style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
                data-testid="board-floor"
              >
                <div role="rowheader" className="flex items-baseline gap-2">
                  <span className="font-semibold">{floor.name || t("noFloor")}</span>
                  <span className="text-muted text-sm">{t("floorCount", { count: floor.units.length })}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
                  {floor.units.map((unit, unitIndex) => (
                    <div key={unit.id} role="gridcell">
                      <UnitCard
                        unit={unit}
                        locale={locale}
                        tabIndex={unit.id === tabbable ? 0 : -1}
                        onOpen={() => {
                          setActive(unit.id);
                          setOpen(unit);
                        }}
                        onKeyDown={(event) => onKeyDown(event, row.index, unitIndex)}
                        onFocus={() => setActive(unit.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LazySheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={open ? t("drawerTitle", { unit: open.unitNo }) : ""}
        closeLabel={t("close")}
        side="right"
      >
        {open ? (
          <Suspense fallback={null}>
            <UnitDrawerContent unitId={open.id} prefix={links.prefix} />
          </Suspense>
        ) : null}
      </LazySheet>
    </div>
  );
}

function UnitCard({
  unit,
  locale,
  tabIndex,
  onOpen,
  onKeyDown,
  onFocus,
}: {
  unit: Schemas["BoardUnitDto"];
  locale: Locale;
  tabIndex: number;
  onOpen: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onFocus: () => void;
}) {
  const t = useTranslations("owner.units.board");
  const owing = unit.balance !== null && unit.balance !== "0.00";
  const unhealthy = unit.meterHealth !== null && BAD_HEALTH.has(unit.meterHealth);
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      data-unit-card={unit.id}
      data-testid="unit-card"
      data-status={unit.status}
      className={cn(
        "rounded-card border-border bg-surface hover:bg-bg-subtle flex h-28 w-full flex-col items-start gap-1 border p-2.5 text-start",
        "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span className="font-mono font-semibold">{unit.unitNo}</span>
        {unit.meterHealth && unit.meterHealth !== "no_device" ? (
          <span
            className={cn("inline-flex items-center", unhealthy ? "text-subtle" : "text-primary")}
            title={t(`health.${unhealthy ? "bad" : "ok"}`)}
          >
            <Icon icon={IconMeter} size={14} />
            <span className="sr-only">{t(`health.${unhealthy ? "bad" : "ok"}`)}</span>
            {unhealthy ? (
              <span aria-hidden className="ms-0.5 text-xs font-bold">
                !
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <StatusBadgeOf map={UNIT_STATUS} value={unit.status} size="sm" />
      <span className="text-muted w-full truncate text-xs">
        {unit.lessee?.displayName ?? (unit.baseRent ? t("rent", { rent: formatTHB(unit.baseRent, locale) }) : " ")}
      </span>
      {owing ? (
        <span className="text-xs font-medium tabular-nums" data-testid="unit-balance">
          {t("balance", { amount: formatTHB(unit.balance!, locale) })}
        </span>
      ) : null}
    </button>
  );
}
