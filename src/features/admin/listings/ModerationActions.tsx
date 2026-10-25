"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { LazyDialog } from "@/ui/components/overlays";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Spinner } from "@/ui/components/Spinner";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconShow } from "@/ui/icons/glyphs/show";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

type Listing = Schemas["AdminListingDto"];

/**
 * A moderator's choices for one listing (F6.5, D-252), offered by state: approve a listing in review; reject with a
 * reason the owner reads; hide a public listing pending a decision; restore a hidden one (its open reports are
 * dismissed). The API checks every transition again.
 */
export function ListingModerationActions({ listing }: { listing: Listing }) {
  const t = useTranslations("admin.listings");
  const path = (key: string) => ({ params: { path: { listingId: listing.id }, header: { "Idempotency-Key": key } } });
  const live = listing.state === "published" || listing.state === "paused";
  return (
    <div className="flex flex-wrap gap-1">
      {listing.state === "pending_review" ? (
        <ConfirmAction
          label={t("approve")}
          icon={IconCheckCircle}
          size="sm"
          testId="moderation-approve"
          title={t("approveTitle", { title: listing.titleTh })}
          description={t("approveBody")}
          confirmLabel={t("approve")}
          successMessage={t("approved")}
          onConfirm={(key) => unwrap(browserApi().POST("/v1/admin/listings/{listingId}/actions/approve", path(key)))}
        />
      ) : null}
      {listing.hiddenAt ? (
        <ConfirmAction
          label={t("restore")}
          icon={IconShow}
          size="sm"
          testId="moderation-restore"
          title={t("restoreTitle", { title: listing.titleTh })}
          description={t("restoreBody")}
          confirmLabel={t("restore")}
          successMessage={t("restored")}
          onConfirm={(key) => unwrap(browserApi().POST("/v1/admin/listings/{listingId}/actions/restore", path(key)))}
        />
      ) : null}
      {live && !listing.hiddenAt ? (
        <FormDialog
          label={t("hide")}
          icon={IconHide}
          size="sm"
          testId="moderation-hide"
          title={t("hideTitle", { title: listing.titleTh })}
          description={t("hideHint")}
          submitLabel={t("hide")}
          successMessage={t("hidden")}
          onSubmit={(data, _ack, key) =>
            unwrap(
              browserApi().POST("/v1/admin/listings/{listingId}/actions/hide", {
                ...path(key),
                body: { reason: text(data, "reason") ?? "" },
              }),
            )
          }
        >
          {(errors) => (
            <Field label={t("reason")} required error={errors.reason}>
              <Textarea name="reason" rows={3} required />
            </Field>
          )}
        </FormDialog>
      ) : null}
      {listing.state === "pending_review" || live ? (
        <FormDialog
          label={t("reject")}
          icon={IconXCircle}
          size="sm"
          testId="moderation-reject"
          title={t("rejectTitle", { title: listing.titleTh })}
          description={t("rejectHint")}
          submitLabel={t("reject")}
          successMessage={t("rejected")}
          onSubmit={(data, _ack, key) =>
            unwrap(
              browserApi().POST("/v1/admin/listings/{listingId}/actions/reject", {
                ...path(key),
                body: { reason: text(data, "reason") ?? "" },
              }),
            )
          }
        >
          {(errors) => (
            <Field label={t("reason")} required error={errors.reason}>
              <Textarea name="reason" rows={3} required data-testid="moderation-reason" />
            </Field>
          )}
        </FormDialog>
      ) : null}
    </div>
  );
}

/**
 * Review one owner verification (F6.5): the evidence opens only when the dialog does (each link is an audited
 * download valid for five minutes), then verify or reject with a note the owner reads.
 */
export function VerificationReview({ verification }: { verification: Schemas["AdminVerificationDto"] }) {
  const t = useTranslations("admin.listings.verification");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Schemas["AdminVerificationDetailDto"] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [note, setNote] = useState("");
  const action = useApiAction();
  const idempotency = useIdempotencyKey();

  useEffect(() => {
    if (!open || detail) return;
    unwrap(
      browserApi().GET("/v1/admin/listing-verifications/{verificationId}", {
        params: { path: { verificationId: verification.id } },
      }),
    ).then(setDetail, setLoadError);
  }, [open, detail, verification.id]);

  const decide = (approve: boolean) =>
    action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/admin/listing-verifications/{verificationId}/actions/decide", {
            params: { path: { verificationId: verification.id }, header: { "Idempotency-Key": idempotency.key } },
            body: { approve, note: note.trim() || null },
          }),
        ),
      () => {
        idempotency.renew();
        setOpen(false);
      },
    );

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} data-testid="verification-open">
        {t("open")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={t("title", { unit: `${verification.buildingName} · ${verification.unitNo}` })}
        description={`${verification.tenantName} · ${t(`kinds.${verification.evidenceKind}`)}`}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              iconStart={IconXCircle}
              loading={action.busy}
              disabled={!note.trim()}
              onClick={() => decide(false)}
              data-testid="verification-reject"
            >
              {t("reject")}
            </Button>
            <Button
              iconStart={IconCheckCircle}
              loading={action.busy}
              onClick={() => decide(true)}
              data-testid="verification-approve"
            >
              {t("approve")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {verification.note ? (
            <p className="text-sm">
              <span className="font-medium">{t("note_")}: </span>
              {verification.note}
            </p>
          ) : null}
          <section className="flex flex-col gap-2" aria-label={t("evidence")}>
            <h3 className="text-sm font-semibold">{t("evidence")}</h3>
            <p className="text-muted text-xs">{t("evidenceHint")}</p>
            {loadError ? <ProblemNotice error={loadError} /> : null}
            {!detail && !loadError ? <Spinner label={t("evidence")} /> : null}
            {detail && detail.evidence.length === 0 ? <p className="text-muted text-sm">{t("noEvidence")}</p> : null}
            {detail ? (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {detail.evidence.map((file, index) => (
                  <li key={file.documentId}>
                    <Button asChild size="sm" variant="secondary" iconStart={IconExternal}>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" data-testid="verification-evidence">
                        {t("file", { index: index + 1 })}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <Field label={t("note")} hint={t("noteRequired")}>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              data-testid="verification-note"
            />
          </Field>
          <ProblemNotice error={action.error} />
        </div>
      </LazyDialog>
    </>
  );
}
