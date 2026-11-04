import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Progress } from "@/ui/components/Progress";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { Icon } from "@/ui/icons";
import { IconHelp } from "@/ui/icons/glyphs/help";
import { IconShield } from "@/ui/icons/glyphs/shield";
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
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {me.menu.includes("settings") ? (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/settings#settings-access")} data-testid="access-settings-link">
                  {t("settingsLink")}
                </a>
              </Button>
            ) : null}
            {canManage && building ? <RegisterLock buildingId={building.id} units={units} /> : null}
          </span>
        }
      />
      <Card className="flex items-start gap-3" data-testid="access-rule">
        <Icon icon={IconShield} className="text-subtle mt-0.5 shrink-0 text-lg" />
        <p className="text-sm">{t("rule")}</p>
      </Card>
      {locks.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconLock}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            canManage && building ? (
              <RegisterLock buildingId={building.id} units={units} variant="secondary" />
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/devices")}>{t("empty.devices")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="lock-table"
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "name", header: t("col.lock"), phone: "title" },
            { key: "place", header: t("col.place"), phone: "meta", className: "md:w-44" },
            { key: "state", header: t("col.state"), phone: "status", className: "md:w-40" },
            { key: "battery", header: t("col.battery"), phone: "figure", className: "md:w-48" },
          ]}
          rows={locks.map((lock) => ({
            key: lock.id,
            href: ownerPath(locale, `/access/${lock.id}`),
            testId: "lock-row",
            data: { scope: lock.scope, battery: lock.batteryLow ? "low" : "ok" },
            cells: {
              name: (
                <span className="flex flex-col gap-0.5">
                  <span>{lock.name}</span>
                  <span className="text-muted text-sm font-normal">
                    {t(`vendor.${lock.vendor}`)} · <span className="font-mono">{lock.serial}</span>
                  </span>
                </span>
              ),
              place: (
                <span className="flex flex-col">
                  <span>{lock.unitNo ? t("unit", { unit: lock.unitNo }) : t(`scope.${lock.scope}`)}</span>
                  {!building ? <span className="text-muted text-sm">{buildingName(lock.buildingId)}</span> : null}
                </span>
              ),
              state: (
                <span className="flex flex-wrap items-center gap-1.5">
                  {lock.online === null ? (
                    <Badge tone="neutral" size="sm" icon={IconHelp}>
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
                  <span className="flex flex-col items-start gap-1 max-md:items-end">
                    <span className="flex items-center gap-2">
                      <Progress
                        className="w-16 max-md:hidden"
                        value={lock.batteryPct}
                        max={100}
                        label={t("col.battery")}
                        valueText={t("battery", { pct: lock.batteryPct })}
                        showCaption={false}
                        tone={lock.batteryLow ? "warning" : "primary"}
                      />
                      {lock.batteryLow ? (
                        <StatusText tone="warning" icon={IconAlert} className="tabular-nums">
                          {t("batteryLow", { pct: lock.batteryPct })}
                        </StatusText>
                      ) : (
                        <span className="text-sm tabular-nums">{t("battery", { pct: lock.batteryPct })}</span>
                      )}
                    </span>
                    {lock.batteryCheckedAt ? (
                      <span className="text-muted text-sm whitespace-nowrap">
                        {formatDateTime(lock.batteryCheckedAt, locale)}
                      </span>
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
