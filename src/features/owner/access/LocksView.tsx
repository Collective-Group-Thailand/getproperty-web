import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconOffline } from "@/ui/icons/glyphs/offline";
import { IconOnline } from "@/ui/icons/glyphs/online";

import { buildingUnits } from "../service/server";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { RegisterLock } from "./LockActions";

/**
 * Doors and locks (F2 2.7, D-070, D-071, D-211): the focused building's locks — unit, building door, common
 * area — with vendor, connection and battery (low battery highlighted; the API opens a repair request by
 * itself at the threshold). Access follows the lease; nothing on these screens reads invoices or balances
 * (D-024).
 */
export async function LocksView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.access");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const [locks, units] = await Promise.all([
    unwrap(api.GET("/v1/owner/locks", { params: { query: { buildingId: building?.id } } })).then((body) => body.data),
    building ? buildingUnits(api, building.id) : Promise.resolve([]),
  ]);
  const canManage = ownerCan(me, "access.manage") && !readOnly(me);
  const buildingName = (id: string) => context.buildings.find((candidate) => candidate.id === id)?.name ?? "";

  return (
    <OwnerPage testId="locks">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("title") }]}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {me.menu.includes("settings") ? (
              <a
                href={ownerPath(locale, "/settings#settings-access")}
                className="text-primary text-sm underline-offset-4 hover:underline"
                data-testid="access-settings-link"
              >
                {t("settingsLink")}
              </a>
            ) : null}
            {canManage && building ? <RegisterLock buildingId={building.id} units={units} /> : null}
          </span>
        }
      />
      <p className="text-muted text-sm" data-testid="access-rule">
        {t("rule")}
      </p>
      {locks.length === 0 ? (
        <Card>
          <EmptyState icon={IconLock} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="lock-table"
          minWidth="48rem"
          columns={[
            { key: "name", header: t("col.lock") },
            { key: "place", header: t("col.place") },
            { key: "state", header: t("col.state") },
            { key: "battery", header: t("col.battery") },
          ]}
          rows={locks.map((lock) => ({
            key: lock.id,
            testId: "lock-row",
            tone: lock.batteryLow ? "warning" : "default",
            data: { scope: lock.scope, battery: lock.batteryLow ? "low" : "ok" },
            cells: {
              name: (
                <span className="flex flex-col">
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/access/${lock.id}`)}
                  >
                    {lock.name}
                  </a>
                  <span className="text-muted font-mono text-xs">
                    {t(`vendor.${lock.vendor}`)} · {lock.serial}
                  </span>
                </span>
              ),
              place: (
                <span className="flex flex-col">
                  <span>{lock.unitNo ? t("unit", { unit: lock.unitNo }) : t(`scope.${lock.scope}`)}</span>
                  {!building ? <span className="text-muted text-xs">{buildingName(lock.buildingId)}</span> : null}
                </span>
              ),
              state: (
                <span className="flex flex-wrap items-center gap-2">
                  {lock.online === null ? (
                    <Badge tone="neutral" size="sm">
                      {t("unknown")}
                    </Badge>
                  ) : lock.online ? (
                    <Badge tone="success" size="sm" icon={IconOnline}>
                      {t("online")}
                    </Badge>
                  ) : (
                    <Badge tone="warning" size="sm" icon={IconOffline}>
                      {t("offline")}
                    </Badge>
                  )}
                  {lock.isActive ? null : (
                    <Badge tone="neutral" size="sm">
                      {t("inactive")}
                    </Badge>
                  )}
                </span>
              ),
              battery:
                lock.batteryPct === null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <span className="flex flex-col gap-1">
                    {lock.batteryLow ? (
                      <Badge tone="warning" size="sm" icon={IconAlert}>
                        {t("batteryLow", { pct: lock.batteryPct })}
                      </Badge>
                    ) : (
                      <span className="tabular-nums">{t("battery", { pct: lock.batteryPct })}</span>
                    )}
                    {lock.batteryCheckedAt ? (
                      <span className="text-muted text-xs">{formatDateTime(lock.batteryCheckedAt, locale)}</span>
                    ) : null}
                  </span>
                ),
            },
          }))}
        />
      )}
    </OwnerPage>
  );
}
