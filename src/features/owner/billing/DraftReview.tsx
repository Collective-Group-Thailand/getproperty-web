"use client";

import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState } from "react";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Spinner } from "@/ui/components/Spinner";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";
import { IconChevronUp } from "@/ui/icons/glyphs/chevron-up";

import { InvoiceFlags } from "../invoices/InvoiceFlags";
import { InvoiceLines } from "../invoices/InvoiceLines";
import { segmentPhotos } from "../invoices/photos";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ownerPath } from "../shared/links";
import { useIdempotencyKey } from "@/features/shared/console/useApiAction";

type Draft = Schemas["InvoiceSummaryDto"];

/**
 * The computed drafts of a cycle for review (F2 2.3): unit, resident, flags, the API's totals; each row
 * opens its lines (sources, registers with their reading source and photo, caps, estimates) and takes a
 * one-off charge (`POST /invoice-charges`, then `…/actions/recompute` so the draft shows it).
 */
export function DraftReview({ drafts }: { drafts: Draft[] }) {
  const t = useTranslations("owner.billing.review");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState<
    Record<string, { invoice: Schemas["InvoiceDto"]; photos: Record<string, string> } | "loading" | "failed">
  >({});

  const toggle = async (draft: Draft) => {
    if (open[draft.id]) {
      setOpen(({ [draft.id]: _closed, ...rest }) => rest);
      return;
    }
    setOpen((current) => ({ ...current, [draft.id]: "loading" }));
    try {
      const invoice = await unwrap(
        browserApi().GET("/v1/owner/invoices/{invoiceId}", { params: { path: { invoiceId: draft.id } } }),
      );
      const photos = await segmentPhotos(browserApi(), invoice.unitId, invoice.lines);
      setOpen((current) => ({ ...current, [draft.id]: { invoice, photos } }));
    } catch {
      setOpen((current) => ({ ...current, [draft.id]: "failed" }));
    }
  };

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm" data-testid="draft-table">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="border-border text-muted border-b">
            <th scope="col" className="py-2 text-start font-medium">
              {t("unit")}
            </th>
            <th scope="col" className="py-2 text-start font-medium">
              {t("resident")}
            </th>
            <th scope="col" className="py-2 text-start font-medium">
              {t("flags")}
            </th>
            <th scope="col" className="py-2 text-end font-medium">
              {t("total")}
            </th>
            <th scope="col" className="py-2 text-end font-medium">
              {t("amountDue")}
            </th>
            <th scope="col" className="py-2">
              <span className="sr-only">{t("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((draft) => {
            const state = open[draft.id];
            return (
              <Fragment key={draft.id}>
                <tr className="border-border border-b align-top" data-testid="draft-row" data-unit={draft.unitNo ?? ""}>
                  <th scope="row" className="py-2 text-start font-mono font-semibold">
                    <a className="underline-offset-4 hover:underline" href={ownerPath(locale, `/invoices/${draft.id}`)}>
                      {draft.unitNo ?? "—"}
                    </a>
                  </th>
                  <td className="py-2">{draft.billedPartyName}</td>
                  <td className="py-2">
                    <InvoiceFlags invoice={draft} />
                  </td>
                  <td className="py-2 text-end tabular-nums">{formatTHB(draft.total, locale)}</td>
                  <td className="py-2 text-end tabular-nums">{formatTHB(draft.amountDue, locale)}</td>
                  <td className="py-2 text-end">
                    <span className="flex justify-end gap-1">
                      {draft.unitId ? <AddChargeButton draft={draft} /> : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        iconEnd={state ? IconChevronUp : IconChevronDown}
                        aria-expanded={Boolean(state)}
                        aria-controls={`lines-${draft.id}`}
                        onClick={() => void toggle(draft)}
                        data-testid="draft-expand"
                      >
                        {t("lines")}
                      </Button>
                    </span>
                  </td>
                </tr>
                {state ? (
                  <tr className="border-border bg-bg-subtle border-b" id={`lines-${draft.id}`}>
                    <td colSpan={6} className="p-3">
                      {state === "loading" ? (
                        <Spinner label={t("loading")} />
                      ) : state === "failed" ? (
                        <p className="text-muted">{t("failed")}</p>
                      ) : (
                        <InvoiceLines
                          lines={state.invoice.lines}
                          photos={state.photos}
                          locale={locale}
                          testId="draft-lines"
                        />
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A one-off charge or discount on the next invoice of a unit (D-193), applied to this draft at once. */
function AddChargeButton({ draft }: { draft: Draft }) {
  const t = useTranslations("owner.billing.charge");
  const idempotency = useIdempotencyKey();
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      size="sm"
      variant="ghost"
      testId="add-charge"
      title={t("title", { unit: draft.unitNo ?? "" })}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("added")}
      onSubmit={async (data) => {
        await unwrap(
          browserApi().POST("/v1/owner/invoice-charges", {
            params: { header: { "Idempotency-Key": idempotency.key } },
            body: {
              unitId: draft.unitId!,
              leaseId: draft.leaseId ?? undefined,
              partyId: draft.billedPartyId,
              lineKind: (text(data, "lineKind") ?? "one_off") as Schemas["InvoiceChargeKind"],
              description: text(data, "description") ?? "",
              unitPrice: text(data, "unitPrice") ?? "",
              quantity: text(data, "quantity"),
            },
          }),
        );
        idempotency.renew();
        return unwrap(
          browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/recompute", {
            params: { path: { invoiceId: draft.id } },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("kind")}>
            <NativeSelect
              name="lineKind"
              options={[
                { value: "one_off", label: t("oneOff") },
                { value: "discount", label: t("discount") },
              ]}
            />
          </Field>
          <Field label={t("description")} required error={errors.description}>
            <Input name="description" required data-testid="charge-description" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("unitPrice")} required hint={t("unitPriceHint")} error={errors.unitPrice}>
              <Input name="unitPrice" inputMode="decimal" required data-testid="charge-price" />
            </Field>
            <Field label={t("quantity")} hint={t("quantityHint")} error={errors.quantity}>
              <Input name="quantity" inputMode="decimal" />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}
