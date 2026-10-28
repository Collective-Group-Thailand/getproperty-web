import { getTranslations } from "next-intl/server";

import { SOCIAL_CHANNEL_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconLink } from "@/ui/icons/glyphs/link";

import { SettingsNav } from "../settings/SettingsNav";
import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { ConnectFacebookPage, RevokeFacebookPage, VerifyFacebookPage } from "./FacebookPageActions";

/**
 * Settings › Facebook Page (G4, D-288, D-296 (4)): the tenant's own Page that published listings are posted to,
 * edited when the rent changes and removed once the unit is let — its state from Facebook, whether auto-post is on,
 * the last check and Facebook's reason when it fails; connect / check again / disconnect. Facebook groups and
 * Marketplace are never posted to automatically (their rules): the listing's share kit is for them. Until Meta
 * approves getproperty's app the API answers "not available" (O-029) and the page says so.
 */
export async function FacebookPageView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.growth.facebook");
  const { api, locale, me } = context;
  const pages = await section(unwrap(api.GET("/v1/owner/social-channels")));
  const manage = ownerCan(me, "tenant.settings.update") && !readOnly(me);
  const page = pages.data?.find((one) => one.state !== "revoked") ?? null;
  return (
    <OwnerPage testId="facebook-page">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={manage && pages.data ? <ConnectFacebookPage replacing={page !== null} /> : null}
      />
      <SettingsNav me={me} current="/settings/facebook-page" locale={locale} />
      {!pages.data ? (
        <SectionError error={pages.error} />
      ) : !page ? (
        <Card>
          <EmptyState icon={IconLink} title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <Card className="flex flex-col gap-4" data-testid="facebook-page-card" data-state={page.state}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-lg font-semibold" data-testid="facebook-page-name">
                {page.pageName ?? t("unnamed")}
              </span>
              <span className="text-muted font-mono text-sm">{t("pageIdValue", { id: page.pageId })}</span>
            </div>
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={page.autoPost ? "info" : "neutral"} size="sm">
                {page.autoPost ? t("autoPostOn") : t("autoPostOff")}
              </Badge>
              <StatusBadgeOf map={SOCIAL_CHANNEL_STATUS} value={page.state} size="sm" />
            </span>
          </div>
          {page.state === "failing" ? (
            <Callout tone="danger" title={t("failingTitle")}>
              <span className="flex flex-col gap-1">
                <span data-testid="facebook-page-error">{page.lastError ?? t("noReason")}</span>
                <span>{t("failingHint")}</span>
              </span>
            </Callout>
          ) : null}
          <DescriptionList
            columns={2}
            items={[
              {
                id: "connected",
                term: t("connectedAt"),
                description: formatDateTime(page.createdAt, locale),
              },
              {
                id: "checked",
                term: t("checkedAt"),
                description: page.lastCheckedAt ? formatDateTime(page.lastCheckedAt, locale) : "—",
              },
            ]}
          />
          {manage ? (
            <div className="flex flex-wrap gap-2">
              <VerifyFacebookPage page={page} />
              <RevokeFacebookPage page={page} />
            </div>
          ) : null}
        </Card>
      )}

      <Card className="flex flex-col gap-3" data-testid="facebook-how">
        <h2 className="text-lg font-semibold">{t("how.title")}</h2>
        <ol className="m-0 flex list-decimal flex-col gap-2 ps-5">
          {(["step1", "step2", "step3", "step4"] as const).map((step) => (
            <li key={step}>{t(`how.${step}`)}</li>
          ))}
        </ol>
        <p className="text-muted m-0 text-sm">{t("what")}</p>
        <Callout tone="info" title={t("groupsTitle")}>
          <span>
            {t("groupsBody")}{" "}
            <a href={ownerPath(locale, "/listings")} className="font-medium underline">
              {t("groupsLink")}
            </a>
          </span>
        </Callout>
        <p className="text-muted m-0 text-xs">{t("tokenSafety")}</p>
      </Card>
    </OwnerPage>
  );
}
