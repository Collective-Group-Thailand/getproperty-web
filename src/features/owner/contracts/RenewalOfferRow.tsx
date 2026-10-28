import { useTranslations } from "next-intl";

import { RENEWAL_OFFER_STATUS } from "@/domain/status";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { WithdrawOffer } from "./RenewalActions";

/**
 * One renewal offer (G3): current → offered rent, the suggestion and its source, term, start, answer-by date, the
 * resident's answer (decline reason, the renewal lease) and the letter sent with it. Shared by the renewals page and
 * the lease page.
 */
export function RenewalOfferRow({
  offer,
  locale,
  label,
  canManage,
}: {
  offer: Schemas["RenewalOfferDto"];
  locale: Locale;
  /** Unit and lessee, when the page knows them. */
  label?: { unitNo: string; lesseeName?: string | null };
  canManage: boolean;
}) {
  const t = useTranslations("owner.contracts");
  const unitNo = label?.unitNo ?? "—";
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 md:px-5"
      data-testid="renewal-row"
      data-state={offer.state}
      data-lease={offer.leaseId}
    >
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          {label ? (
            <a
              className="font-semibold underline-offset-4 hover:underline"
              href={ownerPath(locale, `/leases/${offer.leaseId}`)}
            >
              {[label.unitNo, label.lesseeName].filter(Boolean).join(" · ")}
            </a>
          ) : null}
          <StatusBadgeOf map={RENEWAL_OFFER_STATUS} value={offer.state} size="sm" />
        </span>
        <span className="tabular-nums" data-testid="renewal-rents">
          {t("renewals.rents", {
            current: formatTHB(offer.currentRent, locale),
            offered: formatTHB(offer.offeredRent, locale),
          })}
        </span>
        {offer.suggestedRent ? (
          <span className="text-muted">
            {t("renewals.suggestedLine", {
              rent: formatTHB(offer.suggestedRent, locale),
              source: t(`rentSource.${offer.suggestionSource}`),
            })}
          </span>
        ) : null}
        <span className="text-muted">
          {t("renewals.term", {
            months: offer.months,
            start: formatDate(offer.startDate, locale),
            respondBy: formatDate(offer.respondBy, locale),
          })}
        </span>
        {offer.decidedAt ? (
          <span className="text-muted">{t("renewals.decidedOn", { date: formatDate(offer.decidedAt, locale) })}</span>
        ) : null}
        {offer.declineReason ? (
          <span className="text-muted">{t("renewals.declineReason", { reason: offer.declineReason })}</span>
        ) : null}
        {offer.message ? <span className="text-muted italic">{t("quote", { text: offer.message })}</span> : null}
        {offer.newLeaseId ? (
          <a className="underline-offset-4 hover:underline" href={ownerPath(locale, `/leases/${offer.newLeaseId}`)}>
            {t("renewals.newLease")}
          </a>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {offer.noticeId ? (
          <DocumentButton
            document={{ kind: "leaseNotice", id: offer.noticeId }}
            label={t("renewals.letter")}
            title={t("renewals.letterTitle", { unitNo })}
          />
        ) : null}
        {canManage && offer.nextActions.includes("withdraw") ? (
          <WithdrawOffer offerId={offer.id} unitNo={unitNo} />
        ) : null}
      </div>
    </li>
  );
}
