import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShellStory } from "@/features/shared/storybook/ShellStory";
import type { Schemas } from "@/lib/api/types";

import { expiryBadge } from "./contracts";
import { ComparisonTable, EvaluationTrend, ExpiryBadgeView, QuoteRuleLine, SlaTable } from "./pieces";
import { quoteRule } from "./quotations";

/**
 * Pack J vendor pieces (JW2b): the quotation comparison with the three-quotation rule, a contract's SLA table, the
 * evaluation trend for a renewal decision, and the expiry badges of the renewal queue.
 */
const meta: Meta = {
  title: "Juristic/Vendors",
  decorators: [
    (Story) => (
      <ShellStory zone="owner" pathname="/juristic/quotations">
        <div className="flex max-w-5xl flex-col gap-6 p-6">
          <Story />
        </div>
      </ShellStory>
    ),
  ],
};
export default meta;

const quote = (
  n: number,
  vendorName: string,
  amount: string,
  vatAmount: string,
  validUntil = "2027-01-31",
  note: string | null = null,
): Schemas["QuotationDto"] => ({
  id: `q${n}`,
  vendorId: `v${n}`,
  vendorName,
  amount,
  vatAmount,
  validUntil,
  documentId: `d${n}`,
  receivedOn: `2026-11-0${n}`,
  note,
});

const quotes = [
  quote(2, "บริษัท ไทยลิฟต์ เซอร์วิส จำกัด", "205440.00", "13440.00"),
  quote(
    1,
    "บริษัท ลิฟท์แอนด์เอสคาเลเตอร์ (ประเทศไทย) จำกัด",
    "192600.00",
    "12600.00",
    "2027-01-31",
    "ราคาเท่าเดิม รับประกันอะไหล่ 6 เดือน",
  ),
  quote(3, "บริษัท เอเชีย ลิฟต์ เอ็นจิเนียริ่ง จำกัด", "214000.00", "14000.00", "2026-11-01"),
];

export const QuotationComparison: StoryObj = {
  render: () => (
    <>
      <QuoteRuleLine
        rule={quoteRule({ quotations: quotes, threshold: "50000.00", minimumQuotations: 3 })}
        locale="th"
      />
      <ComparisonTable quotations={quotes} awardedId="q1" today="2026-11-06" locale="th" />
    </>
  ),
};

export const ShortOfThree: StoryObj = {
  render: () => (
    <QuoteRuleLine
      rule={quoteRule({ quotations: quotes.slice(0, 2), threshold: "50000.00", minimumQuotations: 3 })}
      locale="th"
    />
  ),
};

export const ServiceLevels: StoryObj = {
  render: () => (
    <SlaTable
      terms={[
        { priority: "low", responseHours: 48, resolveHours: 168 },
        { priority: "urgent", responseHours: 2, resolveHours: 24 },
        { priority: "high", responseHours: 4, resolveHours: 48 },
      ]}
    />
  ),
};

export const EvaluationTrendLine: StoryObj = {
  render: () => (
    <EvaluationTrend
      locale="th"
      summary={{ count: 6, averageScore: "3.79", lastScore: "3.00", trend: "declining", slaBreaches: 4 }}
      evaluations={[
        { month: "2026-04", score: "4.50" },
        { month: "2026-05", score: "4.50" },
        { month: "2026-06", score: "4.25" },
        { month: "2026-07", score: "3.75" },
        { month: "2026-08", score: "3.50" },
        { month: "2026-09", score: "3.00" },
      ]}
    />
  ),
};

export const ExpiryBadges: StoryObj = {
  render: () => {
    const today = "2026-11-06";
    const cases = [
      { state: "active", daysLeft: 75, noticeBy: "2026-11-21", renewalId: null },
      { state: "active", daysLeft: 25, noticeBy: "2026-11-01", renewalId: null },
      { state: "active", daysLeft: 25, noticeBy: "2026-11-01", renewalId: "r1" },
      { state: "expired", daysLeft: -20, noticeBy: "2026-09-17", renewalId: null },
    ];
    return (
      <div className="flex flex-wrap gap-3">
        {cases.map((entry, index) => (
          <ExpiryBadgeView key={index} badge={expiryBadge(entry, today, 90)} />
        ))}
      </div>
    );
  },
};
