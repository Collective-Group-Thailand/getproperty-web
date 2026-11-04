import { getTranslations } from "next-intl/server";

import { SUPPORT_GRANT_STATUS } from "@/domain/status/supportGrant";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Progress } from "@/ui/components/Progress";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconHelp } from "@/ui/icons/glyphs/help";

import { ownerPath } from "../shared/links";
import { readOnly, section, type OwnerContext } from "../shared/server";
import { SupportGrantActions } from "./AccessActions";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

const OPEN: Schemas["SupportGrantState"][] = ["requested", "approved", "active"];

/**
 * Settings › Support access (F2 2.6, D-090; redesign G6): getproperty support's requests to read this tenant's data
 * for a ticket. Each open request is a card — a pending one with approve (the page's only filled action) and deny, a
 * live one with its window, the time left as the key figure and "end now" — and the closed ones in a compact history.
 * Every read made under a grant is in the audit log.
 */
export async function SupportAccessView({
  context,
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.support");
  const { api, locale, me } = context;
  const grants = await section(unwrap(api.GET("/v1/owner/support-grants")));
  const open = (grants.data ?? []).filter((grant) => OPEN.includes(grant.state));
  const closed = (grants.data ?? []).filter((grant) => !OPEN.includes(grant.state));
  const live = open.filter((grant) => grant.state === "active" || grant.state === "approved");
  const now = currentTime();
  const audit = ownerPath(locale, "/settings/audit-log?action=support_grant.*");

  const card = (grant: Schemas["SupportGrantDto"]) => {
    const from = grant.validFrom ? Date.parse(grant.validFrom) : null;
    const to = grant.validTo ? Date.parse(grant.validTo) : null;
    const left = to !== null ? Math.max(0, to - now) : null;
    const hours = left !== null ? Math.floor(left / 3_600_000) : 0;
    const minutes = left !== null ? Math.floor((left % 3_600_000) / 60_000) : 0;
    return (
      <li
        key={grant.id}
        className="rounded-card border-border bg-surface shadow-card flex flex-col border"
        data-testid="support-row"
        data-state={grant.state}
      >
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadgeOf map={SUPPORT_GRANT_STATUS} value={grant.state} />
              {grant.ticketRef ? (
                <span className="text-muted text-sm tabular-nums">{t("ticket", { ref: grant.ticketRef })}</span>
              ) : null}
            </span>
            <span className="text-muted text-sm">
              {t("requestedAt", { date: formatDateTime(grant.createdAt, locale) })}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted text-sm">{t("col.reason")}</span>
            <p className="text-base font-medium text-pretty">{grant.reason}</p>
          </div>
          {grant.state === "requested" ? (
            <p className="text-muted text-sm">{t("pendingHint")}</p>
          ) : from !== null && to !== null ? (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-end">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted text-sm">{t("timeLeft")}</span>
                <span className="text-primary text-2xl font-semibold tracking-tight tabular-nums">
                  {t("hoursMinutes", { hours, minutes })}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-muted text-sm tabular-nums">
                  {formatDateTime(grant.validFrom!, locale)} – {formatDateTime(grant.validTo!, locale)}
                </span>
                <Progress
                  size="sm"
                  value={Math.max(0, now - from)}
                  max={Math.max(1, to - from)}
                  label={t("windowLabel")}
                  valueText={t("hoursMinutesLeft", { hours, minutes })}
                  showCaption={false}
                />
              </div>
            </div>
          ) : null}
          <dl className="text-muted flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt>{t("scopeLabel")}</dt>
              <dd className="text-fg">{t("scopeReadOnly")}</dd>
            </div>
            {grant.approvedVia ? (
              <div className="flex gap-1.5">
                <dt>{t("approvedBy")}</dt>
                <dd className="text-fg">{t(`via.${grant.approvedVia}`)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        {!readOnly(me) && grant.nextActions.length > 0 ? (
          <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3 md:px-6">
            <SupportGrantActions grant={grant} />
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/support-access"
      title={t("title")}
      description={t("description")}
      testId="support-access"
    >
      {live.length > 0 ? (
        <Callout tone="info" title={t("liveTitle", { count: live.length })}>
          {t.rich("liveBody", {
            audit: (chunks) => (
              <a className="font-medium underline underline-offset-4" href={audit}>
                {chunks}
              </a>
            ),
          })}
        </Callout>
      ) : null}
      {!grants.data ? (
        <SectionError error={grants.error} />
      ) : grants.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconHelp}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <a className="text-primary font-medium underline-offset-4 hover:underline" href={audit}>
              {t("openAudit")}
            </a>
          }
        />
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="flex flex-col gap-4" aria-label={t("openTitle")}>
              {open.map(card)}
            </ul>
          ) : null}
          {closed.length > 0 ? (
            <SettingsCard id="support-history" title={t("historyTitle")} description={t("historyHint")} flush>
              <SimpleTable
                caption={t("historyTitle")}
                testId="support-table"
                minWidth="40rem"
                stackOnPhones
                className="rounded-none border-0 shadow-none"
                columns={[
                  { key: "reason", header: t("col.reason"), phone: "title" },
                  { key: "requested", header: t("col.requested"), className: "whitespace-nowrap", phone: "meta" },
                  { key: "window", header: t("col.window"), phone: "meta" },
                  { key: "state", header: t("col.state"), className: "whitespace-nowrap", phone: "status" },
                ]}
                rows={closed.map((grant) => ({
                  key: grant.id,
                  testId: "support-row",
                  data: { state: grant.state },
                  cells: {
                    reason: (
                      <span className="flex max-w-md flex-col">
                        <span>{grant.reason}</span>
                        {grant.ticketRef ? (
                          <span className="text-muted text-sm">{t("ticket", { ref: grant.ticketRef })}</span>
                        ) : null}
                      </span>
                    ),
                    requested: formatDateTime(grant.createdAt, locale),
                    window:
                      grant.validFrom && grant.validTo
                        ? `${formatDateTime(grant.validFrom, locale)} – ${formatDateTime(grant.validTo, locale)}`
                        : "—",
                    state: <StatusBadgeOf map={SUPPORT_GRANT_STATUS} value={grant.state} size="sm" />,
                  },
                }))}
              />
            </SettingsCard>
          ) : null}
        </>
      )}
    </SettingsFrame>
  );
}
