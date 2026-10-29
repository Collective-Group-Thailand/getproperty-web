import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { CampaignRow, HowItWorks, ProductCard, PromoteTabs } from "./BroadcastParts";

type SearchParams = Record<string, string | string[] | undefined>;
const STATES = ["draft", "scheduled", "sending", "sent"] as const;
type StateTab = (typeof STATES)[number] | "all";

/**
 * Promotion › LINE broadcasts (G6, D-300): whether sponsored broadcasts can be bought now (switched on, O-023; priced,
 * O-027) with the API's facts, who receives them and what the buyer sees (totals only), and my campaigns by state.
 * Drafting works while the service is off, so the builder is always reachable for members who manage the
 * subscription.
 */
export async function BroadcastsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.broadcast");
  const growth = await getTranslations("owner.growth");
  const { api, locale, me } = context;
  if (!ownerCan(me, "listing.read")) notFound();
  const raw = param(searchParams.state);
  const tab: StateTab = STATES.includes(raw as (typeof STATES)[number]) ? (raw as StateTab) : "all";
  const [product, campaigns] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/sponsored-campaigns/product"))),
    section(
      unwrap(
        api.GET("/v1/owner/sponsored-campaigns", {
          params: { query: { perPage: 50, ...(tab === "all" ? {} : { state: tab }) } },
        }),
      ),
    ),
  ]);
  const canCreate = ownerCan(me, "tenant.subscription.manage") && !readOnly(me);
  const base = ownerPath(locale, "/promote/broadcasts");
  // The header's action and the empty list's call to action are the same link; each keeps its own test id.
  const newCampaign = (testId: string) =>
    canCreate ? (
      <Button asChild iconStart={IconAdd}>
        <a href={ownerPath(locale, "/promote/broadcasts/new")} data-testid={testId}>
          {t("new")}
        </a>
      </Button>
    ) : null;

  return (
    <OwnerPage testId="broadcasts">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: growth("page.title"), href: ownerPath(locale, "/promote") }, { label: t("tabs.broadcasts") }]}
        actions={newCampaign("broadcast-new")}
      />
      <PromoteTabs locale={locale} current="broadcasts" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {product.data ? <ProductCard product={product.data} locale={locale} /> : <SectionError error={product.error} />}
        <HowItWorks />
      </div>

      <Card as="section" aria-labelledby="broadcast-campaigns" className="flex flex-col gap-4">
        <CardHeader title={<span id="broadcast-campaigns">{t("list.title")}</span>} />
        <LinkTabs
          label={t("list.title")}
          current={tab === "all" ? base : `${base}?state=${tab}`}
          tabs={(["all", ...STATES] as StateTab[]).map((one) => ({
            href: one === "all" ? base : `${base}?state=${one}`,
            label: t(`list.tabs.${one}`),
            testId: `broadcast-tab-${one}`,
          }))}
        />
        {!campaigns.data ? (
          <SectionError error={campaigns.error} />
        ) : campaigns.data.data.length === 0 ? (
          <EmptyState
            icon={IconMegaphone}
            title={t(`list.empty.${tab}`)}
            description={t("list.emptyHint")}
            action={tab === "all" ? newCampaign("broadcast-new-empty") : null}
          />
        ) : (
          <ul className="divide-border m-0 list-none divide-y p-0" data-testid="campaigns">
            {campaigns.data.data.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} locale={locale} />
            ))}
          </ul>
        )}
      </Card>
    </OwnerPage>
  );
}
