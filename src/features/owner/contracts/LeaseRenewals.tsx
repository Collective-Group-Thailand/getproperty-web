import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { IconAdd } from "@/ui/icons/glyphs/add";

import { ownerPath } from "../shared/links";
import { section } from "../shared/server";
import { OfferRenewal } from "./RenewalActions";
import { RenewalOfferRow } from "./RenewalOfferRow";

const ADDENDUM_STATUSES = new Set<Schemas["LeaseStatus"]>(["pending_signature", "active", "notice_given", "ending"]);

/**
 * The lease page's renewal card (G3, D-294): the offers made on this lease, *Offer renewal* while the lease's
 * `nextActions` has `renew` and no offer is open (the suggestion is the API's), and a link to write an addendum on the
 * lease (contract library).
 */
export async function LeaseRenewals({
  api,
  lease,
  locale,
  canManage,
}: {
  api: ApiClient;
  lease: Schemas["LeaseDto"];
  locale: Locale;
  canManage: boolean;
}) {
  const t = await getTranslations("owner.contracts.renewals");
  const path = { leaseId: lease.id };
  const offers = await section(unwrap(api.GET("/v1/owner/leases/{leaseId}/renewal-offers", { params: { path } })));
  const list = offers.data?.data ?? [];
  const open = list.some((offer) => offer.state === "offered");
  const mayOffer = canManage && lease.nextActions.includes("renew") && !open;
  const suggestion = mayOffer
    ? await section(unwrap(api.GET("/v1/owner/leases/{leaseId}/renewal-suggestion", { params: { path } })))
    : null;
  if (!list.length && !mayOffer && !(canManage && ADDENDUM_STATUSES.has(lease.status))) return null;

  return (
    <Card as="section" aria-labelledby="lease-renewal" data-testid="lease-renewal">
      <CardHeader
        title={<span id="lease-renewal">{t("leaseTitle")}</span>}
        description={t("leaseHint")}
        action={
          <span className="flex flex-wrap gap-2">
            {mayOffer ? (
              <OfferRenewal
                leaseId={lease.id}
                unitNo={lease.unitNo}
                months={lease.months}
                language={lease.template.language}
                suggestion={suggestion?.data ?? null}
              />
            ) : null}
            {canManage && ADDENDUM_STATUSES.has(lease.status) ? (
              <Button asChild variant="secondary" size="sm" iconStart={IconAdd}>
                <a
                  href={ownerPath(locale, `/contracts/documents?new=addendum&lease=${lease.id}`)}
                  data-testid="lease-addendum"
                >
                  {t("addendum")}
                </a>
              </Button>
            ) : null}
          </span>
        }
      />
      {list.length ? (
        <ul className="divide-border m-0 -mx-4 list-none divide-y p-0 md:-mx-5">
          {list.map((offer) => (
            <RenewalOfferRow
              key={offer.id}
              offer={offer}
              locale={locale}
              canManage={canManage}
              label={{ unitNo: lease.unitNo }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">{t("none")}</p>
      )}
    </Card>
  );
}
