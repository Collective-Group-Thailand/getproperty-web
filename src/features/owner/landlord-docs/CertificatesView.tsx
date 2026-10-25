import { getTranslations } from "next-intl/server";

import { RENT_CERTIFICATE_STATUS } from "@/domain/status/rentCertificate";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
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
      <Card as="section" aria-labelledby="certificates-waiting" data-testid="certificates-waiting">
        <CardHeader title={<span id="certificates-waiting">{t("waiting", { count: waiting.length })}</span>} />
        {waiting.length ? (
          <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
            {waiting.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" data-testid="certificate-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/leases/${c.leaseId}`)}
                  >
                    {t("unit", { unit: c.unitNo ?? "—" })}
                  </a>
                  <StatusBadgeOf map={RENT_CERTIFICATE_STATUS} value={c.state} size="sm" />
                </div>
                <p className="text-muted text-sm">
                  {[
                    t(`purpose.${c.purpose}`),
                    period(c),
                    t(`language.${c.language}`),
                    formatDateTime(c.requestedAt, locale),
                  ].join(" · ")}
                </p>
                {c.note ? <p className="text-sm">{t("note", { note: c.note })}</p> : null}
                {canManage ? <CertificateActions id={c.id} unitNo={c.unitNo ?? ""} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={IconBill} title={t("noneWaiting")} description={t("noneWaitingBody")} />
        )}
      </Card>
      {answered.length ? (
        <Card as="section" aria-labelledby="certificates-answered" data-testid="certificates-answered">
          <CardHeader title={<span id="certificates-answered">{t("answered")}</span>} />
          <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
            {answered.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                data-testid="certificate-answered"
                data-state={c.state}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t("unit", { unit: c.unitNo ?? "—" })}
                    {c.number ? ` · ${c.number}` : ""}
                  </p>
                  <p className="text-muted text-sm">
                    {[
                      t(`purpose.${c.purpose}`),
                      period(c),
                      c.totalPaid ? t("total", { amount: formatTHB(c.totalPaid, locale) }) : null,
                      c.declineReason ? t("reasonShown", { reason: c.declineReason }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <StatusBadgeOf map={RENT_CERTIFICATE_STATUS} value={c.state} size="sm" />
                {c.documentId ? (
                  <DocumentButton
                    document={{ kind: "file", id: c.documentId }}
                    label={t("open")}
                    title={`${t("title")} ${c.number ?? ""}`}
                    variant="ghost"
                    testId="certificate-open"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </OwnerPage>
  );
}
