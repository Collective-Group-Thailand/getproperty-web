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
import { Card } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Progress } from "@/ui/components/Progress";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { cn } from "@/ui/lib/cn";

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
  const counts = rollout.counts as Record<string, number>;
  return (
    <div className="flex flex-col gap-6" data-testid="rollout-live" data-status={rollout.status} data-updates={updates}>
      <DetailLayout
        panel={
          <ActionPanel
            title={t("controlTitle")}
            status={<StatusBadgeOf map={ROLLOUT_STATUS} value={rollout.status} />}
            facts={[
              {
                key: "version",
                label: t("col.version"),
                value: <span className="font-mono">{rollout.release.version}</span>,
              },
              { key: "arch", label: t("arch"), value: <span className="font-mono">{rollout.release.arch}</span> },
              { key: "ring", label: t("col.ring"), value: rings(rollout.ring) },
              {
                key: "digest",
                label: t("digestLabel"),
                value: (
                  <span className="font-mono" title={rollout.release.sha256}>
                    {rollout.release.sha256.slice(0, 12)}
                  </span>
                ),
              },
            ]}
            secondary={<RolloutControls rollout={rollout} onChanged={reload} />}
          />
        }
      >
        <Card as="section" aria-labelledby="rollout-progress">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="rollout-progress" className="text-muted text-sm font-medium">
                {t("progressLabel")}
              </h2>
              <p className="text-primary text-3xl font-semibold tracking-tight tabular-nums">
                {t("progressFigure", { done: progress.done, total: progress.total })}
              </p>
            </div>
            <p className="text-muted flex items-center gap-2 text-sm" aria-live="polite">
              <span
                aria-hidden="true"
                className={
                  realtime === "open" ? "bg-success size-2 rounded-full" : "bg-border-strong size-2 rounded-full"
                }
              />
              {realtime === "open" ? t("live") : t("notLive")}
            </p>
          </div>
          <Progress
            className="mt-4"
            value={progress.done}
            max={Math.max(progress.total, 1)}
            label={t("progressLabel")}
            valueText={t("progressText", { done: progress.done, total: progress.total })}
          />
          <dl
            className="border-border rounded-control mt-5 grid grid-cols-2 overflow-hidden border sm:grid-cols-3 xl:grid-cols-6"
            data-testid="rollout-counts"
          >
            {(["queued", "commanded", "started", "applied", "failed", "rolled_back"] as const).map((status) => (
              <div
                key={status}
                className={cn("border-border -ms-px -mt-px flex flex-col gap-0.5 border-s border-t px-4 py-3")}
                data-status={status}
              >
                <dt className="text-muted text-sm">{t(`deviceState.${status}`)}</dt>
                <dd className="text-lg font-semibold tabular-nums" data-testid={`count-${status}`}>
                  {formatNumber(counts[status] ?? 0, locale)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted mt-4 text-sm">
            {t("progressHint", { pct: rollout.maxFailuresPct })}
            {rollout.startedAt ? ` · ${t("startedAt", { date: formatDateTime(rollout.startedAt, locale) })}` : ""}
            {rollout.finishedAt ? ` · ${t("finishedAt", { date: formatDateTime(rollout.finishedAt, locale) })}` : ""}
          </p>
        </Card>
      </DetailLayout>
      <section aria-labelledby="rollout-gateways" className="flex flex-col gap-3">
        <h2 id="rollout-gateways" className="text-lg font-semibold">
          {t("gateways")}
        </h2>
        <SimpleTable
          caption={t("gateways")}
          testId="rollout-devices"
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "gateway", header: t("col.gateway"), phone: "title" },
            { key: "from", header: t("col.from"), phone: "meta" },
            { key: "updated", header: t("col.updated"), phone: "meta" },
            { key: "error", header: t("col.error"), phone: "meta" },
            { key: "status", header: t("col.status"), phone: "status" },
          ]}
          rows={rollout.devices.map((device) => ({
            key: device.deviceId,
            href: `/devices/${device.deviceId}`,
            testId: "rollout-device",
            data: { status: device.status, device: device.deviceId },
            cells: {
              gateway: (
                <span className="font-mono font-semibold">{serials[device.deviceId] ?? t("gatewayUnknown")}</span>
              ),
              from: <span className="font-mono text-sm">{device.fromVersion ?? "—"}</span>,
              updated: <span className="whitespace-nowrap">{formatDateTime(device.updatedAt, locale)}</span>,
              error: device.error ? <span className="font-mono text-sm">{device.error}</span> : "—",
              status: (
                <span className="flex items-center gap-1">
                  <StatusBadgeOf map={OTA_DEVICE_STATUS} value={device.status} size="sm" />
                  {device.status === "applied" ? <Badge size="sm">{rollout.release.version}</Badge> : null}
                </span>
              ),
            },
          }))}
        />
      </section>
    </div>
  );
}
