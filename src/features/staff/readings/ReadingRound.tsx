"use client";

import { METER_HEALTH_STATUS } from "@/domain/status/meterHealth";
import { READING_STATUS } from "@/domain/status/reading";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { useRealtimeEvents } from "@/features/shared/realtime/RealtimeProvider";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Progress } from "@/ui/components/Progress";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconSyncFailed } from "@/ui/icons/glyphs/sync-failed";
import { IconSyncPending } from "@/ui/icons/glyphs/sync-pending";
import { IconWater } from "@/ui/icons/glyphs/water";
import { lazyWarm } from "@/ui/lib/lazy";

import { useQueueEntries } from "../pwa/useOfflineQueue";
import { StaffList, StaffSection } from "../shell/StaffList";
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
        requested: false,
        assignee: null,
      }
    );
  };

  const doneEntries = view.local.filter((entry) => entry.state !== "conflict" && !view.early.has(entry.id));

  return (
    <div className="flex flex-col gap-8 py-6" data-testid="reading-round">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="rounded-card border-border bg-surface shadow-card flex flex-col gap-3 border p-5">
          <p className="text-muted text-sm">
            {t("subtitle", { building: round.buildingName, date: formatDate(round.cutoffAt, locale) })}
          </p>
          <p className="flex items-baseline gap-2" aria-hidden="true">
            <span className="text-primary text-3xl font-semibold tabular-nums">
              {view.done} / {view.total}
            </span>
            <span className="text-muted">{t("readCaption")}</span>
          </p>
          <Progress
            label={t("progressLabel")}
            value={view.done}
            max={view.total}
            valueText={t("progress", { done: view.done, total: view.total })}
            showCaption={false}
          />
        </div>
      </header>

      {view.remaining.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={t("allRead")}
          description={t("allReadHint")}
          action={
            <Button asChild variant="secondary" size="lg">
              <Link href="/">{t("backToday")}</Link>
            </Button>
          }
        />
      ) : (
        view.remaining.map(({ floor, items }) => (
          <StaffSection
            key={floor.floorId ?? "none"}
            id={`floor-${floor.floorId ?? "none"}`}
            title={floor.floorName ?? t("noFloor")}
            count={items.length}
          >
            <div data-testid="round-items">
              <StaffList
                label={floor.floorName ?? t("noFloor")}
                groups={[
                  {
                    key: "items",
                    rows: items.map((item) => {
                      const conflict = view.local.find(
                        (e) => e.meta.assetItemId === item.assetItemId && e.state === "conflict",
                      );
                      const readEarly = view.local.find(
                        (e) => e.meta.assetItemId === item.assetItemId && view.early.has(e.id),
                      );
                      const badges = [
                        item.lastReading ? <ReadingSourceBadge key="source" source={item.lastReading.source} /> : null,
                        item.iot && item.health ? (
                          <StatusBadgeOf key="health" map={METER_HEALTH_STATUS} value={item.health} size="sm" />
                        ) : null,
                        conflict ? (
                          <Badge key="conflict" tone="danger" size="sm" icon={IconSyncFailed}>
                            {t("conflictBadge")}
                          </Badge>
                        ) : null,
                        readEarly ? (
                          <Badge key="early" tone="info" size="sm">
                            {t("earlyBadge", { date: formatDate(round.windowStart, locale) })}
                          </Badge>
                        ) : null,
                      ].filter(Boolean);
                      return {
                        key: item.assetItemId,
                        onSelect: () => open({ item, entry: conflict }),
                        icon: item.utility === "electric" ? IconElectric : IconWater,
                        title: `${item.unitNo ?? item.code} · ${t(`utility.${item.utility}`)}`,
                        meta: item.lastReading
                          ? t("last", {
                              value: formatUnits(item.lastReading.register, meterUnit(item.utility), locale),
                              date: formatDate(item.lastReading.readAt, locale),
                            })
                          : t("noLast"),
                        status: badges.length ? <>{badges}</> : undefined,
                        testId: "round-item",
                        data: { asset: item.assetItemId },
                      };
                    }),
                  },
                ]}
              />
            </div>
          </StaffSection>
        ))
      )}

      {doneEntries.length > 0 ? (
        <StaffSection id="round-done" title={t("doneTitle")} count={view.done}>
          <div data-testid="round-done">
            <StaffList
              label={t("doneTitle")}
              groups={[
                {
                  key: "done",
                  rows: doneEntries.map((entry) => {
                    const reading = entry.state === "sent" ? (entry.result as Schemas["MeterReadingDto"] | null) : null;
                    const value = reading?.register ?? entry.meta.typedValue;
                    return {
                      key: entry.id,
                      onSelect: () => open({ item: itemFor(entry), entry }),
                      icon: reading ? IconCheckCircle : IconSyncPending,
                      title: `${entry.meta.unitNo ?? entry.meta.code} · ${t(`utility.${entry.meta.utility}`)}`,
                      meta: `${value ? formatUnits(value, meterUnit(entry.meta.utility), locale) : t("ocrPending")} · ${format.relativeTime(entry.createdAt)}`,
                      status: reading ? (
                        <StatusBadgeOf map={READING_STATUS} value={reading.reviewState} size="sm" />
                      ) : (
                        <Badge tone="neutral" size="sm" icon={IconSyncPending}>
                          {t("waiting")}
                        </Badge>
                      ),
                      testId: "round-done-item",
                      data: { asset: entry.meta.assetItemId, state: entry.state },
                    };
                  }),
                },
              ]}
            />
          </div>
        </StaffSection>
      ) : null}
    </div>
  );
}
