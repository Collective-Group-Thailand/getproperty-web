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
/** B7.5: everything generated for one unit (the landlord document set, D-253). */
const UNIT_KINDS: Schemas["DocumentKind"][] = [
  "contract",
  "pdf_invoice",
  "pdf_receipt",
  "pdf_tax_invoice",
  "pdf_note",
  "pdf_statement",
  "inspection_report",
  "pdf_report",
  "pdf_notice",
  "pdf_certificate",
  "pdf_summary",
  "other",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * a month (the API requires the period), each in the viewer, and the whole month as a zip export. With
 * `?unit=` it lists every document generated for that unit instead, all months (B7.5, D-253) — the landlord's
 * "documents of this unit" from the portfolio.
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
  const unitParam = param(searchParams.unit);
  const unitId = unitParam && UUID.test(unitParam) ? unitParam : null;
  const kinds = unitId ? UNIT_KINDS : KINDS;
  const kindFilter = kinds.includes(kind as Schemas["DocumentKind"]) ? (kind as Schemas["DocumentKind"]) : undefined;
  const [list, slips, held] = await Promise.all([
    unitId
      ? unwrap(
          api.GET("/v1/owner/documents", {
            params: { query: { unitId, kind: kindFilter, page: pageParam(searchParams.page), perPage: 25 } },
          }),
        )
      : unwrap(
          api.GET("/v1/owner/billing-documents", {
            params: {
              query: {
                period,
                page: pageParam(searchParams.page),
                perPage: 25,
                q: param(searchParams.q),
                kind: kindFilter,
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
        title={unitId ? t("unit.title") : t("title")}
        description={unitId ? t("unit.description") : t("description")}
        crumbs={
          unitId
            ? [{ label: t("title"), href: ownerPath(locale, "/documents") }, { label: t("unit.title") }]
            : undefined
        }
        actions={
          unitId ? undefined : (
            <ExportButton
              kind="document_archive_zip"
              params={{ period, buildingId: building?.id }}
              label={t("zip")}
              testId="documents-zip"
            />
          )
        }
      />
      {unitId ? null : (
        <MoneyNav
          section="payments"
          current="/documents"
          locale={locale}
          counts={{ "/payments/slips": slips, "/payments/held": held }}
        />
      )}
      <FilterBar
        fields={
          unitId
            ? [
                {
                  name: "kind",
                  label: t("filter.kind"),
                  type: "select",
                  placeholder: t("filter.allKinds"),
                  options: kinds.map((value) => ({ value, label: t(`kind.${value}`) })),
                },
              ]
            : [
                { name: "period", label: t("filter.period"), type: "month" },
                {
                  name: "kind",
                  label: t("filter.kind"),
                  type: "select",
                  placeholder: t("filter.allKinds"),
                  options: kinds.map((value) => ({ value, label: t(`kind.${value}`) })),
                },
                { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              ]
        }
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconBill}
            title={unitId ? t("unit.empty") : t("empty.title")}
            description={unitId ? t("unit.emptyBody") : t("empty.body")}
          />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="document-list">
          {list.data.map((document) => (
            <li
              key={document.id}
              className="flex items-center gap-3 px-4 py-3"
              data-testid="document-row"
              data-kind={document.kind}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{document.title}</p>
                <p className="text-muted flex flex-wrap gap-x-3 text-sm">
                  <span>
                    {t.has(`kind.${document.kind}` as never) ? t(`kind.${document.kind}` as never) : document.kind}
                  </span>
                  <span>{formatDateTime(document.createdAt, locale)}</span>
                  <span>{t("size", { kb: formatNumber(Math.ceil(document.sizeBytes / 1024), locale) })}</span>
                </p>
              </div>
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
