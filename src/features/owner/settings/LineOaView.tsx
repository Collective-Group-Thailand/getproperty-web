import { getTranslations } from "next-intl/server";

import { MESSAGING_CHANNEL_STATUS } from "@/domain/status/messagingChannel";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Progress } from "@/ui/components/Progress";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { ConnectLineOa, CopyWebhookUrl, RevokeLineOa, VerifyLineOa } from "./LineOaActions";
import { SettingsNav } from "./SettingsNav";

/**
 * The operator's own LINE Official Account (D-254): connected channels (for every building, or one), each with its
 * state from LINE, the webhook URL to paste in LINE Developers and how many residents confirmed; how to connect one.
 * No channel = every message goes through the shared getproperty OA, which also covers residents not yet linked.
 */
export async function LineOaView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.settings.lineOa");
  const { api, locale, me, buildings } = context;
  const [channels, usage] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/messaging/channels"))),
    section(unwrap(api.GET("/v1/owner/messaging/usage"))),
  ]);
  const manage = ownerCan(me, "tenant.settings.update") && !readOnly(me);
  const scope = (id: string | null) =>
    id ? (buildings.find((building) => building.id === id)?.name ?? id.slice(0, 8)) : t("scopeAll");
  return (
    <OwnerPage testId="line-oa">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          manage ? (
            <ConnectLineOa buildings={buildings.map((building) => ({ id: building.id, name: building.name }))} />
          ) : null
        }
      />
      <SettingsNav me={me} current="/settings/line-oa" locale={locale} />
      {usage.data ? <UsageCard usage={usage.data} locale={locale} t={t} /> : null}
      {!channels.data ? (
        <SectionError error={channels.error} />
      ) : channels.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-label={t("title")}>
          {channels.data.map((channel) => (
            <li key={channel.id}>
              <Card className="flex flex-col gap-4" data-testid="line-oa-channel" data-state={channel.state}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {channel.botPictureUrl ? (
                      // A LINE profile image (any host): a plain <img>.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={channel.botPictureUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                    ) : null}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{channel.botName ?? t("unnamed")}</span>
                      <span className="text-muted text-sm">
                        {scope(channel.buildingId)} · {t("channel", { id: channel.lineChannelId })}
                      </span>
                    </div>
                  </div>
                  <StatusBadgeOf map={MESSAGING_CHANNEL_STATUS} value={channel.state} size="sm" />
                </div>
                {channel.state === "failing" && channel.lastError ? (
                  <Callout tone="danger">{channel.lastError}</Callout>
                ) : null}
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{t("webhook")}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <code
                      className="bg-surface-subtle min-w-0 flex-1 rounded-md px-3 py-2 font-mono text-sm break-all"
                      data-testid="line-oa-webhook"
                    >
                      {channel.webhookUrl}
                    </code>
                    <CopyWebhookUrl url={channel.webhookUrl} />
                  </div>
                  <span className="text-muted text-xs">{t("webhookHint")}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span data-testid="line-oa-linked">{t("linked", { count: channel.linkedUsers })}</span>
                    {channel.lastCheckedAt ? (
                      <span>{t("checkedAt", { date: formatDateTime(channel.lastCheckedAt, locale) })}</span>
                    ) : null}
                  </span>
                  {manage ? (
                    <span className="flex flex-wrap gap-2">
                      <VerifyLineOa channel={channel} />
                      <RevokeLineOa channel={channel} />
                    </span>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card className="flex flex-col gap-3" data-testid="line-oa-how">
        <h2 className="font-display text-lg font-semibold">{t("how.title")}</h2>
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-5">
          {(["step1", "step2", "step3", "step4"] as const).map((step) => (
            <li key={step}>{t(`how.${step}`)}</li>
          ))}
        </ol>
        <p className="text-muted text-sm">{t("shared")}</p>
      </Card>
    </OwnerPage>
  );
}

/** This month's messages (D-254): the shared OA against its free messages, the charge beyond, the own OA's count. */
function UsageCard({
  usage,
  locale,
  t,
}: {
  usage: Schemas["MessagingUsageDto"];
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations<"owner.settings.lineOa">>>;
}) {
  const { shared, own } = usage;
  const tone =
    shared.usedPercent === null
      ? "primary"
      : shared.usedPercent >= 100
        ? "danger"
        : shared.usedPercent >= 80
          ? "warning"
          : "primary";
  return (
    <Card className="flex flex-col gap-4" data-testid="line-oa-usage">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t("usage.title")}</h2>
        <span className="text-muted text-sm">{t("usage.repliesFree")}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("usage.shared")}</span>
        {shared.allowance === null ? (
          <p data-testid="line-oa-usage-shared">{t("usage.notCharged", { counted: shared.counted })}</p>
        ) : (
          <>
            <Progress
              value={shared.counted}
              max={shared.allowance}
              tone={tone}
              label={t("usage.shared")}
              valueText={t("usage.counted", { counted: shared.counted, allowance: shared.allowance })}
            />
            <p className="text-muted text-sm" data-testid="line-oa-usage-shared">
              {shared.chargeable > 0 && shared.estimatedCharge !== null
                ? t("usage.beyond", {
                    count: shared.chargeable,
                    amount: formatTHB(shared.estimatedCharge, locale),
                    vat: formatTHB(shared.estimatedVat ?? "0", locale),
                  })
                : t("usage.left", { left: shared.left ?? 0 })}
            </p>
          </>
        )}
      </div>
      {own.counted > 0 ? <p className="text-sm">{t("usage.own", { count: own.counted })}</p> : null}
      {usage.quotaFallbacks > 0 ? (
        <Callout tone="warning">{t("usage.fallbacks", { count: usage.quotaFallbacks })}</Callout>
      ) : null}
    </Card>
  );
}
