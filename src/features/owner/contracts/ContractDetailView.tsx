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
import { Card, CardHeader } from "@/ui/components/Card";
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
        actions={canAct ? <ContractActions contract={contract} /> : null}
      />
      <ContractDisclaimer disclaimer={contract.disclaimer} locale={locale} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="contract-facts" data-testid="contract-facts">
          <CardHeader title={<span id="contract-facts">{t("detail.facts")}</span>} />
          <DescriptionList
            items={[
              { id: "kind", term: t("create.kind"), description: t(`kind.${contract.kind}`) },
              { id: "language", term: t("create.language"), description: t(`language.${contract.language}`) },
              {
                id: "template",
                term: t("detail.template"),
                description: `${contract.templateKey} · v${contract.templateVersion}`,
              },
              { id: "created", term: t("detail.created"), description: formatDateTime(contract.createdAt, locale) },
              {
                id: "sent",
                term: t("detail.sent"),
                description: contract.sentAt ? formatDateTime(contract.sentAt, locale) : null,
              },
              {
                id: "signed",
                term: t("detail.signedAt"),
                description: contract.signedAt ? formatDateTime(contract.signedAt, locale) : null,
              },
              ...(contract.cancelledAt
                ? [
                    {
                      id: "cancelled",
                      term: t("detail.cancelled"),
                      description: formatDateTime(contract.cancelledAt, locale),
                    },
                  ]
                : []),
              ...(contract.leaseId
                ? [
                    {
                      id: "lease",
                      term: t("create.lease"),
                      description: (
                        <a
                          className="underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/leases/${contract.leaseId}`)}
                        >
                          {t("detail.openLease")}
                        </a>
                      ),
                    },
                  ]
                : []),
              ...(contract.sha256
                ? [
                    {
                      id: "sha",
                      term: t("detail.sha"),
                      description: <span className="font-mono text-xs break-all">{contract.sha256}</span>,
                      wide: true,
                    },
                  ]
                : []),
            ]}
          />
        </Card>

        <Card as="section" aria-labelledby="contract-signers" data-testid="contract-signers">
          <CardHeader
            title={<span id="contract-signers">{t("detail.signers")}</span>}
            description={t("detail.signersHint")}
          />
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {contract.signers.map((signer) => (
              <li
                key={signer.index}
                className="flex flex-wrap items-center justify-between gap-2"
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
          <p className="text-muted mt-4 text-sm">{t("detail.evidence")}</p>
        </Card>
      </div>

      {typed.length || values.clauses?.length ? (
        <Card as="section" aria-labelledby="contract-values" data-testid="contract-values">
          <CardHeader
            title={<span id="contract-values">{t("detail.values")}</span>}
            description={t("detail.valuesHint")}
          />
          {typed.length ? <DescriptionList items={typed} /> : null}
          {values.clauses?.length ? (
            <ol className="mt-4 flex list-decimal flex-col gap-2 ps-5 text-sm">
              {values.clauses.map((clause, index) => (
                <li key={index}>
                  <span className="font-medium">{clause.title}</span>
                  <p>{clause.text}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      ) : null}
    </OwnerPage>
  );
}
