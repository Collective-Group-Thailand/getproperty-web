import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ETAX_STATUS } from "@/domain/status/etax";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Statement } from "@/ui/components/Statement";
import { Timeline } from "@/ui/components/Timeline";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { EtaxRetry } from "./EtaxRetry";

/**
 * One e-Tax submission (D-215; redesign G6): a record page — the document number as the title with its status, what
 * the provider refused (its own words, kept as sent) above the document's facts and amounts as a statement, the files
 * (our PDF, the provider-signed PDF/A-3 and XML, 5-minute links), and on the right the next step: "ส่งอีกครั้ง" when
 * the API offers it, with the submission's history under it.
 */
export async function EtaxDetail({ context, submissionId }: { context: OwnerContext; submissionId: string }) {
  const t = await getTranslations("owner.etax");
  const providers = await getTranslations("glossary.etaxProvider");
  const { api, locale, me } = context;
  let row: Schemas["EtaxSubmissionDto"];
  try {
    row = await unwrap(api.GET("/v1/owner/etax/submissions/{submissionId}", { params: { path: { submissionId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const canRetry = ownerCan(me, "receipt.issue") && !readOnly(me);
  const retryable = canRetry && row.nextActions.includes("retry");
  const files = [
    { id: row.sourceDocumentId, label: t("detail.sourcePdf"), testId: "etax-source" },
    { id: row.signedPdfDocumentId, label: t("detail.signedPdf"), testId: "etax-signed-pdf" },
    { id: row.signedXmlDocumentId, label: t("detail.signedXml"), testId: "etax-signed-xml" },
  ].filter((file): file is { id: string; label: string; testId: string } => Boolean(file.id));
  const typeName = t.has(`typeCode.${row.documentTypeCode}` as never)
    ? t(`typeCode.${row.documentTypeCode}` as never)
    : null;
  const history = [
    { id: "issued", at: row.issuedAt, title: t("detail.event.issued") },
    row.submittedAt ? { id: "submitted", at: row.submittedAt, title: t("detail.event.submitted") } : null,
    row.signedAt ? { id: "signed", at: row.signedAt, title: t("detail.event.signed") } : null,
  ].filter((event): event is { id: string; at: string; title: string } => event !== null);

  const panel = (
    <ActionPanel
      testId="etax-panel"
      title={t("detail.next")}
      description={
        row.status === "rejected" || row.status === "failed"
          ? t("detail.nextFix")
          : row.status === "signed"
            ? t("detail.nextSigned")
            : t("detail.nextWaiting")
      }
      facts={[
        { key: "attempts", label: t("detail.attempts"), value: formatNumber(row.attempts, locale) },
        ...(row.nextAttemptAt
          ? [{ key: "next", label: t("detail.nextAttempt"), value: formatDateTime(row.nextAttemptAt, locale) }]
          : []),
      ]}
      primary={retryable ? <EtaxRetry submission={row} /> : undefined}
      secondary={
        row.sourceDocumentId ? (
          <DocumentButton
            document={{ kind: "file", id: row.sourceDocumentId }}
            label={t("detail.openReceipt")}
            size="md"
            title={`${t("detail.sourcePdf")} — ${row.number}`}
          />
        ) : undefined
      }
      footer={
        <div className="flex flex-col gap-3">
          <h3 className="text-fg text-sm font-semibold">{t("detail.history")}</h3>
          <Timeline
            events={history.map((event) => ({
              id: event.id,
              title: event.title,
              time: formatDateTime(event.at, locale),
            }))}
          />
        </div>
      }
    />
  );

  return (
    <OwnerPage testId="etax-detail">
      <PageHeader
        title={<span className="font-mono">{row.number}</span>}
        testId="etax-title"
        status={<StatusBadgeOf map={ETAX_STATUS} value={row.status} />}
        description={[
          t(`subject.${row.subjectType}`),
          typeName,
          t("detail.issuedOn", { date: formatDate(row.issuedAt, locale) }),
        ]
          .filter(Boolean)
          .join(" · ")}
        back={{ label: t("title"), href: ownerPath(locale, "/reports/etax") }}
      />
      <DetailLayout panel={panel}>
        {row.error ? (
          <div data-testid="etax-error">
            <Callout tone="danger" title={t("detail.errorTitle")}>
              <span className="flex flex-col gap-2">
                <span className="bg-surface/70 rounded-control px-3 py-2 font-mono text-sm break-words">
                  {row.error}
                </span>
                <span>{t("detail.errorHelp")}</span>
              </span>
            </Callout>
          </div>
        ) : null}

        <section
          aria-labelledby="etax-facts"
          className="rounded-card border-border bg-surface shadow-card flex flex-col gap-6 border p-5 md:p-6"
        >
          <h2 id="etax-facts" className="text-lg font-semibold">
            {t("detail.facts")}
          </h2>
          <DescriptionList
            columns={2}
            items={[
              { id: "type", term: t("col.type"), description: t(`subject.${row.subjectType}`) },
              { id: "issued", term: t("col.issued"), description: formatDateTime(row.issuedAt, locale) },
              {
                id: "provider",
                term: t("detail.provider"),
                description: providers.has(row.provider) ? providers(row.provider) : providers("other"),
              },
              {
                id: "providerDoc",
                term: t("detail.providerDocId"),
                description: row.providerDocId ? <span className="font-mono text-sm">{row.providerDocId}</span> : null,
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
            ]}
          />
          <div className="border-border border-t pt-5">
            <Statement
              caption={t("detail.amounts")}
              lines={[
                { key: "subtotal", label: t("summary.subtotalShort"), value: formatTHB(row.subtotal, locale) },
                { key: "vat", label: t("summary.vat"), value: formatTHB(row.vatAmount, locale), level: 1 },
                { key: "total", label: t("col.total"), value: formatTHB(row.total, locale), kind: "result" },
              ]}
              className="ms-auto max-w-sm"
            />
          </div>
        </section>

        <section
          aria-labelledby="etax-files-title"
          className="rounded-card border-border bg-surface shadow-card flex flex-col gap-3 border p-5 md:p-6"
          data-testid="etax-files"
        >
          <div>
            <h2 id="etax-files-title" className="text-lg font-semibold">
              {t("detail.files")}
            </h2>
            <p className="text-muted mt-0.5 text-sm">{t("detail.filesHint")}</p>
          </div>
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
        </section>
      </DetailLayout>
    </OwnerPage>
  );
}
