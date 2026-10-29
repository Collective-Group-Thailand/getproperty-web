import { getTranslations } from "next-intl/server";

import { RENTAL_HANDOFF_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { handoffPlace, plausibleHandoffToken, suggestedHandoffTitle } from "@/features/shared/growth/handoff";
import { formatDate, formatDecimal } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHome } from "@/ui/icons/glyphs/home";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";
import { HandoffClaimForm } from "./HandoffClaimForm";

/**
 * Units handed over from getbuild (G8, D-299): each claimed invitation with its unit, developer campaign, the listing
 * draft it created and whether that listing is published yet. Invitations arrive through getbuild's buyer portal,
 * never by getproperty contacting the buyer.
 */
export async function HandoffsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.network.handoffs");
  const { api, locale } = context;
  const handoffs = await section(unwrap(api.GET("/v1/owner/rental-handoffs")));
  return (
    <OwnerPage testId="handoffs">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("crumb"), href: ownerPath(locale, "/listings") }, { label: t("title") }]}
      />
      {!handoffs.data ? (
        <SectionError error={handoffs.error} />
      ) : handoffs.data.data.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={IconBuilding} title={t("empty.title")} description={t("empty.description")} />
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2" data-testid="handoff-rows">
          {handoffs.data.data.map((handoff) => (
            <HandoffRow key={handoff.id} handoff={handoff} context={context} />
          ))}
        </ul>
      )}
    </OwnerPage>
  );
}

async function HandoffRow({ handoff, context }: { handoff: Schemas["RentalHandoffDto"]; context: OwnerContext }) {
  const t = await getTranslations("owner.network.handoffs");
  const kinds = await getTranslations("owner.network.kind");
  const { locale } = context;
  const facts = handoff.facts;
  return (
    <Card as="li" className="flex flex-col gap-3" data-testid="handoff-row" data-state={handoff.state}>
      <div className="flex items-start gap-3">
        <span className="bg-primary-subtle text-primary-subtle-fg grid size-10 shrink-0 place-items-center rounded-full">
          <Icon icon={IconHome} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">
            {[facts.projectName ?? kinds(facts.kind), facts.unitNo].filter(Boolean).join(" · ")}
          </span>
          <span className="text-muted text-sm">{handoffPlace(facts)}</span>
        </div>
        <StatusBadgeOf map={RENTAL_HANDOFF_STATUS} value={handoff.state} size="sm" />
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">{t("transfer")}</dt>
          <dd className="m-0 font-medium">{formatDate(handoff.transferDate, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("claimed")}</dt>
          <dd className="m-0 font-medium">{handoff.acceptedAt ? formatDate(handoff.acceptedAt, locale) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("listed")}</dt>
          <dd className="m-0 font-medium">{handoff.listedAt ? formatDate(handoff.listedAt, locale) : "—"}</dd>
        </div>
        {facts.areaSqm ? (
          <div>
            <dt className="text-muted">{t("area")}</dt>
            <dd className="m-0 font-medium">{t("sqm", { size: formatDecimal(facts.areaSqm, locale, 1) })}</dd>
          </div>
        ) : null}
        <div className="col-span-2">
          <dt className="text-muted">{t("campaign")}</dt>
          <dd className="m-0">
            <Badge size="sm">{handoff.campaignTag}</Badge>
          </dd>
        </div>
      </dl>
      {handoff.listingId ? (
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            variant={handoff.state === "accepted" ? "primary" : "secondary"}
            iconStart={IconEdit}
          >
            <a href={ownerPath(locale, `/listings/${handoff.listingId}`)} data-testid="handoff-listing">
              {handoff.state === "accepted" ? t("finish") : t("open")}
            </a>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Claim one invitation (G8): the unit as getbuild described it, then the short form. An unknown token, or an
 * invitation already used / declined / expired, is a designed state — never a form that cannot succeed.
 */
export async function HandoffClaimView({ context, token }: { context: OwnerContext; token: string | undefined }) {
  const t = await getTranslations("owner.network.claim");
  const h = await getTranslations("owner.network.handoffs");
  const kinds = await getTranslations("owner.network.kind");
  const { api, locale } = context;
  const crumbs = [
    { label: h("crumb"), href: ownerPath(locale, "/listings") },
    { label: h("title"), href: ownerPath(locale, "/listings/handoffs") },
    { label: t("title") },
  ];
  const result = plausibleHandoffToken(token)
    ? await section(unwrap(api.GET("/v1/public/handoffs/{token}", { params: { path: { token } } })))
    : null;
  const handoff = result?.data ?? null;

  if (!handoff) {
    const missing = !result || (isApiError(result.error) && result.error.status === 404);
    return (
      <OwnerPage testId="handoff-claim">
        <PageHeader title={t("title")} crumbs={crumbs} />
        {missing ? (
          <div data-testid="handoff-claim-unknown">
            <Callout tone="warning" title={t("unknown.title")}>
              {t("unknown.body")}
            </Callout>
          </div>
        ) : (
          <SectionError error={result.error} />
        )}
      </OwnerPage>
    );
  }

  const facts = handoff.facts;
  const title = suggestedHandoffTitle(facts, {
    kind: kinds(facts.kind),
    bedrooms: (count) => t("suggest.bedrooms", { count }),
    area: (size) => t("suggest.area", { size }),
  });
  return (
    <OwnerPage testId="handoff-claim">
      <PageHeader title={t("title")} description={t("description")} crumbs={crumbs} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card as="section" aria-labelledby="claim-form" className="flex flex-col gap-4">
          <CardHeader title={<span id="claim-form">{t("formTitle")}</span>} description={t("formHint")} />
          {handoff.state === "invited" ? (
            token ? (
              <HandoffClaimForm token={token} facts={facts} suggestedTitle={title} />
            ) : null
          ) : (
            <div data-testid="handoff-claim-closed">
              <Callout tone="neutral" title={t(`closed.${handoff.state}`)}>
                {t("closedBody")}
              </Callout>
            </div>
          )}
        </Card>
        <Card as="section" aria-labelledby="claim-unit" className="flex flex-col gap-3">
          <CardHeader title={<span id="claim-unit">{t("unitTitle")}</span>} description={t("unitSource")} />
          <dl className="m-0 flex flex-col gap-2 text-sm" data-testid="handoff-claim-facts">
            {(
              [
                [t("facts.project"), facts.projectName],
                [t("facts.unit"), facts.unitNo],
                [t("facts.kind"), kinds(facts.kind)],
                [t("facts.floor"), facts.floorLabel],
                [t("facts.area"), facts.areaSqm ? h("sqm", { size: formatDecimal(facts.areaSqm, locale, 1) }) : null],
                [
                  t("facts.rooms"),
                  facts.bedrooms !== null
                    ? t("facts.roomsValue", { bedrooms: facts.bedrooms, bathrooms: facts.bathrooms ?? 0 })
                    : null,
                ],
                [t("facts.place"), handoffPlace(facts) || null],
                [t("facts.transfer"), formatDate(handoff.transferDate, locale)],
                [t("facts.expires"), formatDate(handoff.expiresAt, locale)],
              ] as [string, string | null][]
            )
              .filter((row): row is [string, string] => !!row[1])
              .map(([term, value]) => (
                <div key={term} className="flex justify-between gap-3">
                  <dt className="text-muted">{term}</dt>
                  <dd className="m-0 text-end font-medium">{value}</dd>
                </div>
              ))}
          </dl>
        </Card>
      </div>
    </OwnerPage>
  );
}
