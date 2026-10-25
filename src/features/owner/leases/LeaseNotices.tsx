"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { DocumentButton } from "../shared/DocumentButton";
import { uploadOwnerFile } from "../shared/upload";

type Kind = Schemas["LeaseNoticeKind"];
type Notice = Schemas["LeaseNoticeDto"];
const KINDS: Kind[] = ["renewal_offer", "rent_increase", "late_payment", "non_renewal", "termination"];
const REASONS: Schemas["LessorReason"][] = ["lessee_breach", "disturbance", "unlawful_use", "mutual_agreement"];
/** Which letters the API accepts in a lease status (it checks again). */
const ALLOWED: Record<Kind, Schemas["LeaseStatus"][]> = {
  rent_increase: ["active", "notice_given"],
  renewal_offer: ["active", "notice_given"],
  non_renewal: ["active"],
  termination: ["active"],
  late_payment: ["active", "notice_given", "ending"],
};

/**
 * Written notices to the lessee (B7.5, D-253): the letters already sent, each opening as its PDF, and a dialog to send
 * a new one. The dialog asks only what the chosen letter needs; notice periods, the no-mid-term-increase rule, the
 * overdue amounts and the compliance checks of a termination all come from the API (problems are shown as they come).
 */
export function LeaseNotices({
  lease,
  notices,
  canManage,
}: {
  lease: Pick<Schemas["LeaseDto"], "id" | "status" | "rent" | "months" | "unitId" | "endDate" | "template">;
  notices: Notice[];
  canManage: boolean;
}) {
  const t = useTranslations("owner.leases.notices");
  const locale = useLocale() as Locale;
  const kinds = KINDS.filter((kind) => ALLOWED[kind].includes(lease.status));
  const [kind, setKind] = useState<Kind>(kinds[0] ?? "renewal_offer");
  const [language, setLanguage] = useState<Schemas["Language"]>(lease.template.language);
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const summary = (notice: Notice) =>
    [
      notice.newRent ? t("summary.rent", { amount: formatTHB(notice.newRent, locale) }) : null,
      notice.amountDue ? t("summary.due", { amount: formatTHB(notice.amountDue, locale) }) : null,
      notice.effectiveDate ? t("summary.effective", { date: formatDate(notice.effectiveDate, locale) }) : null,
      notice.respondBy
        ? t(`summary.by.${notice.kind === "late_payment" ? "pay" : "answer"}`, {
            date: formatDate(notice.respondBy, locale),
          })
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Card as="section" aria-labelledby="lease-notices" data-testid="lease-notices">
      <CardHeader
        title={<span id="lease-notices">{t("title")}</span>}
        description={t("description")}
        action={
          canManage && kinds.length ? (
            <FormDialog
              label={t("send")}
              icon={IconMail}
              size="sm"
              testId="notice-send"
              title={t("sendTitle")}
              description={t("sendBody")}
              submitLabel={t("sendSubmit")}
              successMessage={t("sent")}
              onSubmit={async (data, acknowledgementIds, key) => {
                const evidence =
                  kind === "termination" && file
                    ? [(await uploadOwnerFile(file, { kind: "other", scopeType: "unit", scopeId: lease.unitId })).id]
                    : undefined;
                return unwrap(
                  browserApi().POST("/v1/owner/leases/{leaseId}/notices", {
                    params: { path: { leaseId: lease.id }, header: { "Idempotency-Key": key } },
                    body: {
                      kind,
                      language,
                      newRent: kind === "rent_increase" || kind === "renewal_offer" ? text(data, "newRent") : undefined,
                      effectiveDate:
                        kind === "rent_increase" || kind === "termination" ? text(data, "effectiveDate") : undefined,
                      renewalMonths:
                        kind === "renewal_offer" && text(data, "renewalMonths")
                          ? Number(text(data, "renewalMonths"))
                          : undefined,
                      reasonCode:
                        kind === "termination"
                          ? (text(data, "reasonCode") as Schemas["LessorReason"] | undefined)
                          : undefined,
                      message: text(data, "message") ?? null,
                      evidenceDocumentIds: evidence,
                      acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined,
                    },
                  }),
                );
              }}
            >
              {(errors) => (
                <>
                  <Field label={t("kind")} error={errors.kind}>
                    <NativeSelect
                      value={kind}
                      onChange={(event) => setKind(event.target.value as Kind)}
                      options={kinds.map((value) => ({ value, label: t(`kinds.${value}`) }))}
                      data-testid="notice-kind"
                    />
                  </Field>
                  <p className="text-muted text-sm" data-testid="notice-hint">
                    {t(`hints.${kind}`)}
                  </p>
                  {kind === "rent_increase" || kind === "renewal_offer" ? (
                    <Field
                      label={t("newRent")}
                      required={kind === "rent_increase"}
                      hint={t("currentRent", { amount: formatTHB(lease.rent, locale) })}
                      error={errors.newRent}
                    >
                      <Input
                        name="newRent"
                        inputMode="decimal"
                        defaultValue={kind === "renewal_offer" ? lease.rent : ""}
                        data-testid="notice-new-rent"
                      />
                    </Field>
                  ) : null}
                  {kind === "renewal_offer" ? (
                    <Field label={t("months")} error={errors.renewalMonths}>
                      <Input name="renewalMonths" type="number" min={1} max={120} defaultValue={lease.months} />
                    </Field>
                  ) : null}
                  {kind === "rent_increase" || kind === "termination" ? (
                    <Field
                      label={t(kind === "rent_increase" ? "rentFrom" : "endsOn")}
                      required
                      hint={
                        kind === "rent_increase"
                          ? t("rentFromHint", { date: formatDate(lease.endDate, locale) })
                          : undefined
                      }
                      error={errors.effectiveDate}
                    >
                      <Input name="effectiveDate" type="date" data-testid="notice-effective" />
                    </Field>
                  ) : null}
                  {kind === "termination" ? (
                    <>
                      <Field label={t("reason")} required error={errors.reasonCode}>
                        <NativeSelect
                          name="reasonCode"
                          options={REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }))}
                          data-testid="notice-reason"
                        />
                      </Field>
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">{t("evidence")}</span>
                        <p className="text-muted text-sm">{t("evidenceHint")}</p>
                        <input
                          ref={input}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          className="sr-only"
                          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                          aria-label={t("evidence")}
                          tabIndex={-1}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            iconStart={IconUpload}
                            onClick={() => input.current?.click()}
                          >
                            {t("evidence")}
                          </Button>
                          {file ? <span className="text-muted text-sm">{file.name}</span> : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{t("language")}</span>
                    <SegmentedControl
                      label={t("language")}
                      value={language}
                      onValueChange={(value) => setLanguage(value as Schemas["Language"])}
                      options={[
                        { value: "th", label: "ไทย" },
                        { value: "en", label: "English" },
                      ]}
                    />
                  </div>
                  <Field label={t("message")} hint={t("messageHint")} error={errors.message}>
                    <Textarea name="message" rows={3} maxLength={2000} data-testid="notice-message" />
                  </Field>
                </>
              )}
            </FormDialog>
          ) : null
        }
      />
      {notices.length ? (
        <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
          {notices.map((notice) => (
            <li
              key={notice.id}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              data-testid="lease-notice-row"
              data-kind={notice.kind}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t(`kinds.${notice.kind}`)}</p>
                <p className="text-muted text-sm">
                  {[notice.number, formatDate(notice.issuedOn, locale), summary(notice)].filter(Boolean).join(" · ")}
                </p>
              </div>
              {notice.documentId ? (
                <DocumentButton
                  document={{ kind: "leaseNotice", id: notice.id }}
                  label={t("open")}
                  title={`${t(`kinds.${notice.kind}`)} ${notice.number}`}
                  variant="ghost"
                  testId="lease-notice-open"
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">{t("empty")}</p>
      )}
    </Card>
  );
}
