"use client";

import { KioskNote, KioskInput as Input, KioskChip } from "@/ui/components/Kiosk";

import { IconWarning } from "@/ui/icons/glyphs/warning";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Spinner } from "@/ui/components/Spinner";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { cx as cn } from "@/ui/lib/cx";

import { KioskDialog } from "./KioskDialog";
import { guardFetch, type GuardUnit } from "./lib/api";
import { filterUnits, groupsOf, readCachedUnits, UNITS_PAGE, writeCachedUnits } from "./lib/units";

/** "ไม่ตอบใน 3 นาที → ให้ รปภ. โทร" from the house's policy (API values only). */
export function policyMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Destination (J-DESIGN §3): soi chips + the house number. The API answers by number only (D-315: no names at the
 * gate — owner search is a contract request); for an estate of up to 100 houses the whole list is loaded once and
 * filtered here, larger estates ask the API per keystroke. Offline, the list the tablet remembers is used. Each row
 * shows what the API says: LINE reachable or not, and the house's answer window. Mounted only while open.
 */
export function DestinationPicker({
  gateId,
  onClose,
  onChoose,
}: {
  gateId: string;
  onClose: () => void;
  onChoose: (unit: GuardUnit) => void;
}) {
  const t = useTranslations("owner.guard");
  const [all, setAll] = useState<GuardUnit[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [remote, setRemote] = useState<GuardUnit[] | null>(null);
  const complete = all !== null && all.length < UNITS_PAGE;

  useEffect(() => {
    let live = true;
    void guardFetch<GuardUnit[]>(`/v1/guard/units?limit=${UNITS_PAGE}`).then((result) => {
      if (!live) return;
      if (result.ok) {
        setAll(result.data);
        writeCachedUnits(gateId, result.data);
      } else {
        setAll(readCachedUnits(gateId));
        setOffline(true);
      }
    });
    return () => {
      live = false;
    };
  }, [gateId]);

  // A large estate: the number goes to the API (the first 100 are not all of it).
  useEffect(() => {
    if (all === null || complete || offline || !query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const result = await guardFetch<GuardUnit[]>(
        `/v1/guard/units?limit=${UNITS_PAGE}&q=${encodeURIComponent(query.trim())}`,
        {
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted) setRemote(result.ok ? result.data : null);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [all, complete, offline, query]);

  const units = useMemo(() => {
    if (all === null) return null;
    const source = !complete && !offline && query.trim() && remote ? remote : all;
    return filterUnits(source, query, group);
  }, [all, complete, offline, query, group, remote]);
  const groups = all ? groupsOf(all) : [];

  const chip = (value: string | null, label: string) => (
    <button
      key={label}
      type="button"
      onClick={() => setGroup(value)}
      aria-pressed={group === value}
      className={cn(
        "rounded-control h-12 touch-manipulation border px-4 text-base",
        group === value
          ? "border-primary bg-primary-subtle text-primary-subtle-fg font-semibold"
          : "border-border bg-surface active:bg-bg-subtle",
      )}
    >
      {label}
    </button>
  );

  return (
    <KioskDialog
      open
      onClose={onClose}
      title={t("units.title")}
      closeLabel={t("close")}
      variant="sheet"
      testId="destination-picker"
    >
      <div className="flex flex-col gap-4">
        {offline ? (
          <KioskNote tone="warning" icon={IconWarning}>
            {t("units.offline")}
          </KioskNote>
        ) : null}
        <div className="relative">
          <Icon
            icon={IconSearch}
            size={24}
            className="text-subtle pointer-events-none absolute start-4 top-1/2 -translate-y-1/2"
          />
          <Input
            value={query}
            inputMode="text"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("units.search")}
            aria-label={t("units.search")}
            className="h-16 ps-14 font-mono text-xl"
            data-testid="destination-search"
          />
        </div>
        {groups.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("units.group")}>
            {chip(null, t("units.allGroups"))}
            {groups.map((name) => chip(name, name))}
          </div>
        ) : null}
        <div aria-live="polite" className="min-h-6">
          {units === null ? (
            <span className="text-muted flex items-center gap-2">
              <Spinner size="sm" label={t("units.searching")} />
              <span aria-hidden>{t("units.searching")}</span>
            </span>
          ) : units.length === 0 ? (
            <span className="text-muted">{t("units.empty", { query: query.trim() })}</span>
          ) : null}
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {(units ?? []).map((unit) => (
            <li key={unit.unitId}>
              <button
                type="button"
                onClick={() => onChoose(unit)}
                data-testid="destination-option"
                className="rounded-card border-border bg-surface active:bg-bg-subtle flex min-h-20 w-full touch-manipulation items-center gap-4 border px-5 py-3 text-left"
              >
                <Icon icon={IconHome} size={26} className="text-primary shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-xl font-semibold">{unit.unitNo}</span>
                    <span className="text-muted">{unit.buildingName}</span>
                  </span>
                  <span className="text-muted block text-sm">
                    {t(`units.policy.${unit.policy.action}`, { minutes: policyMinutes(unit.policy.timeoutSeconds) })}
                    {unit.policy.deliverySkipApproval ? ` · ${t("units.deliverySkip")}` : ""}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1.5">
                  {unit.lineLinked ? (
                    <KioskChip tone="success" icon={IconChat}>
                      {t("entry.lineLinked")}
                    </KioskChip>
                  ) : (
                    <KioskChip tone="neutral">{t("entry.lineNotLinked")}</KioskChip>
                  )}
                  {unit.hasArrears ? <KioskChip tone="neutral">{t("entry.hasArrears")}</KioskChip> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </KioskDialog>
  );
}
