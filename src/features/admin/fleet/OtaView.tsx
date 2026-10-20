import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ROLLOUT_STATUS } from "@/domain/status/rollout";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { section, type AdminContext } from "../shared/server";
import { PlanRollout, RegisterRelease } from "./OtaActions";
import { rolloutProgress } from "./rollout";
import { RolloutLive } from "./RolloutLive";

/**
 * OTA (F5 5.3, D-131, D-183): signed releases per architecture with their rollouts, and every rollout
 * by ring with its progress; a release is rolled out ring by ring (canary → pilot → all).
 */
export async function OtaView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.fleet.ota");
  const rings = await getTranslations("admin.fleet.ring");
  const { api, locale } = context;
  const [releases, rollouts] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/ota/releases"))),
    section(unwrap(api.GET("/v1/admin/ota/rollouts"))),
  ]);
  const byRelease = new Map<string, Schemas["OtaRolloutDto"][]>();
  for (const rollout of rollouts.data ?? [])
    byRelease.set(rollout.release.id, [...(byRelease.get(rollout.release.id) ?? []), rollout]);

  return (
    <ConsolePage testId="ota">
      <PageHeader title={t("title")} description={t("description")} actions={<RegisterRelease />} />
      <Card as="section" aria-labelledby="ota-rollouts">
        <CardHeader title={<span id="ota-rollouts">{t("rollouts")}</span>} />
        {!rollouts.data ? (
          <SectionError error={rollouts.error} />
        ) : rollouts.data.length === 0 ? (
          <EmptyState title={t("noRollouts")} />
        ) : (
          <SimpleTable
            caption={t("rollouts")}
            testId="rollout-table"
            minWidth="48rem"
            columns={[
              { key: "release", header: t("col.release") },
              { key: "ring", header: t("col.ring") },
              { key: "progress", header: t("col.progress") },
              { key: "started", header: t("col.started") },
              { key: "status", header: t("col.status") },
            ]}
            rows={rollouts.data.map((rollout) => {
              const progress = rolloutProgress(rollout);
              return {
                key: rollout.id,
                testId: "rollout-row",
                data: { status: rollout.status, ring: rollout.ring },
                cells: {
                  release: (
                    <a href={`/ota/rollouts/${rollout.id}`} className="font-mono font-semibold hover:underline">
                      {rollout.release.version} · {rollout.release.arch}
                    </a>
                  ),
                  ring: rings(rollout.ring),
                  progress: t("progressText", { done: progress.done, total: progress.total }),
                  started: rollout.startedAt ? formatDateTime(rollout.startedAt, locale) : "—",
                  status: <StatusBadgeOf map={ROLLOUT_STATUS} value={rollout.status} size="sm" />,
                },
              };
            })}
          />
        )}
      </Card>
      <Card as="section" aria-labelledby="ota-releases">
        <CardHeader title={<span id="ota-releases">{t("releases")}</span>} description={t("releasesHint")} />
        {!releases.data ? (
          <SectionError error={releases.error} />
        ) : releases.data.length === 0 ? (
          <EmptyState title={t("noReleases")} />
        ) : (
          <SimpleTable
            caption={t("releases")}
            testId="release-table"
            minWidth="56rem"
            columns={[
              { key: "version", header: t("col.version") },
              { key: "channel", header: t("col.channel") },
              { key: "released", header: t("col.released") },
              { key: "rings", header: t("col.rings") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={releases.data.map((release) => ({
              key: release.id,
              testId: "release-row",
              data: { version: release.version, arch: release.arch },
              cells: {
                version: (
                  <span className="flex flex-col">
                    <span className="font-mono font-semibold">
                      {release.version} · {release.arch}
                    </span>
                    <span className="text-muted font-mono text-xs" title={release.sha256}>
                      {t("digest", { sha: release.sha256.slice(0, 12), key: release.keyId })}
                    </span>
                    {release.notes ? <span className="text-xs">{release.notes}</span> : null}
                  </span>
                ),
                channel: (
                  <span className="flex flex-col gap-1">
                    <span>{release.channel}</span>
                    {release.deprecatedAt ? (
                      <Badge size="sm" tone="warning">
                        {t("deprecated")}
                      </Badge>
                    ) : null}
                  </span>
                ),
                released: formatDateTime(release.releasedAt, locale),
                rings: (byRelease.get(release.id) ?? []).length ? (
                  <span className="flex flex-wrap gap-1">
                    {(byRelease.get(release.id) ?? []).map((rollout) => (
                      <a key={rollout.id} href={`/ota/rollouts/${rollout.id}`} className="hover:underline">
                        <Badge size="sm">
                          {rings(rollout.ring)} · {t(`statusShort.${rollout.status}`)}
                        </Badge>
                      </a>
                    ))}
                  </span>
                ) : (
                  "—"
                ),
                actions: release.deprecatedAt ? null : <PlanRollout release={release} />,
              },
            }))}
          />
        )}
      </Card>
    </ConsolePage>
  );
}

/** One rollout, live (F5 5.3): progress from SSE, per-gateway steps, pause / resume / abort. */
export async function RolloutDetail({ context, rolloutId }: { context: AdminContext; rolloutId: string }) {
  const t = await getTranslations("admin.fleet.ota");
  const { api } = context;
  let rollout: Schemas["OtaRolloutDto"];
  try {
    rollout = await unwrap(api.GET("/v1/admin/ota/rollouts/{rolloutId}", { params: { path: { rolloutId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
  // Serials of the gateways in the rollout (the rollout names devices by id only).
  const gateways = await section(
    unwrap(api.GET("/v1/admin/devices", { params: { query: { kind: "gateway", perPage: 100 } } })),
  );
  const serials = Object.fromEntries((gateways.data?.data ?? []).map((device) => [device.id, device.serial]));
  return (
    <ConsolePage testId="rollout-detail">
      <PageHeader
        title={t("rolloutTitle", { version: rollout.release.version, arch: rollout.release.arch })}
        crumbs={[{ label: t("title"), href: "/ota" }, { label: `${rollout.release.version} · ${rollout.ring}` }]}
        description={rollout.release.notes ?? undefined}
      />
      <RolloutLive initial={rollout} serials={serials} />
    </ConsolePage>
  );
}
