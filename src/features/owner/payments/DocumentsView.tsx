import { getTranslations } from "next-intl/server";

import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconBill } from "@/ui/icons/glyphs/bill";

import { DocumentButton } from "../shared/DocumentButton";
import { ExportButton } from "../shared/ExportButton";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { MoneyNav } from "../shared/MoneyNav";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, ownerCan, pageParam, param, type OwnerContext } from "../shared/server";
import { heldCount, slipsToReview } from "./counts";

type SearchParams = Record<string, string | string[] | undefined>;
const KINDS: Schemas["DocumentKind"][] = [
  "pdf_invoice",
  "pdf_receipt",
  "pdf_tax_invoice",
  "pdf_note",
  "pdf_statement",
  "contract",
];

function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

/**
 * The documents archive (F2 2.4, B4.3): invoices, receipts, tax invoices, notes, statements and leases of
 * a month (the API requires the period), each in the viewer, and the whole month as a zip export.
 */
export async function DocumentsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.documents");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const canOpenContracts = ownerCan(context.me, "party.pii.decrypt");
  const period =
    param(searchParams.period) && /^\d{4}-\d{2}$/.test(param(searchParams.period)!)
      ? param(searchParams.period)!
      : currentMonth();
  const kind = param(searchParams.kind);
  const [list, slips, held] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/billing-documents", {
        params: {
          query: {
            period,
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            kind: KINDS.includes(kind as Schemas["DocumentKind"]) ? (kind as Schemas["DocumentKind"]) : undefined,
            buildingId: building?.id,
          },
        },
      }),
    ),
    slipsToReview(api),
    heldCount(api, building?.id),
  ]);
  return (
    <OwnerPage testId="documents">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <ExportButton
            kind="document_archive_zip"
            params={{ period, buildingId: building?.id }}
            label={t("zip")}
            testId="documents-zip"
          />
        }
      />
      <MoneyNav
        section="payments"
        current="/documents"
        locale={locale}
        counts={{ "/payments/slips": slips, "/payments/held": held }}
      />
      <FilterBar
        fields={[
          { name: "period", label: t("filter.period"), type: "month" },
          {
            name: "kind",
            label: t("filter.kind"),
            type: "select",
            placeholder: t("filter.allKinds"),
            options: KINDS.map((value) => ({ value, label: t(`kind.${value}`) })),
          },
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconBill} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="document-list">
          {list.data.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
              data-testid="document-row"
              data-kind={document.kind}
            >
              <span className="w-32 text-sm">
                {t.has(`kind.${document.kind}` as never) ? t(`kind.${document.kind}` as never) : document.kind}
              </span>
              <span className="flex-1 font-medium">{document.title}</span>
              <span className="text-muted text-sm">{formatDateTime(document.createdAt, locale)}</span>
              <span className="text-muted text-sm">
                {t("size", { kb: formatNumber(Math.ceil(document.sizeBytes / 1024), locale) })}
              </span>
              {document.kind === "contract" && !canOpenContracts ? (
                // A lease contract carries the lessee's ID number: the file download refuses it without
                // `party.pii.decrypt` (D-222), so the row says why instead of offering a 403.
                <span className="text-muted text-sm" data-testid="document-restricted">
                  {t("contractRestricted")}
                </span>
              ) : (
                <DocumentButton
                  document={{ kind: "file", id: document.id }}
                  label={t("open")}
                  title={document.title}
                  variant="ghost"
                  testId="document-open"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/documents")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
