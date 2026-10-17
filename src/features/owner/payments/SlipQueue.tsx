import { getTranslations } from "next-intl/server";

import { SLIP_STATUS, SLIP_VALUES } from "@/domain/status/slip";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { FilterBar } from "../shared/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { MoneyNav } from "../shared/MoneyNav";
import { OwnerPage, PageHeader } from "../shared/PageHeader";
import { param, type OwnerContext } from "../shared/server";
import { SlipDecision, SlipImage } from "./SlipDecision";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The slip review queue (F2 2.4, D-043 / D-198): slips the verifier could not confirm, each with its
 * picture (zoom), what the verification read (amount, sender, receiver account, time, reference), why it
 * needs a person, a duplicate warning, and approve / reject.
 */
export async function SlipQueue({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.payments.slips");
  const status = await getTranslations("status.slip");
  const { api, locale } = context;
  const statusParam = param(searchParams.status) ?? "pending_review";
  const list = await unwrap(
    api.GET("/v1/owner/slip-reviews", {
      params: {
        query: {
          perPage: 50,
          status: SLIP_VALUES.includes(statusParam as Schemas["SlipStatus"])
            ? (statusParam as Schemas["SlipStatus"])
            : undefined,
        },
      },
    }),
  );
  const pendingCount =
    statusParam === "pending_review"
      ? list.meta.total
      : await unwrap(api.GET("/v1/owner/slip-reviews", { params: { query: { status: "pending_review", perPage: 1 } } }))
          .then((page) => page.meta.total)
          .catch(() => undefined);
  const selectedId = param(searchParams.slip) ?? list.data[0]?.id;
  const selected = list.data.find((slip) => slip.id === selectedId) ?? null;
  const href = (slipId: string) =>
    ownerPath(locale, withQuery("/payments/slips", { status: param(searchParams.status), slip: slipId }));

  return (
    <OwnerPage testId="slips" wide>
      <PageHeader title={t("title")} description={t("description")} />
      <MoneyNav
        section="payments"
        current="/payments/slips"
        locale={locale}
        counts={{ "/payments/slips": pendingCount }}
      />
      <FilterBar
        fields={[
          {
            name: "status",
            label: t("status"),
            type: "select",
            options: SLIP_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <ul
            className="divide-border border-border bg-surface rounded-card divide-y self-start border"
            data-testid="slip-list"
          >
            {list.data.map((slip) => (
              <li key={slip.id}>
                <a
                  href={href(slip.id)}
                  aria-current={slip.id === selected?.id ? "true" : undefined}
                  className={
                    slip.id === selected?.id
                      ? "bg-primary-subtle flex flex-col gap-1 px-4 py-3"
                      : "hover:bg-bg-subtle flex flex-col gap-1 px-4 py-3"
                  }
                  data-testid="slip-row"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">{slip.unitNo ?? "—"}</span>
                    <StatusBadgeOf map={SLIP_STATUS} value={slip.status} size="sm" />
                  </span>
                  <span className="text-sm">{slip.payerName}</span>
                  <span className="text-muted text-xs">
                    {formatDateTime(slip.uploadedAt, locale)}
                    {slip.amountDetected ? ` · ${formatTHB(slip.amountDetected, locale)}` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {selected ? (
            <Card as="section" aria-labelledby="slip-title" data-testid="slip-detail">
              <CardHeader
                title={
                  <span id="slip-title">
                    {t("detailTitle", { unit: selected.unitNo ?? "—", invoice: selected.invoiceNumber ?? "—" })}
                  </span>
                }
                action={
                  <SlipDecision
                    slip={selected}
                    detectedLabel={selected.amountDetected ? formatTHB(selected.amountDetected, locale) : "—"}
                  />
                }
              />
              {selected.duplicateOfId ? (
                <div className="mb-4" data-testid="slip-duplicate">
                  <Callout tone="danger" title={t("duplicateTitle")}>
                    {t("duplicateBody")}{" "}
                    <a className="underline" href={href(selected.duplicateOfId)}>
                      {t("duplicateOpen")}
                    </a>
                  </Callout>
                </div>
              ) : null}
              {selected.reasons.length ? (
                <div className="mb-4 flex flex-wrap gap-1" data-testid="slip-reasons">
                  {selected.reasons.map((reason) => (
                    <span key={reason} data-reason={reason}>
                      <Badge tone="warning" size="sm">
                        {t.has(`reason.${reason}` as never) ? t(`reason.${reason}` as never) : reason}
                      </Badge>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
                {selected.imageUrl ? (
                  <SlipImage
                    src={selected.imageUrl}
                    alt={t("imageAlt", { payer: selected.payerName, unit: selected.unitNo ?? "—" })}
                  />
                ) : (
                  <p className="text-muted text-sm">{t("noImage")}</p>
                )}
                <DescriptionList
                  columns={1}
                  items={[
                    {
                      id: "detected",
                      term: t("amountDetected"),
                      description: selected.amountDetected ? (
                        <span data-testid="slip-detected">{formatTHB(selected.amountDetected, locale)}</span>
                      ) : null,
                    },
                    {
                      id: "balance",
                      term: t("invoiceBalance"),
                      description: formatTHB(selected.invoiceBalance, locale),
                    },
                    { id: "sender", term: t("sender"), description: selected.senderName },
                    {
                      id: "receiver",
                      term: t("receiver"),
                      description: selected.receiverAccountMasked ? (
                        <span className="font-mono">{selected.receiverAccountMasked}</span>
                      ) : null,
                    },
                    {
                      id: "time",
                      term: t("slipTime"),
                      description: selected.slipDatetime ? formatDateTime(selected.slipDatetime, locale) : null,
                    },
                    {
                      id: "ref",
                      term: t("transRef"),
                      description: selected.transRef ? <span className="font-mono">{selected.transRef}</span> : null,
                    },
                    {
                      id: "invoice",
                      term: t("invoice"),
                      description: (
                        <a
                          className="underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/invoices/${selected.invoiceId}`)}
                        >
                          {selected.invoiceNumber ?? "—"}
                        </a>
                      ),
                    },
                    ...(selected.rejectReason
                      ? [{ id: "rejected", term: t("rejectReason"), description: selected.rejectReason }]
                      : []),
                    ...(selected.paymentId
                      ? [
                          {
                            id: "payment",
                            term: t("payment"),
                            description: (
                              <a
                                className="underline-offset-4 hover:underline"
                                href={ownerPath(locale, `/payments/${selected.paymentId}`)}
                                data-testid="slip-payment"
                              >
                                {t("openPayment")}
                              </a>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </OwnerPage>
  );
}
