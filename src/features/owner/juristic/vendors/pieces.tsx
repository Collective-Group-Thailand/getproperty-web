import { useTranslations } from "next-intl";

import { EVALUATION_TREND_STATUS, PRIORITY_STATUS } from "@/domain/status";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Chart } from "@/ui/charts/Chart";
import { Badge } from "@/ui/components/Badge";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";

import { DocumentButton } from "../../shared/DocumentButton";
import type { ExpiryBadge } from "./contracts";
import { trendPoints } from "./evaluations";
import { compareQuotations, quoteExpired, type QuoteRule } from "./quotations";

/**
 * Pieces of the vendor pages that render the same on the server and in Storybook (JW2b): the expiry badge, categories
 * in words, the SLA table, the quotation rule line, the comparison table and the evaluation trend. Every figure is the
 * API's string, formatted.
 */

/** "ลิฟต์ · ไฟฟ้า" — a vendor's or a contract's categories in words. */
export function CategoryText({ categories }: { categories: readonly Schemas["VendorCategory"][] }) {
  const t = useTranslations("owner.vendors.category");
  if (categories.length === 0) return <span className="text-muted">—</span>;
  return <span>{categories.map((category) => t(category)).join(" · ")}</span>;
}

/** The badge a contract wears near its end (`expiryBadge`): calm words, never red. */
export function ExpiryBadgeView({ badge, size = "sm" }: { badge: ExpiryBadge; size?: "sm" | "md" }) {
  const t = useTranslations("owner.vendors.expiry");
  if (!badge) return null;
  switch (badge.kind) {
    case "renewing":
      return (
        <Badge tone="info" size={size} icon={IconRepeat}>
          {t("renewing")}
        </Badge>
      );
    case "notice":
      return (
        <Badge tone="warning" size={size} icon={IconAlert}>
          {badge.daysLeft === 0 ? t("noticeToday") : t("notice", { days: badge.daysLeft })}
        </Badge>
      );
    case "ending":
      return (
        <Badge tone="info" size={size} icon={IconClock}>
          {t("ending", { days: badge.daysLeft })}
        </Badge>
      );
    case "ended":
      return (
        <Badge tone="neutral" size={size} icon={IconHistory}>
          {t("ended")}
        </Badge>
      );
    default:
      return null;
  }
}

/** Response and resolve hours per priority, urgent first (the contract's `slaTerms`). */
export function SlaTable({
  terms,
  testId = "sla-table",
}: {
  terms: readonly Schemas["SlaTermDto"][];
  testId?: string;
}) {
  const t = useTranslations("owner.vendors.sla");
  const order = ["urgent", "high", "normal", "low"];
  const rows = [...terms].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
  if (rows.length === 0) return <p className="text-muted m-0 text-sm">{t("none")}</p>;
  return (
    <SimpleTable
      caption={t("caption")}
      testId={testId}
      columns={[
        { key: "priority", header: t("priority") },
        { key: "response", header: t("response"), align: "end" },
        { key: "resolve", header: t("resolve"), align: "end" },
      ]}
      rows={rows.map((term) => ({
        key: term.priority,
        cells: {
          priority: <StatusBadgeOf map={PRIORITY_STATUS} value={term.priority} size="sm" />,
          response: <span className="tabular-nums">{t("hours", { hours: term.responseHours })}</span>,
          resolve: <span className="tabular-nums">{t("hours", { hours: term.resolveHours })}</span>,
        },
      }))}
    />
  );
}

/**
 * The three-quotation rule in one line, with one mark per quotation needed: "ยอดเกิน ฿50,000.00 ต้องมีใบเสนอราคา
 * อย่างน้อย 3 ใบ — มีแล้ว 2 ใบ". Short of the minimum above the threshold is a warning (an award needs a reason), met is
 * success, below the threshold is neutral.
 */
export function QuoteRuleLine({ rule, locale }: { rule: QuoteRule; locale: Locale }) {
  const t = useTranslations("owner.vendors.rule");
  const threshold = formatTHB(rule.threshold, locale);
  const marks = Math.max(rule.minimum, rule.count);
  return (
    <div
      className="border-border bg-surface rounded-card flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border px-5 py-4"
      data-testid="quote-rule"
      data-state={rule.state}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 font-medium">{t("line", { threshold, minimum: rule.minimum })}</p>
        <StatusText
          tone={rule.state === "met" ? "success" : rule.state === "short" ? "warning" : "muted"}
          icon={rule.state === "met" ? IconCheckCircle : rule.state === "short" ? IconAlert : IconInfo}
          size="sm"
        >
          {t(`state.${rule.state}`, { count: rule.count, minimum: rule.minimum, threshold })}
        </StatusText>
      </div>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: marks }, (_, index) => (
          <span
            key={index}
            className={
              index < rule.count
                ? "bg-primary size-2.5 rounded-full"
                : "border-border-strong size-2.5 rounded-full border bg-transparent"
            }
          />
        ))}
      </span>
    </div>
  );
}

/**
 * Quotations side by side, cheapest first (the API's order, kept defensively): rank, vendor, the amount with its VAT,
 * valid until (expired ones say so — they cannot be awarded), received, the document. The cheapest is marked; the
 * awarded one sits on the pale tint with "ได้งาน".
 */
export function ComparisonTable({
  quotations,
  awardedId,
  today,
  locale,
}: {
  quotations: readonly Schemas["QuotationDto"][];
  awardedId: string | null;
  today: string;
  locale: Locale;
}) {
  const t = useTranslations("owner.vendors.comparison");
  const ordered = compareQuotations(quotations);
  const plain = (value: string) => formatTHB(value, locale, { withSymbol: false });
  return (
    <SimpleTable
      caption={t("caption")}
      testId="quote-comparison"
      stackOnPhones
      minWidth="42rem"
      columns={[
        { key: "rank", header: <span className="sr-only">{t("rank")}</span>, phone: "hidden", className: "w-12" },
        { key: "vendor", header: t("vendor"), phone: "title" },
        { key: "amount", header: t("amount"), align: "end", phone: "figure" },
        { key: "valid", header: t("valid"), phone: "meta" },
        { key: "document", header: <span className="sr-only">{t("document")}</span>, phone: "status" },
      ]}
      rows={ordered.map((quote, index) => {
        const expired = quoteExpired(quote, today);
        const awarded = quote.id === awardedId;
        return {
          key: quote.id,
          testId: "quote-row",
          tone: undefined,
          data: { rank: index + 1, awarded, expired, vendor: quote.vendorName },
          cells: {
            rank: (
              <span
                className={
                  awarded
                    ? "bg-primary-subtle text-primary-subtle-fg inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
                    : "text-muted inline-flex size-7 items-center justify-center text-sm tabular-nums"
                }
              >
                {index + 1}
              </span>
            ),
            vendor: (
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{quote.vendorName}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {awarded ? (
                    <Badge tone="primary" size="sm" icon={IconCheckCircle}>
                      {t("awarded")}
                    </Badge>
                  ) : null}
                  {index === 0 ? (
                    <Badge tone="neutral" size="sm">
                      {t("lowest")}
                    </Badge>
                  ) : null}
                  {quote.note ? <span className="text-muted text-sm">{quote.note}</span> : null}
                </span>
              </span>
            ),
            amount: (
              <span className="flex flex-col items-end">
                <span className="font-medium tabular-nums" data-testid="quote-amount">
                  {formatTHB(quote.amount, locale)}
                </span>
                <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                  {t("vat", { amount: plain(quote.vatAmount) })}
                </span>
              </span>
            ),
            valid: (
              <span className="flex flex-col gap-1">
                {expired ? (
                  <Badge tone="neutral" size="sm" icon={IconHistory}>
                    {t("expired", { date: formatDate(quote.validUntil, locale) })}
                  </Badge>
                ) : (
                  <span className="text-sm whitespace-nowrap">
                    {t("validUntil", { date: formatDate(quote.validUntil, locale) })}
                  </span>
                )}
                <span className="text-muted text-sm whitespace-nowrap">
                  {t("received", { date: formatDate(quote.receivedOn, locale) })}
                </span>
              </span>
            ),
            document: (
              <DocumentButton
                document={{ kind: "file", id: quote.documentId }}
                label={t("open")}
                title={t("documentTitle", { vendor: quote.vendorName })}
              />
            ),
          },
        };
      })}
    />
  );
}

/** "ดีขึ้น", "คงที่", "แย่ลง" with the arrow; nothing with fewer than two evaluations. */
export function TrendBadge({ trend }: { trend: Schemas["EvaluationTrend"] | null }) {
  if (!trend) return null;
  return <StatusBadgeOf map={EVALUATION_TREND_STATUS} value={trend} size="sm" />;
}

/** "3.75" → "3.75", "4.00" → "4" (a score, not money). */
export function scoreText(value: string | null): string {
  if (value === null) return "—";
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return value;
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return fraction ? `${match[1]}.${fraction}` : match[1]!;
}

/**
 * The renewal decision's evidence: the API's summary of the last six evaluations (average, last, trend, SLA breaches)
 * and a thin brand-blue line of the monthly scores on a fixed 1–5 axis, with its data table.
 */
export function EvaluationTrend({
  summary,
  evaluations,
  locale,
}: {
  summary: Schemas["EvaluationSummaryDto"];
  evaluations: readonly Pick<Schemas["VendorEvaluationDto"], "month" | "score">[];
  locale: Locale;
}) {
  const t = useTranslations("owner.vendors.trend");
  const points = trendPoints(evaluations, (month) => formatPeriodKey(month, locale));
  return (
    <div className="flex flex-col gap-4" data-testid="evaluation-trend">
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted text-sm">{t("average", { count: summary.count })}</dt>
          <dd className="m-0 text-xl font-semibold tabular-nums" data-testid="evaluation-average">
            {scoreText(summary.averageScore)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted text-sm">{t("last")}</dt>
          <dd className="m-0 text-xl font-semibold tabular-nums">{scoreText(summary.lastScore)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted text-sm">{t("direction")}</dt>
          <dd className="m-0" data-testid="evaluation-direction">
            {summary.trend ? <TrendBadge trend={summary.trend} /> : <span className="text-muted">{t("tooFew")}</span>}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted text-sm">{t("breaches")}</dt>
          <dd className="m-0 text-xl font-semibold tabular-nums">{summary.slaBreaches}</dd>
        </div>
      </dl>
      {points.length > 1 ? (
        <Chart
          type="line"
          points={points}
          title={t("chart")}
          formatValue={(value) => scoreText(value)}
          domain={{ min: 1, max: 5, ticks: [1, 2, 3, 4, 5] }}
          height={180}
          table={{ summary: t("table"), label: t("month"), value: t("score") }}
          emptyText={t("empty")}
          data-testid="evaluation-chart"
        />
      ) : null}
    </div>
  );
}
