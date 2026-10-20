import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ACCESS_RESULT_STATUS } from "@/domain/status/accessResult";
import { CREDENTIAL_STATUS } from "@/domain/status/credential";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { param, section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerPath, withQuery } from "../shared/links";
import { fieldMembers } from "../shared/members";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { IssueCodes, LockControls, RevokeCredential } from "./LockActions";

type SearchParams = Record<string, string | string[] | undefined>;
const REVOCABLE = new Set(["pending", "active", "failed"]);

/**
 * One lock (F2 2.7, D-071, D-211): its facts, the credentials on it (resident codes that follow the lease,
 * staff / technician codes of work orders, visitor codes) with revoke-with-reason, time-boxed visitor and
 * staff codes, and the unlock events read from the vendor (audited read).
 */
export async function LockDetail({
  context,
  lockId,
  searchParams,
}: {
  context: OwnerContext;
  lockId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.access");
  const { api, locale, me } = context;
  const lock = await unwrap(api.GET("/v1/owner/locks/{lockId}", { params: { path: { lockId } } })).catch(
    (error: unknown) => {
      if (isApiError(error) && error.status === 404) notFound();
      throw error;
    },
  );
  const showAll = param(searchParams.credentials) === "all";
  const [credentials, events, members] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/locks/{lockId}/credentials", {
          params: { path: { lockId }, query: { live: showAll ? undefined : true } },
        }),
      ),
    ),
    section(unwrap(api.GET("/v1/owner/locks/{lockId}/events", { params: { path: { lockId }, query: { limit: 50 } } }))),
    fieldMembers(api, { buildingId: lock.buildingId }),
  ]);
  const canManage = ownerCan(me, "access.manage") && !readOnly(me);
  const holders = new Map((credentials.data?.data ?? []).map((credential) => [credential.id, credential.holderName]));
  const building = context.buildings.find((candidate) => candidate.id === lock.buildingId);
  const path = ownerPath(locale, `/access/${lock.id}`);

  return (
    <OwnerPage testId="lock-detail">
      <PageHeader
        title={lock.name}
        testId="lock-title"
        description={t("lock.subtitle", {
          place: lock.unitNo ? t("unit", { unit: lock.unitNo }) : t(`scope.${lock.scope}`),
          building: building?.name ?? "",
        })}
        crumbs={[{ label: t("title"), href: ownerPath(locale, "/access") }, { label: lock.name }]}
        actions={canManage ? <LockControls lock={lock} /> : null}
      />
      <Card>
        <DescriptionList
          columns={3}
          items={[
            {
              id: "vendor",
              term: t("lock.vendor"),
              description: `${t(`vendor.${lock.vendor}`)} · ${lock.vendorLockId}`,
            },
            { id: "serial", term: t("lock.serial"), description: <span className="font-mono">{lock.serial}</span> },
            {
              id: "online",
              term: t("lock.connection"),
              description: lock.online === null ? t("unknown") : lock.online ? t("online") : t("offline"),
            },
            {
              id: "battery",
              term: t("lock.battery"),
              description:
                lock.batteryPct === null
                  ? null
                  : lock.batteryLow
                    ? t("batteryLow", { pct: lock.batteryPct })
                    : t("battery", { pct: lock.batteryPct }),
            },
            {
              id: "sync",
              term: t("lock.logSync"),
              description: lock.lastLogSyncAt ? formatDateTime(lock.lastLogSyncAt, locale) : null,
            },
            { id: "active", term: t("lock.active"), description: lock.isActive ? t("lock.inUse") : t("inactive") },
          ]}
        />
      </Card>

      <Card as="section" aria-labelledby="lock-credentials" data-testid="lock-credentials">
        <CardHeader
          title={<span id="lock-credentials">{t("credentials.title")}</span>}
          description={t("credentials.hint")}
        />
        <LinkTabs
          label={t("credentials.title")}
          current={showAll ? withQuery(path, { credentials: "all" }) : path}
          tabs={[
            { href: path, label: t("credentials.live"), testId: "credentials-live" },
            { href: withQuery(path, { credentials: "all" }), label: t("credentials.all"), testId: "credentials-all" },
          ]}
        />
        {canManage && lock.isActive ? (
          <div className="my-4">
            <IssueCodes lockId={lock.id} members={members} />
          </div>
        ) : null}
        {credentials.error ? (
          <SectionError error={credentials.error} />
        ) : credentials.data && credentials.data.data.length ? (
          <SimpleTable
            caption={t("credentials.title")}
            testId="credential-table"
            minWidth="52rem"
            columns={[
              { key: "holder", header: t("credentials.holder") },
              { key: "window", header: t("credentials.window") },
              { key: "status", header: t("credentials.status") },
              { key: "actions", header: <span className="sr-only">{t("credentials.actions")}</span> },
            ]}
            rows={credentials.data.data.map((credential) => ({
              key: credential.id,
              testId: "credential-row",
              data: { kind: credential.holderKind, status: credential.status },
              cells: {
                holder: (
                  <span className="flex flex-col">
                    <span className="font-medium">{credential.holderName}</span>
                    <span className="text-muted text-xs">
                      {t(`holder.${credential.holderKind}`)}
                      {credential.unitNo ? ` · ${credential.unitNo}` : ""}
                      {credential.workOrderId ? ` · ${t("credentials.workOrder")}` : ""}
                      {credential.leaseId ? ` · ${t("credentials.lease")}` : ""}
                    </span>
                  </span>
                ),
                window: (
                  <span className="flex flex-col text-sm">
                    <span>{t("credentials.from", { at: formatDateTime(credential.validFrom, locale) })}</span>
                    <span className="text-muted">
                      {credential.validTo
                        ? t("credentials.until", { at: formatDateTime(credential.validTo, locale) })
                        : t("credentials.followsLease")}
                    </span>
                  </span>
                ),
                status: (
                  <span className="flex flex-col gap-1">
                    <StatusBadgeOf map={CREDENTIAL_STATUS} value={credential.status} size="sm" />
                    {credential.vendorError ? (
                      <span className="text-muted text-xs">{credential.vendorError}</span>
                    ) : null}
                    {credential.revokeReason ? (
                      <span className="text-muted text-xs">
                        {t("credentials.revokedBecause", { reason: credential.revokeReason })}
                      </span>
                    ) : null}
                  </span>
                ),
                actions:
                  canManage && REVOCABLE.has(credential.status) ? <RevokeCredential credential={credential} /> : null,
              },
            }))}
          />
        ) : (
          <p className="text-muted text-sm">{t("credentials.none")}</p>
        )}
      </Card>

      <Card as="section" aria-labelledby="lock-events" data-testid="lock-events">
        <CardHeader title={<span id="lock-events">{t("events.title")}</span>} description={t("events.hint")} />
        {events.error ? (
          <SectionError error={events.error} />
        ) : events.data && events.data.data.length ? (
          <SimpleTable
            caption={t("events.title")}
            testId="event-table"
            columns={[
              { key: "time", header: t("events.time") },
              { key: "result", header: t("events.result") },
              { key: "source", header: t("events.source") },
              { key: "holder", header: t("events.holder") },
            ]}
            rows={events.data.data.map((event) => ({
              key: event.id,
              testId: "event-row",
              cells: {
                time: formatDateTime(event.time, locale),
                result: <StatusBadgeOf map={ACCESS_RESULT_STATUS} value={event.result} size="sm" />,
                source: t(`source.${event.source}`),
                holder: event.credentialId ? (holders.get(event.credentialId) ?? t("events.otherCode")) : "—",
              },
            }))}
          />
        ) : (
          <p className="text-muted text-sm">{t("events.none")}</p>
        )}
      </Card>
    </OwnerPage>
  );
}
