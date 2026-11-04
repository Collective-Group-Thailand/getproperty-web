import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CONTRACT_DOCUMENT_STATUS, LEGAL_REVIEW_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Paper, PaperFoot, PaperHead, PaperSection } from "@/ui/components/Paper";
import { DescriptionList } from "@/ui/components/DescriptionList";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { ContractActions } from "./ContractActions";
import { ContractDisclaimer } from "./ContractDisclaimer";

/**
 * One signable contract (G3, D-294): state and legal-review badge, the disclaimer, the pinned template version, the
 * values typed, every signer with the time they signed (D-062) and the sha256 of the PDF being signed; the actions are
 * exactly the API's `nextActions` (preview, send for signature, sign, cancel, download).
 */
export async function ContractDetailView({ context, contractId }: { context: OwnerContext; contractId: string }) {
  const t = await getTranslations("owner.contracts");
  const { api, locale, me } = context;
  let contract: Schemas["ContractDto"];
  try {
    contract = await unwrap(api.GET("/v1/owner/contracts/{contractId}", { params: { path: { contractId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const canAct = !readOnly(me) && ownerCan(me, "lease.manage");
  const values = contract.variables;
  const typed = [
    values.fee ? { id: "fee", term: t("create.fee"), description: formatTHB(values.fee, locale) } : null,
    values.rent ? { id: "rent", term: t("create.rent"), description: formatTHB(values.rent, locale) } : null,
    values.moveInDate
      ? { id: "moveIn", term: t("create.moveInDate"), description: formatDate(values.moveInDate, locale) }
      : null,
    values.expiresOn
      ? { id: "expires", term: t("create.expiresOn"), description: formatDate(values.expiresOn, locale) }
      : null,
    values.effectiveDate
      ? { id: "effective", term: t("create.effectiveDate"), description: formatDate(values.effectiveDate, locale) }
      : null,
    values.refundTerms
      ? { id: "refund", term: t("create.refundTerms"), description: values.refundTerms, wide: true }
      : null,
    values.note ? { id: "note", term: t("create.note"), description: values.note, wide: true } : null,
  ].filter((item) => item !== null);

  const signed = contract.signers.filter((signer) => signer.signedAt).length;
  return (
    <OwnerPage testId="contract-detail">
      <PageHeader
        title={contract.title}
        testId="contract-title"
        description={[t(`kind.${contract.kind}`), contract.number].filter(Boolean).join(" · ")}
        crumbs={[
          { label: t("documents.title"), href: ownerPath(locale, "/contracts/documents") },
          { label: contract.number ?? contract.title },
        ]}
        status={
          <span className="flex flex-wrap gap-2" data-testid="contract-status" data-state={contract.state}>
            <StatusBadgeOf map={CONTRACT_DOCUMENT_STATUS} value={contract.state} />
            <StatusBadgeOf map={LEGAL_REVIEW_STATUS} value={contract.legalReviewState} />
          </span>
        }
      />
      <ContractDisclaimer disclaimer={contract.disclaimer} locale={locale} />

      <DetailLayout
        panel={
          <ActionPanel
            title={t("detail.panelTitle")}
            testId="contract-panel"
            facts={[
              {
                key: "signed",
                label: t("detail.signers"),
                value: t("detail.signedCount", { signed, total: contract.signers.length }),
              },
              ...(contract.sentAt
                ? [{ key: "sent", label: t("detail.sent"), value: formatDate(contract.sentAt, locale) }]
                : []),
            ]}
            primary={canAct ? <ContractActions contract={contract} layout="panel" /> : undefined}
            secondary={
              contract.leaseId ? (
                <Button asChild variant="ghost">
                  <a href={ownerPath(locale, `/leases/${contract.leaseId}`)}>{t("detail.openLease")}</a>
                </Button>
              ) : undefined
            }
            footer={t("detail.evidence")}
          />
        }
      >
        <Paper label={contract.title} testId="contract-facts">
          <PaperHead
            kind={t(`kind.${contract.kind}`)}
            number={contract.number ?? t("detail.noNumber")}
            facts={[
              { key: "created", label: t("detail.created"), value: formatDate(contract.createdAt, locale) },
              ...(contract.signedAt
                ? [{ key: "signed", label: t("detail.signedAt"), value: formatDate(contract.signedAt, locale) }]
                : []),
              ...(contract.cancelledAt
                ? [{ key: "cancelled", label: t("detail.cancelled"), value: formatDate(contract.cancelledAt, locale) }]
                : []),
              { key: "language", label: t("create.language"), value: t(`language.${contract.language}`) },
            ]}
          />
          <PaperSection title={<span id="contract-signers">{t("detail.signers")}</span>}>
            <ul
              className="divide-border border-border m-0 flex list-none flex-col divide-y border-y p-0"
              data-testid="contract-signers"
            >
              {contract.signers.map((signer) => (
                <li
                  key={signer.index}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  data-testid="contract-signer"
                  data-role={signer.role}
                  data-signed={signer.signedAt ? "true" : "false"}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{signer.name}</span>
                    <span className="text-muted text-sm">{t(`signerRole.${signer.role}`)}</span>
                  </span>
                  {signer.signedAt ? (
                    <Badge tone="success" size="sm">
                      {t("detail.signedOn", { date: formatDateTime(signer.signedAt, locale) })}
                    </Badge>
                  ) : (
                    <Badge size="sm">
                      {contract.state === "pending_signature" ? t("detail.waiting") : t("detail.notSent")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </PaperSection>
          {typed.length || values.clauses?.length ? (
            <PaperSection title={<span id="contract-values">{t("detail.values")}</span>}>
              <div data-testid="contract-values" className="flex flex-col gap-4">
                {typed.length ? <DescriptionList items={typed} /> : null}
                {values.clauses?.length ? (
                  <ol className="flex list-decimal flex-col gap-3 ps-5">
                    {values.clauses.map((clause, index) => (
                      <li key={index}>
                        <span className="font-medium">{clause.title}</span>
                        <p className="text-muted">{clause.text}</p>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </PaperSection>
          ) : null}
          <PaperFoot>
            <p>{t("detail.templateLine", { version: contract.templateVersion })}</p>
          </PaperFoot>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}
