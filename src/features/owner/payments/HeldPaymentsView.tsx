import { getTranslations } from "next-intl/server";

import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerPath } from "../shared/links";
import { MoneyNav } from "../shared/MoneyNav";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { HeldPaymentActions } from "./HeldPaymentActions";
import { heldPayments, slipsToReview } from "./counts";

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

/** "Payments to check" (D-220): each held payment with its reason, the payment it may repeat, confirm / dismiss. */
export async function HeldPaymentsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.payments.held");
  const methods = await getTranslations("owner.invoices.method");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const [held, slips] = await Promise.all([heldPayments(api, building?.id), slipsToReview(api)]);
  const canDecide = ownerCan(me, "payment.record") && !readOnly(me);
  return (
    <OwnerPage testId="held-payments">
      <PageHeader title={t("title")} description={t("description")} />
      <MoneyNav
        section="payments"
        current="/payments/held"
        locale={locale}
        counts={{ "/payments/slips": slips, "/payments/held": held.length }}
      />
      {held.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="held-list">
          {held.map((payment) => {
            const amount = formatTHB(payment.amount, locale);
            return (
              <li key={payment.id}>
                <Card className="flex flex-col gap-3" data-testid="held-row" data-payment={payment.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <a
                        className="text-lg font-semibold underline-offset-4 hover:underline"
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
                    {canDecide ? <HeldPaymentActions payment={payment} amountLabel={amount} /> : null}
                  </div>
                  <HeldNotice payment={payment} locale={locale} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {!canDecide && held.length > 0 ? <p className="text-muted text-sm">{t("noPermission")}</p> : null}
    </OwnerPage>
  );
}
