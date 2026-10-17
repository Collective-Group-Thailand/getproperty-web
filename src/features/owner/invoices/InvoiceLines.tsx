import { useTranslations } from "next-intl";

import { READING_SOURCE_VALUES, type ReadingSource } from "@/domain/status/readingSource";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { formatDate, formatDecimal, formatTHB, formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

import { PhotoThumb } from "../shared/PhotoThumb";
import { segmentKey } from "./photos";

const SOURCE_ORDER: Schemas["InvoiceLineSourceType"][] = [
  "rent",
  "meter",
  "service",
  "common_fee",
  "fund",
  "penalty",
  "deposit",
  "adjustment",
];

function quantity(value: string | null, unit: string | null, locale: Locale): string {
  if (value === null) return "—";
  if (unit === "kwh") return formatUnits(value, "kWh", locale);
  if (unit === "m3") return formatUnits(value, "m3", locale);
  return formatDecimal(value, locale, 3);
}

function isSource(value: string | null): value is ReadingSource {
  return value !== null && (READING_SOURCE_VALUES as string[]).includes(value);
}

/**
 * The lines of an invoice grouped by `source_type`, with the disclosure each one needs (D-022): for a
 * meter line the registers from → to with the reading's source and photo, units, the rate per unit and
 * the legal cap per unit, estimated and above-cap marks (with the acknowledgement that covers it),
 * pro-rata period; for every line the amount as the API computed it. Nothing is added up here.
 */
export function InvoiceLines({
  lines,
  locale,
  photos = {},
  testId = "invoice-lines",
}: {
  lines: Schemas["InvoiceLineDto"][];
  locale: Locale;
  photos?: Record<string, string>;
  testId?: string;
}) {
  const t = useTranslations("owner.invoices.lines");
  const groups = SOURCE_ORDER.map((source) => ({
    source,
    lines: lines.filter((line) => line.sourceType === source),
  })).filter((group) => group.lines.length > 0);

  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      {groups.map((group) => (
        <section key={group.source} aria-label={t(`source.${group.source}`)} data-source={group.source}>
          <h3 className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            {t(`source.${group.source}`)}
          </h3>
          <ul className="divide-border flex flex-col divide-y">
            {group.lines.map((line) => (
              <li
                key={line.id}
                className="flex flex-col gap-1 py-2"
                data-testid="invoice-line"
                data-kind={line.lineKind}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{line.description}</span>
                  <span className="tabular-nums" data-testid="line-amount">
                    {formatTHB(line.amount, locale)}
                  </span>
                </div>
                <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {line.units !== null || line.quantity !== "1.000" ? (
                    <span>
                      {t("quantity", {
                        quantity: quantity(line.units ?? line.quantity, line.unit, locale),
                        price: line.unitPrice ? formatTHB(line.unitPrice, locale, { decimals: 4 }) : "—",
                      })}
                    </span>
                  ) : null}
                  {line.capPerUnit ? (
                    <span data-testid="line-cap">
                      {t("cap", { cap: formatTHB(line.capPerUnit, locale, { decimals: 4 }) })}
                    </span>
                  ) : null}
                  {line.periodFrom && line.periodTo ? (
                    <span>
                      {t("period", {
                        from: formatDate(line.periodFrom, locale),
                        to: formatDate(line.periodTo, locale),
                      })}
                    </span>
                  ) : null}
                  {line.proRata ? <Badge size="sm">{t("proRata")}</Badge> : null}
                  {line.isEstimated ? (
                    <span data-testid="flag-estimated">
                      <Badge tone="warning" size="sm">
                        {t("estimated")}
                      </Badge>
                    </span>
                  ) : null}
                  {line.aboveCap ? (
                    <span data-testid="flag-above-cap">
                      <Badge tone={line.complianceAcknowledgementId ? "warning" : "danger"} size="sm">
                        {line.complianceAcknowledgementId ? t("aboveCapAcknowledged") : t("aboveCap")}
                      </Badge>
                    </span>
                  ) : null}
                  {line.vatApplicable ? <span>{t("vat")}</span> : null}
                </div>
                {line.meterSegments.map((segment) => (
                  <div
                    key={`${segment.meterAssignmentId}-${segment.from?.register ?? ""}`}
                    className="flex flex-wrap items-center gap-2 text-sm"
                    data-testid="meter-segment"
                  >
                    <span className="font-mono">{segment.code}</span>
                    {[segment.from, segment.to].map((end, index) =>
                      end ? (
                        <span key={index} className="flex items-center gap-1">
                          {index === 1 ? <span aria-hidden="true">{t("arrow")}</span> : null}
                          <span className="font-mono tabular-nums">{end.register}</span>
                          {isSource(end.source) ? <ReadingSourceBadge source={end.source} /> : null}
                          {photos[segmentKey(segment.meterAssignmentId, end.register)] ? (
                            <PhotoThumb
                              fileId={photos[segmentKey(segment.meterAssignmentId, end.register)]!}
                              alt={t("photoAlt", {
                                meter: segment.code,
                                register: end.register,
                                date: formatDate(end.readAt, locale),
                              })}
                              size="sm"
                            />
                          ) : null}
                        </span>
                      ) : null,
                    )}
                    {segment.units ? (
                      <span className="text-muted">
                        {t("used", { units: quantity(segment.units, line.unit, locale) })}
                      </span>
                    ) : null}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
