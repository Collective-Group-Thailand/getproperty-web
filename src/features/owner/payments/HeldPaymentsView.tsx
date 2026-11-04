import { getTranslations } from "next-intl/server";

import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { HeldPaymentActions } from "./HeldPaymentActions";
import { heldPayments, slipsToReview } from "./counts";
import { PaymentsTabs } from "./PaymentsTabs";

/** Why the API held it, as one sentence for the office (D-220). */
export async function HeldNotice({ payment, locale }: { payment: Schemas["PaymentDto"]; locale: Locale }) {
  const t = await getTranslations("owner.payments.held");
  if (!payment.heldReason) return null;
  return (
    <Callout tone="warning" title={t(`reason.${payment.heldReason}.title`)} className="w-full">
      <p data-testid="held-reason" data-reason={payment.heldReason}>
        {t(`reason.${payment.heldReason}.body`)}
      </p>
      {payment.duplicateOfPaymentId ? (
        <p className="mt-1">
          <a
            className="font-medium underline underline-offset-4"
            href={ownerPath(locale, `/payments/${payment.duplicateOfPaymentId}`)}
            data-testid="held-duplicate-of"
          >
            {t("duplicateOf")}
          </a>
        </p>
      ) : null}
      <p className="mt-1">{t("neverBooked")}</p>
    </Callout>
  );
}

/**
 * "Payments to check" (D-220, G3): a view of the payments section — each held payment as one review row: what came
 * in, why the API held it (and the payment it may repeat), confirm / dismiss beside it.
 */
export async function HeldPaymentsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.payments.held");
  const methods = await getTranslations("owner.invoices.method");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const [held, slips] = await Promise.all([heldPayments(api, building?.id), slipsToReview(api)]);
  const canDecide = ownerCan(me, "payment.record") && !readOnly(me);
  return (
    <OwnerPage testId="held-payments">
      <PageHeader title={t("title")} description={t("description")} back={null} />
      <ListToolbar tabs={<PaymentsTabs current="/payments/held" locale={locale} slips={slips} held={held.length} />} />
      {held.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/payments")}>{t("empty.back")}</a>
            </Button>
          }
        />
      ) : (
        <ul
          className="rounded-card border-border bg-surface shadow-card divide-border divide-y border"
          data-testid="held-list"
          aria-label={t("title")}
        >
          {held.map((payment) => {
            const amount = formatTHB(payment.amount, locale);
            return (
              <li
                key={payment.id}
                className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:px-6"
                data-testid="held-row"
                data-payment={payment.id}
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <a
                      className="w-fit text-lg font-semibold tabular-nums underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/payments/${payment.id}`)}
                    >
                      {amount}
                    </a>
                    <span className="text-muted text-sm">
                      {[
                        methods(payment.method),
                        payment.unitNo,
                        payment.payerName,
                        formatDateTime(payment.paidAt, locale),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {payment.providerRef ? (
                      <span className="text-muted font-mono text-xs">{payment.providerRef}</span>
                    ) : null}
                  </div>
                  <HeldNotice payment={payment} locale={locale} />
                </div>
                {canDecide ? (
                  <div className="md:pt-1">
                    <HeldPaymentActions payment={payment} amountLabel={amount} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {!canDecide && held.length > 0 ? <p className="text-muted text-sm">{t("noPermission")}</p> : null}
    </OwnerPage>
  );
}
