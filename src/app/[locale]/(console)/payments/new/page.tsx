import { getTranslations, setRequestLocale } from "next-intl/server";

import { ManualPaymentForm } from "@/features/owner/payments/ManualPaymentForm";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, ownerContext, param } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

const OPEN: Schemas["InvoiceStatus"][] = ["overdue", "partially_paid", "issued"];

export async function generateMetadata() {
  const t = await getTranslations("owner.payments.manual");
  return { title: t("title") };
}

/** Record a cash or bank-transfer payment (F2 2.4); `?invoice=` / `?party=` preselect. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const context = await ownerContext();
  const t = await getTranslations("owner.payments.manual");
  const building = focusedBuilding(context);
  const partyId = param(query.party);
  const lists = await Promise.all(
    OPEN.map((status) =>
      unwrap(
        context.api.GET("/v1/owner/invoices", {
          params: { query: { status, partyId, buildingId: building?.id, perPage: 100 } },
        }),
      )
        .then((page) => page.data)
        .catch(() => []),
    ),
  );
  return (
    <OwnerPage testId="payment-new">
      <PageHeader title={t("title")} description={t("description")} crumbs={[{ label: t("title") }]} />
      <ManualPaymentForm invoices={lists.flat()} initialInvoiceId={param(query.invoice)} />
    </OwnerPage>
  );
}
