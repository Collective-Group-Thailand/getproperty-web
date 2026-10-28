"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useSignatureLabels } from "@/features/shared/console/labels";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { blobToBase64, SignaturePad } from "@/ui/components/SignaturePad";
import { Spinner } from "@/ui/components/Spinner";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconSign } from "@/ui/icons/glyphs/sign";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { Icon } from "@/ui/icons";

import { DocumentButton } from "../shared/DocumentButton";

type Contract = Pick<Schemas["ContractDto"], "id" | "title" | "number" | "nextActions" | "state">;

/**
 * The contract's actions, exactly those in `nextActions` (G3, D-294): preview the draft, send it for signature (the
 * API numbers, renders and hashes it; Idempotency-Key), **sign** as the operator — the PDF read from `…/document` and
 * its sha256 are what is signed, with a drawn signature (D-062; 409 `contract.changed` when the PDF moved on) — cancel
 * with a reason, and download.
 */
export function ContractActions({ contract }: { contract: Contract }) {
  const t = useTranslations("owner.contracts.actions");
  const signatureLabels = useSignatureLabels();
  const [signature, setSignature] = useState<Blob | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const can = (name: string) => contract.nextActions.includes(name);
  const path = { contractId: contract.id };
  const label = contract.number ?? contract.title;

  return (
    <div className="flex flex-wrap gap-2" data-testid="contract-actions">
      {can("preview") ? (
        <DocumentButton
          document={{ kind: "contractPreview", id: contract.id }}
          label={t("preview")}
          title={t("previewTitle", { title: contract.title })}
          testId="contract-preview"
        />
      ) : null}
      {can("download") ? (
        <DocumentButton
          document={{ kind: "contract", id: contract.id }}
          label={contract.state === "signed" ? t("signedPdf") : t("pdf")}
          title={t("pdfTitle", { label })}
          testId="contract-pdf"
        />
      ) : null}
      {can("send-for-signature") ? (
        <ConfirmAction
          label={t("send")}
          icon={IconSign}
          testId="contract-send"
          title={t("sendTitle")}
          description={t("sendBody", { title: contract.title })}
          confirmLabel={t("send")}
          successMessage={t("sent")}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/contracts/{contractId}/actions/send-for-signature", {
                params: { path, header: { "Idempotency-Key": key } },
              }),
            )
          }
        />
      ) : null}
      {can("sign") ? (
        <ConfirmAction
          label={t("sign")}
          icon={IconSign}
          testId="contract-sign"
          title={t("signTitle", { label })}
          description={t("signBody")}
          confirmLabel={t("signConfirm")}
          successMessage={t("signed")}
          ready={signature !== null && sha !== null}
          onConfirm={async (key) =>
            unwrap(
              browserApi().POST("/v1/owner/contracts/{contractId}/actions/sign", {
                params: { path, header: { "Idempotency-Key": key } },
                body: { contractSha256: sha!, signaturePng: await blobToBase64(signature!) },
              }),
            )
          }
        >
          <DocumentToSign contractId={contract.id} onSha={setSha} />
          <SignaturePad label={t("signatureLabel")} labels={signatureLabels} onChange={setSignature} height={180} />
        </ConfirmAction>
      ) : null}
      {can("cancel") ? (
        <ConfirmAction
          label={t("cancel")}
          icon={IconXCircle}
          variant="secondary"
          tone="destructive"
          testId="contract-cancel"
          title={t("cancelTitle", { label })}
          description={t("cancelBody")}
          confirmLabel={t("cancel")}
          successMessage={t("cancelled")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/contracts/{contractId}/actions/cancel", {
                params: { path },
                body: { reason: reason.trim() || null },
              }),
            )
          }
        >
          <Field label={t("reason")}>
            <Textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="contract-reason"
            />
          </Field>
        </ConfirmAction>
      ) : null}
    </div>
  );
}

/** The PDF to sign: opened from its short-lived URL, its sha256 shown and handed to the signature request. */
function DocumentToSign({ contractId, onSha }: { contractId: string; onSha: (sha: string | null) => void }) {
  const t = useTranslations("owner.contracts.actions");
  const [document, setDocument] = useState<Schemas["ContractDownloadDto"] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    onSha(null);
    unwrap(browserApi().GET("/v1/owner/contracts/{contractId}/document", { params: { path: { contractId } } }))
      .then((answer) => {
        if (!live) return;
        setDocument(answer);
        onSha(answer.sha256);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [contractId, onSha]);
  if (failed) return <Callout tone="danger">{t("documentFailed")}</Callout>;
  if (!document)
    return (
      <p className="text-muted flex items-center gap-2 text-sm">
        <Spinner label={t("documentLoading")} /> {t("documentLoading")}
      </p>
    );
  return (
    <div className="mb-3 flex flex-col gap-1 text-sm" data-testid="contract-sign-document">
      <a
        href={document.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 font-medium underline-offset-4 hover:underline"
      >
        <Icon icon={IconExternal} /> {t("readPdf")}
      </a>
      <span className="text-muted font-mono text-xs break-all" data-testid="contract-sign-sha">
        {t("sha", { sha: document.sha256 })}
      </span>
    </div>
  );
}
