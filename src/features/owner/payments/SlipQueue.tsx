import { getTranslations } from "next-intl/server";

import { SLIP_STATUS, SLIP_VALUES } from "@/domain/status/slip";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { param, type OwnerContext } from "../shared/server";
import { heldCount } from "./counts";
import { PaymentsTabs } from "./PaymentsTabs";
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
  const heldPromise = heldCount(api);
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
  const held = await heldPromise;
  const selectedId = param(searchParams.slip) ?? list.data[0]?.id;
  const selected = list.data.find((slip) => slip.id === selectedId) ?? null;
  const href = (slipId: string) =>
    ownerPath(locale, withQuery("/payments/slips", { status: param(searchParams.status), slip: slipId }));

  return (
    <OwnerPage testId="slips">
      <PageHeader title={t("title")} description={t("description")} back={null} />
      <ListToolbar
        tabs={<PaymentsTabs current="/payments/slips" locale={locale} slips={pendingCount} held={held} />}
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              {
                name: "status",
                label: t("status"),
                type: "select",
                fallback: "pending_review",
                options: SLIP_VALUES.map((value) => ({ value, label: status(value) })),
              },
            ]}
          />
        }
      />
      {list.data.length === 0 ? (
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
        <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <ul
            className="divide-border border-border bg-surface rounded-card shadow-card divide-y overflow-hidden border lg:row-span-2 xl:row-span-1"
            data-testid="slip-list"
            aria-label={t("title")}
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
            <>
              <Card as="section" aria-labelledby="slip-title" data-testid="slip-detail" className="min-w-0">
                <CardHeader
                  title={
                    <span id="slip-title">
                      {t("detailTitle", { unit: selected.unitNo ?? "—", invoice: selected.invoiceNumber ?? "—" })}
                    </span>
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
                {selected.reasons.includes("possible_qr_duplicate") ? (
                  <div className="mb-4" data-testid="slip-qr-duplicate">
                    <Callout tone="warning" title={t("qrDuplicateTitle")}>
                      {t("qrDuplicateBody")}
                    </Callout>
                  </div>
                ) : null}
                {selected.imageUrl ? (
                  <SlipImage
                    src={selected.imageUrl}
                    alt={t("imageAlt", { payer: selected.payerName, unit: selected.unitNo ?? "—" })}
                  />
                ) : (
                  <p className="text-muted text-sm">{t("noImage")}</p>
                )}
              </Card>

              {/* The decision panel: what was read against what the invoice still owes, the consequence in one line,
                  approve (naming the amount) and reject, then the facts read from the slip. The difference is shown
                  only when the API sends it (needs API) — never subtracted here. */}
              <aside
                aria-label={t("decision")}
                className="flex flex-col gap-4 lg:col-start-2 xl:sticky xl:top-6 xl:col-start-auto"
              >
                <Card>
                  <div className="bg-primary-subtle rounded-control flex flex-col gap-1 px-4 py-3">
                    <span className="text-primary-subtle-fg text-sm">{t("amountDetected")}</span>
                    <span className="text-primary text-2xl font-semibold tabular-nums" data-testid="slip-detected">
                      {selected.amountDetected ? formatTHB(selected.amountDetected, locale) : "—"}
                    </span>
                  </div>
                  <dl className="m-0 mt-3 flex flex-col gap-2 px-1 text-sm">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-muted">{t("invoiceBalance")}</dt>
                      <dd className="m-0 font-medium tabular-nums">{formatTHB(selected.invoiceBalance, locale)}</dd>
                    </div>
                  </dl>
                  {selected.nextActions.includes("decide") ? (
                    <p className="text-muted border-border mt-3 border-t px-1 pt-3 text-sm">
                      {selected.reasons.includes("amount_below_due")
                        ? t("consequence.below")
                        : selected.reasons.includes("amount_above_due")
                          ? t("consequence.above")
                          : t("consequence.even")}
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <SlipDecision
                      slip={selected}
                      layout="panel"
                      approveLabel={
                        selected.amountDetected
                          ? t("approveAmount", { amount: formatTHB(selected.amountDetected, locale) })
                          : undefined
                      }
                      detectedLabel={selected.amountDetected ? formatTHB(selected.amountDetected, locale) : "—"}
                    />
                  </div>
                </Card>
                <Card as="section" aria-labelledby="slip-facts">
                  <CardHeader title={<span id="slip-facts">{t("facts")}</span>} />
                  <DescriptionList
                    columns={1}
                    items={[
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
                            className="text-primary underline-offset-4 hover:underline"
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
                                  className="text-primary underline-offset-4 hover:underline"
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
                </Card>
              </aside>
            </>
          ) : null}
        </div>
      )}
    </OwnerPage>
  );
}
