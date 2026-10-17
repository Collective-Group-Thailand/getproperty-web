"use client";

import { METER_HEALTH_STATUS } from "@/domain/status/meterHealth";
import { READING_STATUS } from "@/domain/status/reading";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { useRealtimeEvents } from "@/features/shared/realtime/RealtimeProvider";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";
import { Progress } from "@/ui/components/Progress";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconSyncFailed } from "@/ui/icons/glyphs/sync-failed";
import { IconSyncPending } from "@/ui/icons/glyphs/sync-pending";
import { IconWater } from "@/ui/icons/glyphs/water";
import { lazyWarm } from "@/ui/lib/lazy";

import { useQueueEntries } from "../pwa/useOfflineQueue";
import { PhotoThumb } from "../shared/PhotoThumb";
import { meterUnit } from "../shared/units";
import { roundView, type ReadingEntry } from "./roundState";

const ReadingCapture = lazyWarm(() => import("./ReadingCapture").then((module) => module.ReadingCapture));

type Target = { item: Schemas["RoundItemDto"]; entry?: ReadingEntry } | null;

/**
 * The reading round (F4 4.1 §2): meters still to read before the cut-off, floor → unit → meter, each a
 * big card with the last reading and its photo; a progress bar; this device's readings (sent, waiting
 * or refused) under "done". Tapping a card opens the capture flow in place (no navigation, so it works
 * offline from the cached page); Back closes it.
 */
export function ReadingRound({ round }: { round: Schemas["RoundBuildingDto"] }) {
  const t = useTranslations("staff.readings");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();
  const entries = useQueueEntries();
  const view = useMemo(() => roundView(round, entries), [round, entries]);
  const [target, setTarget] = useState<Target>(null);

  // The round changes when anyone reads a meter of this building: refetch the server half.
  useRealtimeEvents(
    useCallback(
      (event) => {
        if (event.type.startsWith("reading.") || event.type.startsWith("meter.")) router.refresh();
      },
      [router],
    ),
  );

  // Back (hardware or browser) closes the capture flow instead of leaving the round.
  useEffect(() => {
    if (!target) return;
    const close = () => setTarget(null);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [target]);

  const open = (next: Target) => {
    if (!target) window.history.pushState({ gpCapture: true }, "");
    setTarget(next);
    window.scrollTo({ top: 0 });
  };
  const close = () => {
    if (window.history.state?.gpCapture) window.history.back();
    else setTarget(null);
    // Offline the queue already shows what changed; a refresh would try the network for nothing.
    if (navigator.onLine) router.refresh();
  };

  if (target) {
    return (
      <Suspense fallback={<p className="text-muted py-10 text-center">{t("loading")}</p>}>
        <ReadingCapture
          key={`${target.item.assetItemId}-${target.entry?.id ?? "new"}`}
          item={target.item}
          round={{ buildingId: round.buildingId, periodKey: round.periodKey }}
          resume={target.entry}
          onClose={close}
          onNext={(current) => {
            const next = view.next(current);
            if (next) open({ item: next });
            else close();
          }}
        />
      </Suspense>
    );
  }

  const itemFor = (entry: ReadingEntry): Schemas["RoundItemDto"] => {
    const known = round.floors.flatMap((floor) => floor.items).find((i) => i.assetItemId === entry.meta.assetItemId);
    return (
      known ?? {
        assetItemId: entry.meta.assetItemId,
        meterAssignmentId: "",
        code: entry.meta.code,
        utility: entry.meta.utility,
        purpose: "unit",
        unitId: null,
        unitNo: entry.meta.unitNo,
        iot: false,
        health: null,
        lastReading: null,
      }
    );
  };

  return (
    <div className="flex flex-col gap-5 py-6" data-testid="reading-round">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">
          {t("subtitle", { building: round.buildingName, date: formatDate(round.cutoffAt, locale) })}
        </p>
        <Progress
          label={t("progressLabel")}
          value={view.done}
          max={view.total}
          valueText={t("progress", { done: view.done, total: view.total })}
          className="mt-1"
        />
      </header>

      {view.remaining.length === 0 ? (
        <EmptyState icon={IconCheckCircle} title={t("allRead")} description={t("allReadHint")} />
      ) : (
        view.remaining.map(({ floor, items }) => (
          <section key={floor.floorId ?? "none"} aria-labelledby={`floor-${floor.floorId ?? "none"}`}>
            <h2 id={`floor-${floor.floorId ?? "none"}`} className="mb-2 text-lg font-semibold">
              {floor.floorName ?? t("noFloor")}{" "}
              <span className="text-muted text-base font-normal tabular-nums">
                {t("count", { count: items.length })}
              </span>
            </h2>
            <ul className="flex flex-col gap-3" data-testid="round-items">
              {items.map((item) => {
                const conflict = view.local.find(
                  (e) => e.meta.assetItemId === item.assetItemId && e.state === "conflict",
                );
                const readEarly = view.local.find(
                  (e) => e.meta.assetItemId === item.assetItemId && view.early.has(e.id),
                );
                return (
                  <li key={item.assetItemId}>
                    <button
                      type="button"
                      onClick={() => open({ item, entry: conflict })}
                      className="rounded-card border-border bg-surface shadow-card hover:bg-bg-subtle flex min-h-24 w-full items-center gap-3 border p-3 text-start"
                      data-testid="round-item"
                      data-asset={item.assetItemId}
                    >
                      {item.lastReading?.photoDocumentId ? (
                        <PhotoThumb
                          fileId={item.lastReading.photoDocumentId}
                          alt={t("lastPhoto", { unit: item.unitNo ?? item.code })}
                        />
                      ) : (
                        <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-20 shrink-0 items-center justify-center">
                          <Icon icon={item.utility === "electric" ? IconElectric : IconWater} size={32} />
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-xl font-semibold">
                          {item.unitNo ?? item.code}{" "}
                          <span className="text-muted text-base font-normal">· {t(`utility.${item.utility}`)}</span>
                        </span>
                        {item.lastReading ? (
                          <span className="text-muted text-sm">
                            {t("last", {
                              value: formatUnits(item.lastReading.register, meterUnit(item.utility), locale),
                              date: formatDate(item.lastReading.readAt, locale),
                            })}
                          </span>
                        ) : (
                          <span className="text-muted text-sm">{t("noLast")}</span>
                        )}
                        <span className="flex flex-wrap gap-1">
                          {item.lastReading ? <ReadingSourceBadge source={item.lastReading.source} /> : null}
                          {item.iot && item.health ? (
                            <StatusBadgeOf map={METER_HEALTH_STATUS} value={item.health} size="sm" />
                          ) : null}
                          {conflict ? (
                            <Badge tone="danger" size="sm" icon={IconSyncFailed}>
                              {t("conflictBadge")}
                            </Badge>
                          ) : null}
                          {readEarly ? (
                            <Badge tone="info" size="sm">
                              {t("earlyBadge", { date: formatDate(round.windowStart, locale) })}
                            </Badge>
                          ) : null}
                        </span>
                      </span>
                      <Icon icon={IconChevronRight} size={24} className="text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {view.local.some((entry) => entry.state !== "conflict" && !view.early.has(entry.id)) ? (
        <section aria-labelledby="round-done" className="flex flex-col gap-2">
          <h2 id="round-done" className="text-lg font-semibold">
            {t("doneTitle")}{" "}
            <span className="text-muted text-base font-normal tabular-nums">{t("count", { count: view.done })}</span>
          </h2>
          <ul className="divide-border rounded-card border-border bg-surface divide-y border" data-testid="round-done">
            {view.local
              .filter((entry) => entry.state !== "conflict" && !view.early.has(entry.id))
              .map((entry) => {
                const reading = entry.state === "sent" ? (entry.result as Schemas["MeterReadingDto"] | null) : null;
                const value = reading?.register ?? entry.meta.typedValue;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => open({ item: itemFor(entry), entry })}
                      className="hover:bg-bg-subtle flex min-h-14 w-full items-center gap-3 px-3 py-2 text-start"
                      data-testid="round-done-item"
                      data-asset={entry.meta.assetItemId}
                      data-state={entry.state}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">
                          {entry.meta.unitNo ?? entry.meta.code} · {t(`utility.${entry.meta.utility}`)}
                        </span>
                        <span className="text-muted text-sm tabular-nums">
                          {value ? formatUnits(value, meterUnit(entry.meta.utility), locale) : t("ocrPending")}
                          {" · "}
                          {format.relativeTime(entry.createdAt)}
                        </span>
                      </span>
                      {reading ? (
                        <StatusBadgeOf map={READING_STATUS} value={reading.reviewState} size="sm" />
                      ) : (
                        <Badge tone="neutral" size="sm" icon={IconSyncPending}>
                          {t("waiting")}
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
