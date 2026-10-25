"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { LazyDialog } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheck } from "@/ui/icons/glyphs/check";

/** The maker (D-254, D-091): a new version from today on (`POST /v1/admin/messaging-rates`, Idempotency-Key). */
export function EnterMessagingRate({ today }: { today: string }) {
  const t = useTranslations("admin.billing.messaging");
  const common = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = useApiAction<Schemas["MessagingRateDto"]>({ refresh: false });
  const idempotency = useIdempotencyKey();
  const close = () => {
    setOpen(false);
    idempotency.renewUnless(action.unansweredAttempt());
    router.refresh();
  };
  return (
    <>
      <Button
        iconStart={IconAdd}
        onClick={() => {
          action.reset();
          setOpen(true);
        }}
        data-testid="messaging-rate-enter"
      >
        {t("enter")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={t("enterTitle")}
        description={t("enterHint")}
        closeLabel={common("close")}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={action.busy}>
              {common("cancel")}
            </Button>
            <Button type="submit" form="messaging-rate-form" loading={action.busy} data-testid="messaging-rate-save">
              {t("save")}
            </Button>
          </>
        }
      >
        <form
          id="messaging-rate-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void action.run(
              () =>
                unwrap(
                  browserApi().POST("/v1/admin/messaging-rates", {
                    params: { header: { "Idempotency-Key": idempotency.key } },
                    body: {
                      effectiveFrom: text(data, "effectiveFrom") ?? today,
                      freePerTenant: Number(text(data, "freePerTenant") ?? "0"),
                      freePerUnit: Number(text(data, "freePerUnit") ?? "0"),
                      pricePerMessage: text(data, "pricePerMessage") ?? "",
                      vatPercent: text(data, "vatPercent") ?? "",
                      notes: text(data, "notes"),
                    },
                  }),
                ),
              () => {
                toast.success(t("saved"));
                close();
              },
            );
          }}
        >
          <Field label={t("effectiveFrom")} required>
            <Input name="effectiveFrom" type="date" min={today} defaultValue={today} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("freePerTenant")} required>
              <Input
                name="freePerTenant"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                required
                data-testid="messaging-rate-free-tenant"
              />
            </Field>
            <Field label={t("freePerUnit")}>
              <Input name="freePerUnit" type="number" min={0} step={1} inputMode="numeric" defaultValue={0} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("price")} required>
              <Input
                name="pricePerMessage"
                inputMode="decimal"
                pattern="\d{1,5}(\.\d{1,4})?"
                required
                data-testid="messaging-rate-price"
              />
            </Field>
            <Field label={t("vat")} required>
              <Input name="vatPercent" inputMode="decimal" defaultValue="7.00" required />
            </Field>
          </div>
          <Field label={t("notes")}>
            <Input name="notes" maxLength={300} />
          </Field>
          <ProblemNotice error={action.error} />
        </form>
      </LazyDialog>
    </>
  );
}

/** The checker: another platform user publishes (`messaging_rate.same_checker` otherwise). */
export function PublishMessagingRate({ rate }: { rate: Schemas["MessagingRateDto"] }) {
  const t = useTranslations("admin.billing.messaging");
  const locale = useLocale() as Locale;
  return (
    <ConfirmAction
      label={t("publish")}
      icon={IconCheck}
      size="sm"
      testId={`messaging-rate-publish-${rate.id}`}
      title={t("publishTitle", { date: formatDate(rate.effectiveFrom, locale) })}
      description={t("publishBody", {
        tenant: rate.freePerTenant,
        unit: rate.freePerUnit,
        price: rate.pricePerMessage,
        vat: rate.vatPercent,
      })}
      confirmLabel={t("publish")}
      successMessage={t("published")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/admin/messaging-rates/{rateId}/actions/publish", {
            params: { path: { rateId: rate.id } },
          }),
        )
      }
    />
  );
}
