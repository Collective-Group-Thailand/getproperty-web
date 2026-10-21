import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ETAX_STATUS } from "@/domain/status/etax";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { EtaxRetry } from "./EtaxRetry";

/**
 * One e-Tax submission (D-215): the document, the provider's reference and signature time, attempts and the
 * next retry, the provider's error, and the files — our PDF, the provider-signed PDF/A-3 and XML — opened
 * through `GET /v1/owner/files/{id}` (5-minute links). Retry when the API offers it (`receipt.issue`).
 */
export async function EtaxDetail({ context, submissionId }: { context: OwnerContext; submissionId: string }) {
  const t = await getTranslations("owner.etax");
  const { api, locale, me } = context;
  let row: Schemas["EtaxSubmissionDto"];
  try {
    row = await unwrap(api.GET("/v1/owner/etax/submissions/{submissionId}", { params: { path: { submissionId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const canRetry = ownerCan(me, "receipt.issue") && !readOnly(me);
  const files = [
    { id: row.sourceDocumentId, label: t("detail.sourcePdf"), testId: "etax-source" },
    { id: row.signedPdfDocumentId, label: t("detail.signedPdf"), testId: "etax-signed-pdf" },
    { id: row.signedXmlDocumentId, label: t("detail.signedXml"), testId: "etax-signed-xml" },
  ].filter((file): file is { id: string; label: string; testId: string } => Boolean(file.id));
  return (
    <OwnerPage testId="etax-detail">
      <PageHeader
        title={t("detail.title", { number: row.number })}
        testId="etax-title"
        crumbs={[{ label: t("title"), href: ownerPath(locale, "/reports/etax") }, { label: row.number }]}
        description={`${t(`subject.${row.subjectType}`)} · ${row.documentTypeCode}`}
        status={<StatusBadgeOf map={ETAX_STATUS} value={row.status} />}
        actions={canRetry ? <EtaxRetry submission={row} /> : null}
      />
      {row.error ? (
        <div data-testid="etax-error">
          <Callout tone="danger" title={t("detail.errorTitle")}>
            {row.error}
          </Callout>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="etax-facts">
          <CardHeader title={<span id="etax-facts">{t("detail.facts")}</span>} />
          <DescriptionList
            items={[
              { id: "issued", term: t("col.issued"), description: formatDateTime(row.issuedAt, locale) },
              { id: "subtotal", term: t("summary.subtotal"), description: formatTHB(row.subtotal, locale) },
              { id: "vat", term: t("summary.vat"), description: formatTHB(row.vatAmount, locale) },
              { id: "total", term: t("col.total"), description: formatTHB(row.total, locale) },
              { id: "provider", term: t("detail.provider"), description: row.provider },
              {
                id: "providerDoc",
                term: t("detail.providerDocId"),
                description: row.providerDocId ? <span className="font-mono">{row.providerDocId}</span> : null,
              },
              {
                id: "submitted",
                term: t("detail.submittedAt"),
                description: row.submittedAt ? formatDateTime(row.submittedAt, locale) : null,
              },
              {
                id: "signed",
                term: t("detail.signedAt"),
                description: row.signedAt ? formatDateTime(row.signedAt, locale) : null,
              },
              { id: "attempts", term: t("detail.attempts"), description: formatNumber(row.attempts, locale) },
              {
                id: "next",
                term: t("detail.nextAttempt"),
                description: row.nextAttemptAt ? formatDateTime(row.nextAttemptAt, locale) : null,
              },
            ]}
          />
        </Card>
        <Card as="section" aria-labelledby="etax-files" data-testid="etax-files">
          <CardHeader title={<span id="etax-files">{t("detail.files")}</span>} description={t("detail.filesHint")} />
          {files.length ? (
            <ul className="flex flex-wrap gap-2">
              {files.map((file) => (
                <li key={file.id}>
                  <DocumentButton
                    document={{ kind: "file", id: file.id }}
                    label={file.label}
                    title={`${file.label} — ${row.number}`}
                    testId={file.testId}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("detail.noFiles")}</p>
          )}
        </Card>
      </div>
    </OwnerPage>
  );
}
