"use client";

import { useLocale, useTranslations } from "next-intl";
import { Suspense, useState } from "react";

import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { LazyDialog } from "@/ui/components/overlays";
import { Icon } from "@/ui/icons";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconShow } from "@/ui/icons/glyphs/show";
import { IconLink } from "@/ui/icons/glyphs/link";
import { lazyWarm } from "@/ui/lib/lazy";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";

const ImageViewer = lazyWarm(() => import("@/ui/components/ImageViewer").then((module) => module.ImageViewer));

/**
 * Sealed personal data (D-148, D-172): the ID number and the emergency phone are revealed only on
 * request, with a purpose that the API writes to the audit log, and shown until the page is left; ID
 * document images open the same way. Owner and Manager only — the API enforces it.
 */
export function RevealPii({
  party,
}: {
  party: Pick<Schemas["PartyDto"], "id" | "idNumberOnFile" | "emergencyContact">;
}) {
  const t = useTranslations("owner.parties.privacy");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [fields, setFields] = useState<Schemas["RevealField"][]>(
    party.idNumberOnFile ? ["idNumber"] : ["emergencyContactPhone"],
  );
  const [revealed, setRevealed] = useState<Schemas["RevealedPiiDto"] | null>(null);
  const action = useApiAction({ refresh: false });
  if (!party.idNumberOnFile && !party.emergencyContact?.phoneOnFile) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="reveal-pii">
      {revealed ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="revealed">
          {revealed.idNumber ? (
            <>
              <dt className="text-muted">{t("idNumber")}</dt>
              <dd className="font-mono">{revealed.idNumber}</dd>
            </>
          ) : null}
          {revealed.emergencyContactPhone ? (
            <>
              <dt className="text-muted">{t("emergencyPhone")}</dt>
              <dd className="font-mono">{revealed.emergencyContactPhone}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      <div>
        {revealed ? (
          <Button size="sm" variant="ghost" iconStart={IconHide} onClick={() => setRevealed(null)}>
            {t("hide")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            iconStart={IconShow}
            onClick={() => setOpen(true)}
            data-testid="reveal-open"
          >
            {t("reveal")}
          </Button>
        )}
      </div>
      <LazyDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body")}
        closeLabel={common("close")}
        footer={
          <Button
            disabled={!purpose.trim() || fields.length === 0}
            loading={action.busy}
            onClick={() =>
              void action.run(
                () =>
                  unwrap(
                    browserApi().POST("/v1/owner/parties/{partyId}/actions/reveal-pii", {
                      params: { path: { partyId: party.id } },
                      body: { fields, purpose: purpose.trim() },
                    }),
                  ),
                (result) => {
                  setRevealed(result as Schemas["RevealedPiiDto"]);
                  setOpen(false);
                  setPurpose("");
                },
              )
            }
            data-testid="reveal-confirm"
          >
            {t("confirm")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {party.idNumberOnFile ? (
            <Checkbox
              label={t("idNumber")}
              checked={fields.includes("idNumber")}
              onCheckedChange={(checked) =>
                setFields((current) =>
                  checked === true ? [...current, "idNumber"] : current.filter((field) => field !== "idNumber"),
                )
              }
            />
          ) : null}
          {party.emergencyContact?.phoneOnFile ? (
            <Checkbox
              label={t("emergencyPhone")}
              checked={fields.includes("emergencyContactPhone")}
              onCheckedChange={(checked) =>
                setFields((current) =>
                  checked === true
                    ? [...current, "emergencyContactPhone"]
                    : current.filter((field) => field !== "emergencyContactPhone"),
                )
              }
            />
          ) : null}
          <Field label={t("purpose")} hint={t("purposeHint")} required>
            <Textarea
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              rows={2}
              data-testid="reveal-purpose"
            />
          </Field>
          <ProblemNotice error={action.error} />
        </div>
      </LazyDialog>
    </div>
  );
}

/** ID document images (D-172): listed by name; opening one asks for the purpose, which the API audits. */
export function IdDocuments({ partyId, documents }: { partyId: string; documents: Schemas["FileDto"][] }) {
  const t = useTranslations("owner.parties.privacy");
  const common = useTranslations("common");
  const photo = useTranslations("owner.common.photo");
  const locale = useLocale() as Locale;
  const [target, setTarget] = useState<Schemas["FileDto"] | null>(null);
  const [purpose, setPurpose] = useState("");
  const [file, setFile] = useState<Schemas["FileDownloadDto"] | null>(null);
  const action = useApiAction({ refresh: false });
  if (documents.length === 0) return <p className="text-muted text-sm">{t("noDocuments")}</p>;
  return (
    <>
      <ul className="flex flex-col gap-2">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center justify-between gap-2" data-testid="id-document">
            <span>
              {document.title ?? t("document")}
              <span className="text-muted ms-2 text-sm">{formatDateTime(document.createdAt, locale)}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              iconStart={IconShow}
              onClick={() => {
                setFile(null);
                setPurpose("");
                action.reset();
                setTarget(document);
              }}
            >
              {t("open")}
            </Button>
          </li>
        ))}
      </ul>
      <LazyDialog
        open={target !== null}
        onOpenChange={(next) => !next && setTarget(null)}
        title={target?.title ?? t("document")}
        description={file ? undefined : t("documentBody")}
        size={file ? "lg" : "md"}
        closeLabel={common("close")}
      >
        {file ? (
          <Suspense fallback={null}>
            <ImageViewer
              src={file.url}
              alt={target?.title ?? t("document")}
              labels={{
                zoomIn: photo("zoomIn"),
                zoomOut: photo("zoomOut"),
                zoom: (percent) => photo("zoom", { percent }),
              }}
              data-testid="id-document-image"
            />
          </Suspense>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label={t("purpose")} hint={t("purposeHint")} required>
              <Textarea
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                rows={2}
                data-testid="document-purpose"
              />
            </Field>
            <ProblemNotice error={action.error} />
            <div className="flex justify-end">
              <Button
                disabled={!purpose.trim()}
                loading={action.busy}
                onClick={() =>
                  target &&
                  void action.run(
                    () =>
                      unwrap(
                        browserApi().GET("/v1/owner/parties/{partyId}/id-documents/{documentId}", {
                          params: { path: { partyId, documentId: target.id }, query: { purpose: purpose.trim() } },
                        }),
                      ),
                    (result) => setFile(result as Schemas["FileDownloadDto"]),
                  )
                }
                data-testid="document-open"
              >
                {t("confirmOpen")}
              </Button>
            </div>
          </div>
        )}
      </LazyDialog>
    </>
  );
}

/** Resident logins linked to the party; unlinking is Owner-only and needs a reason (D-172). */
export function PartyLinks({
  partyId,
  links,
  canUnlink,
}: {
  partyId: string;
  links: Schemas["PartyLinkDto"][];
  canUnlink: boolean;
}) {
  const t = useTranslations("owner.parties.links");
  const locale = useLocale() as Locale;
  const [reason, setReason] = useState("");
  if (links.length === 0) return <p className="text-muted text-sm">{t("none")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li key={link.id} className="flex flex-wrap items-center justify-between gap-2" data-testid="party-link">
          <span className="flex items-center gap-2">
            <Icon icon={IconLink} className="text-primary" />
            <span>
              {link.userDisplayName ?? t("resident")}
              <span className="text-muted ms-2 text-sm">
                {t("linked", { via: t(`via.${link.linkedVia}`), at: formatDateTime(link.linkedAt, locale) })}
                {link.lineLinked ? ` · ${t("line")}` : ""}
                {link.state === "unlinked" ? ` · ${t("unlinked")}` : ""}
              </span>
            </span>
          </span>
          {canUnlink && link.state === "active" ? (
            <ConfirmAction
              label={t("unlink")}
              variant="ghost"
              size="sm"
              tone="destructive"
              title={t("unlinkTitle")}
              description={t("unlinkBody")}
              confirmLabel={t("unlink")}
              ready={reason.trim().length > 0}
              successMessage={t("unlinked")}
              onConfirm={() =>
                unwrap(
                  browserApi().POST("/v1/owner/parties/{partyId}/links/{linkId}/actions/unlink", {
                    params: { path: { partyId, linkId: link.id } },
                    body: { unlinkReason: reason.trim() },
                  }),
                )
              }
            >
              <Field label={t("reason")} required>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
              </Field>
            </ConfirmAction>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
