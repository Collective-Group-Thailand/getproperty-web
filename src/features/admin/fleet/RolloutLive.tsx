"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { OTA_DEVICE_STATUS } from "@/domain/status/otaDevice";
import { ROLLOUT_STATUS } from "@/domain/status/rollout";
import { useRealtimeEvents, useRealtimeStatus } from "@/features/shared/realtime/RealtimeProvider";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { Progress } from "@/ui/components/Progress";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { RolloutControls } from "./OtaActions";
import { rolloutProgress } from "./rollout";

/**
 * A rollout as it happens (F5 5.3, D-131): the API's `ota.rollout_changed` realtime event (ids only,
 * contract §6) triggers a re-read of `GET /v1/admin/ota/rollouts/{id}`, so the progress bar, the counts
 * and every gateway's step update without a reload; the controls follow `nextActions`.
 */
export function RolloutLive({
  initial,
  serials,
}: {
  initial: Schemas["OtaRolloutDto"];
  serials: Record<string, string>;
}) {
  const t = useTranslations("admin.fleet.ota");
  const rings = useTranslations("admin.fleet.ring");
  const locale = useLocale() as Locale;
  const realtime = useRealtimeStatus();
  const [rollout, setRollout] = useState(initial);
  const [updates, setUpdates] = useState(0);

  const reload = useCallback(() => {
    void unwrap(browserApi().GET("/v1/admin/ota/rollouts/{rolloutId}", { params: { path: { rolloutId: initial.id } } }))
      .then((next) => {
        setRollout(next);
        setUpdates((count) => count + 1);
      })
      .catch(() => undefined);
  }, [initial.id]);

  useRealtimeEvents((event) => {
    if (event.type === "ota.rollout_changed" && (!event.ids.rolloutId || event.ids.rolloutId === initial.id)) reload();
  });

  const progress = rolloutProgress(rollout);
  return (
    <div className="flex flex-col gap-6" data-testid="rollout-live" data-status={rollout.status} data-updates={updates}>
      <Card as="section" aria-labelledby="rollout-progress">
        <CardHeader
          title={
            <span id="rollout-progress" className="flex flex-wrap items-center gap-2">
              {t("progressTitle", { version: rollout.release.version, ring: rings(rollout.ring) })}
              <StatusBadgeOf map={ROLLOUT_STATUS} value={rollout.status} size="sm" />
            </span>
          }
          description={t("progressHint", { pct: rollout.maxFailuresPct })}
          action={<RolloutControls rollout={rollout} onChanged={reload} />}
        />
        <Progress
          value={progress.done}
          max={Math.max(progress.total, 1)}
          label={t("progressLabel")}
          valueText={t("progressText", { done: progress.done, total: progress.total })}
        />
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="rollout-counts">
          {(["queued", "commanded", "started", "applied", "failed", "rolled_back"] as const).map((status) => (
            <div key={status} className="flex flex-col" data-status={status}>
              <dt className="text-muted">{t(`deviceState.${status}`)}</dt>
              <dd className="font-semibold tabular-nums" data-testid={`count-${status}`}>
                {formatNumber((rollout.counts as Record<string, number>)[status] ?? 0, locale)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted mt-3 text-xs" aria-live="polite">
          {realtime === "open" ? t("live") : t("notLive")}
          {rollout.startedAt ? ` · ${t("startedAt", { date: formatDateTime(rollout.startedAt, locale) })}` : ""}
          {rollout.finishedAt ? ` · ${t("finishedAt", { date: formatDateTime(rollout.finishedAt, locale) })}` : ""}
        </p>
      </Card>
      <SimpleTable
        caption={t("gateways")}
        testId="rollout-devices"
        minWidth="44rem"
        columns={[
          { key: "gateway", header: t("col.gateway") },
          { key: "from", header: t("col.from") },
          { key: "updated", header: t("col.updated") },
          { key: "error", header: t("col.error") },
          { key: "status", header: t("col.status") },
        ]}
        rows={rollout.devices.map((device) => ({
          key: device.deviceId,
          testId: "rollout-device",
          data: { status: device.status, device: device.deviceId },
          tone: device.status === "failed" || device.status === "rolled_back" ? "danger" : "default",
          cells: {
            gateway: (
              <a href={`/devices/${device.deviceId}`} className="font-mono hover:underline">
                {serials[device.deviceId] ?? device.deviceId.slice(0, 8)}
              </a>
            ),
            from: device.fromVersion ?? "—",
            updated: formatDateTime(device.updatedAt, locale),
            error: device.error ? <span className="font-mono text-xs">{device.error}</span> : "—",
            status: (
              <span className="flex items-center gap-1">
                <StatusBadgeOf map={OTA_DEVICE_STATUS} value={device.status} size="sm" />
                {device.status === "applied" ? <Badge size="sm">{rollout.release.version}</Badge> : null}
              </span>
            ),
          },
        }))}
      />
    </div>
  );
}
