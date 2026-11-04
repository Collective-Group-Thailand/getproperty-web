import { getTranslations } from "next-intl/server";

import { SOCIAL_CHANNEL_STATUS } from "@/domain/status";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Avatar } from "@/ui/components/Avatar";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconLink } from "@/ui/icons/glyphs/link";

import { SettingsCard, SettingsFrame } from "../settings/SettingsNav";
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
  const steps = (["step1", "step2", "step3", "step4"] as const).map((step) => t(`how.${step}`));
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/facebook-page"
      title={t("title")}
      description={t("description")}
      testId="facebook-page"
    >
      {!pages.data ? (
        <SectionError error={pages.error} />
      ) : !page ? (
        <section
          aria-labelledby="facebook-status"
          className="rounded-card border-border bg-surface shadow-card flex flex-col gap-4 border p-5 md:flex-row md:items-center md:justify-between md:p-6"
          data-testid="facebook-status"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex flex-wrap items-center gap-3">
              <h2 id="facebook-status" className="text-lg font-semibold">
                {t("statusTitle")}
              </h2>
              <Badge tone="neutral" icon={IconLink}>
                {t("empty")}
              </Badge>
            </span>
            <p className="text-muted text-base">{t("emptyHint")}</p>
          </div>
          {manage ? (
            <div className="shrink-0">
              <ConnectFacebookPage replacing={false} />
            </div>
          ) : null}
        </section>
      ) : (
        <article
          className="rounded-card border-border bg-surface shadow-card flex flex-col border"
          data-testid="facebook-page-card"
          data-state={page.state}
        >
          <div className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={page.pageName ?? t("unnamed")} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-lg font-semibold" data-testid="facebook-page-name">
                    {page.pageName ?? t("unnamed")}
                  </span>
                  <span className="text-muted text-sm tabular-nums">{t("pageIdValue", { id: page.pageId })}</span>
                </div>
              </div>
              <StatusBadgeOf map={SOCIAL_CHANNEL_STATUS} value={page.state} />
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
              layout="rows"
              items={[
                {
                  id: "autoPost",
                  term: t("autoPost"),
                  description: page.autoPost ? t("autoPostOnShort") : t("autoPostOffShort"),
                },
                { id: "connected", term: t("connectedAt"), description: formatDateTime(page.createdAt, locale) },
                {
                  id: "checked",
                  term: t("checkedAt"),
                  description: page.lastCheckedAt ? formatDateTime(page.lastCheckedAt, locale) : null,
                },
              ]}
            />
          </div>
          {manage ? (
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3 md:px-6">
              <ConnectFacebookPage replacing />
              <VerifyFacebookPage page={page} />
              <RevokeFacebookPage page={page} />
            </div>
          ) : null}
        </article>
      )}

      <SettingsCard id="facebook-how-title" testId="facebook-how" title={t("how.title")} description={t("what")}>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span
                aria-hidden="true"
                className="border-border-strong text-fg grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <span className="text-base">{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-muted mt-5 text-sm">{t("tokenSafety")}</p>
        <section
          aria-labelledby="facebook-groups"
          className="bg-info-subtle text-info-subtle-fg rounded-control mt-5 flex gap-3 px-4 py-3"
        >
          <Icon icon={IconInfo} className="mt-1 shrink-0" />
          <div className="flex flex-col gap-1">
            <h3 id="facebook-groups" className="font-semibold">
              {t("groupsTitle")}
            </h3>
            <p className="text-sm">
              {t("groupsBody")}{" "}
              <a href={ownerPath(locale, "/listings")} className="font-medium underline underline-offset-4">
                {t("groupsLink")}
              </a>
            </p>
          </div>
        </section>
      </SettingsCard>
    </SettingsFrame>
  );
}
