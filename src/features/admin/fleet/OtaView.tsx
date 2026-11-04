import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ROLLOUT_STATUS } from "@/domain/status/rollout";
import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconCpu } from "@/ui/icons/glyphs/cpu";
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
      <section aria-labelledby="ota-rollouts" className="flex flex-col gap-3">
        <h2 id="ota-rollouts" className="text-lg font-semibold">
          {t("rollouts")}
        </h2>
        {!rollouts.data ? (
          <SectionError error={rollouts.error} />
        ) : rollouts.data.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconCpu}
            title={t("noRollouts")}
            description={t("noRolloutsHint")}
            action={
              <Button asChild variant="secondary">
                <a href="#ota-releases">{t("toReleases")}</a>
              </Button>
            }
          />
        ) : (
          <SimpleTable
            caption={t("rollouts")}
            testId="rollout-table"
            stackOnPhones
            minWidth="48rem"
            columns={[
              { key: "release", header: t("col.release"), phone: "title" },
              { key: "ring", header: t("col.ring"), phone: "meta" },
              { key: "progress", header: t("col.progress"), align: "end", phone: "figure" },
              { key: "started", header: t("col.started"), phone: "meta" },
              { key: "status", header: t("col.status"), phone: "status" },
            ]}
            rows={rollouts.data.map((rollout) => {
              const progress = rolloutProgress(rollout);
              return {
                key: rollout.id,
                href: `/ota/rollouts/${rollout.id}`,
                testId: "rollout-row",
                data: { status: rollout.status, ring: rollout.ring },
                cells: {
                  release: (
                    <span className="font-mono font-semibold">
                      {rollout.release.version} · {rollout.release.arch}
                    </span>
                  ),
                  ring: rings(rollout.ring),
                  progress: t("progressText", { done: progress.done, total: progress.total }),
                  started: rollout.startedAt ? (
                    <span className="whitespace-nowrap">{formatDateTime(rollout.startedAt, locale)}</span>
                  ) : (
                    "—"
                  ),
                  status: <StatusBadgeOf map={ROLLOUT_STATUS} value={rollout.status} size="sm" />,
                },
              };
            })}
          />
        )}
      </section>
      <section aria-labelledby="ota-releases" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="ota-releases" className="text-lg font-semibold">
            {t("releases")}
          </h2>
          <p className="text-muted text-sm">{t("releasesHint")}</p>
        </div>
        {!releases.data ? (
          <SectionError error={releases.error} />
        ) : releases.data.length === 0 ? (
          <EmptyState variant="card" icon={IconCpu} title={t("noReleases")} action={<RegisterRelease />} />
        ) : (
          <SimpleTable
            caption={t("releases")}
            testId="release-table"
            stackOnPhones
            minWidth="56rem"
            columns={[
              { key: "version", header: t("col.version"), phone: "title" },
              { key: "channel", header: t("col.channel"), phone: "meta" },
              { key: "released", header: t("col.released"), phone: "meta" },
              { key: "rings", header: t("col.rings"), phone: "meta" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                phone: "figure",
                className: "w-14",
              },
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
                    {release.notes ? <span className="text-sm">{release.notes}</span> : null}
                    <span className="text-muted font-mono text-xs" title={release.sha256}>
                      {t("digest", { sha: release.sha256.slice(0, 12), key: release.keyId })}
                    </span>
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
                released: <span className="whitespace-nowrap">{formatDateTime(release.releasedAt, locale)}</span>,
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
                actions: release.deprecatedAt ? null : (
                  <ActionMenu label={t("releaseMore", { version: release.version })}>
                    <PlanRollout release={release} />
                  </ActionMenu>
                ),
              },
            }))}
          />
        )}
      </section>
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
