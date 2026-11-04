import { getTranslations } from "next-intl/server";

import { RENT_CERTIFICATE_STATUS } from "@/domain/status/rentCertificate";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBill } from "@/ui/icons/glyphs/bill";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { ownerCan, type OwnerContext } from "../shared/server";
import { CertificateActions } from "./CertificateActions";

type Certificate = Schemas["RentCertificateDto"];

/**
 * Rent payment certificates (B7.5, D-253): what residents asked for first — purpose, period, their note — with
 * issue / decline, then the certificates already answered with their PDF. The API lists the receipts and decides
 * what may be issued.
 */
export async function CertificatesView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.certificates");
  const { api, locale } = context;
  const all = await unwrap(api.GET("/v1/owner/rent-certificates", { params: { query: {} } }));
  const waiting = all.filter((c) => c.state === "requested");
  const answered = all.filter((c) => c.state !== "requested");
  const canManage = ownerCan(context.me, "lease.manage");
  const period = (c: Certificate) =>
    t("period", { from: formatDate(c.periodFrom, locale), to: formatDate(c.periodTo, locale) });

  return (
    <OwnerPage testId="certificates">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("documents"), href: ownerPath(locale, "/documents") }, { label: t("title") }]}
      />
      {/* The list pattern (G3 revision): what residents asked for first, one table each for waiting and answered. */}
      <section
        aria-labelledby="certificates-waiting"
        className="flex flex-col gap-3"
        data-testid="certificates-waiting"
      >
        <h2 id="certificates-waiting" className="text-lg font-semibold">
          {t("waiting", { count: waiting.length })}
        </h2>
        {waiting.length ? (
          <SimpleTable
            caption={t("waiting", { count: waiting.length })}
            stackOnPhones
            minWidth="52rem"
            columns={[
              { key: "unit", header: t("col.unit"), phone: "title" },
              { key: "purpose", header: t("col.purpose"), phone: "meta" },
              { key: "period", header: t("col.period"), phone: "meta" },
              { key: "requested", header: t("col.requested"), phone: "hidden" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                align: "end",
                phone: "status",
              },
            ]}
            rows={waiting.map((c) => ({
              key: c.id,
              testId: "certificate-row",
              cells: {
                unit: (
                  <span className="flex flex-col">
                    <a
                      className="font-medium underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/leases/${c.leaseId}`)}
                    >
                      {t("unit", { unit: c.unitNo ?? "—" })}
                    </a>
                    {c.note ? <span className="text-muted text-sm">{t("note", { note: c.note })}</span> : null}
                  </span>
                ),
                purpose: (
                  <span className="flex flex-col">
                    <span>{t(`purpose.${c.purpose}`)}</span>
                    <span className="text-muted text-sm">{t(`language.${c.language}`)}</span>
                  </span>
                ),
                period: <span className="text-sm">{period(c)}</span>,
                requested: <span className="text-muted text-sm">{formatDateTime(c.requestedAt, locale)}</span>,
                actions: canManage ? (
                  <CertificateActions id={c.id} unitNo={c.unitNo ?? ""} />
                ) : (
                  <StatusBadgeOf map={RENT_CERTIFICATE_STATUS} value={c.state} size="sm" />
                ),
              },
            }))}
          />
        ) : (
          <Card>
            <EmptyState
              icon={IconBill}
              title={t("noneWaiting")}
              description={t("noneWaitingBody")}
              action={
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/documents")}>{t("noneWaitingAction")}</a>
                </Button>
              }
            />
          </Card>
        )}
      </section>
      {answered.length ? (
        <section
          aria-labelledby="certificates-answered"
          className="flex flex-col gap-3"
          data-testid="certificates-answered"
        >
          <h2 id="certificates-answered" className="text-lg font-semibold">
            {t("answered")}
          </h2>
          <SimpleTable
            caption={t("answered")}
            stackOnPhones
            minWidth="52rem"
            columns={[
              { key: "unit", header: t("col.unit"), phone: "title" },
              { key: "purpose", header: t("col.purpose"), phone: "meta" },
              { key: "period", header: t("col.period"), phone: "meta" },
              { key: "total", header: t("col.total"), align: "end", phone: "figure" },
              { key: "status", header: t("col.status"), phone: "status" },
              { key: "open", header: <span className="sr-only">{t("open")}</span>, align: "end", phone: "hidden" },
            ]}
            rows={answered.map((c) => ({
              key: c.id,
              testId: "certificate-answered",
              data: { state: c.state },
              cells: {
                unit: (
                  <span className="flex flex-col">
                    <span className="font-medium">{t("unit", { unit: c.unitNo ?? "—" })}</span>
                    {c.number ? <span className="text-muted font-mono text-sm">{c.number}</span> : null}
                  </span>
                ),
                purpose: (
                  <span className="flex flex-col">
                    <span>{t(`purpose.${c.purpose}`)}</span>
                    {c.declineReason ? (
                      <span className="text-muted text-sm">{t("reasonShown", { reason: c.declineReason })}</span>
                    ) : null}
                  </span>
                ),
                period: <span className="text-sm">{period(c)}</span>,
                total: c.totalPaid ? (
                  <span className="tabular-nums">{formatTHB(c.totalPaid, locale)}</span>
                ) : (
                  <span className="text-muted">—</span>
                ),
                status: <StatusBadgeOf map={RENT_CERTIFICATE_STATUS} value={c.state} size="sm" />,
                open: c.documentId ? (
                  <DocumentButton
                    document={{ kind: "file", id: c.documentId }}
                    label={t("open")}
                    title={`${t("title")} ${c.number ?? ""}`}
                    variant="ghost"
                    testId="certificate-open"
                  />
                ) : null,
              },
            }))}
          />
        </section>
      ) : null}
    </OwnerPage>
  );
}
