import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShellStory } from "@/features/shared/storybook/ShellStory";
import type { Schemas } from "@/lib/api/types";

import { AppliedCard, HandoverProblems, OwnerMatches, ReceivingBank } from "./pieces";

/**
 * Pack J developer handover pieces (JW3b, D-333): the problems the developer must fix (unit number + words, never a
 * code), the receiving account beside the office's matched account (or the calm "no match" line), the owners new or
 * matched by LINE, and what an acceptance recorded.
 */
const meta: Meta = {
  title: "Juristic/Handovers",
  decorators: [
    (Story) => (
      <ShellStory zone="owner" pathname="/juristic/handovers">
        <div className="flex max-w-4xl flex-col gap-6 p-6">
          <Story />
        </div>
      </ShellStory>
    ),
  ],
};
export default meta;

const units: Schemas["HandoverUnitDto"][] = ["D-301", "D-302", "D-303"].map((unitNo, index) => ({
  unitRef: `u-${unitNo}`,
  unitNo,
  owners: index === 0 ? [] : [{ partyRef: `p-${index}`, displayName: "ผู้ซื้อ ตัวอย่าง", sharePct: "100.0000" }],
  advanceCommonFees: "14400.00",
  advancePeriodFrom: "2026-11-01",
  advancePeriodTo: "2027-10-31",
  firstFundContribution: "16250.00",
  receivablesBroughtForward: "0.00",
  receivableItems: 0,
}));

const bank: Schemas["HandoverBankDto"] = {
  bankCode: "004",
  bankName: "ธนาคารกสิกรไทย",
  accountName: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
  accountNoMasked: "XXX-X-XX1234",
  matchedBankAccountId: "ba0ca001-0000-4000-8000-000000000001",
};

const office: Schemas["BankAccountDto"] = {
  id: "ba0ca001-0000-4000-8000-000000000001",
  bankCode: "004",
  bankNameTh: "ธนาคารกสิกรไทย",
  branch: null,
  accountNoMasked: "•••-•-•1234-•",
  accountName: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
  paymentProvider: "none",
  buildingIds: [],
  isDefault: true,
  state: "active",
  confirmedAt: "2025-01-01T00:00:00+07:00",
  createdAt: "2025-01-01T00:00:00+07:00",
  nextActions: [],
};

export const Problems: StoryObj = {
  render: () => (
    <HandoverProblems
      units={units}
      problems={[
        { code: "owner_missing", unitRef: "u-D-301", ref: null },
        { code: "shares_exceeded", unitRef: "u-D-302", ref: null },
        { code: "receivable_after_as_of", unitRef: "u-D-303", ref: "rcv-2" },
        { code: "duplicate_unit_no", unitRef: null, ref: "x" },
      ]}
    />
  ),
};

export const BankMatched: StoryObj = {
  render: () => <ReceivingBank bank={bank} matched={office} bankAccountsHref="/settings/bank-accounts" />,
};

export const BankUnmatched: StoryObj = {
  render: () => (
    <ReceivingBank
      bank={{
        ...bank,
        bankCode: "006",
        bankName: "ธนาคารกรุงไทย",
        accountNoMasked: "XXX-X-XX9087",
        matchedBankAccountId: null,
      }}
      matched={null}
      bankAccountsHref="/settings/bank-accounts"
    />
  ),
};

export const RegisterOnly: StoryObj = {
  render: () => <ReceivingBank bank={null} matched={null} bankAccountsHref={null} />,
};

export const Owners: StoryObj = { render: () => <OwnerMatches create={328} attach={2} /> };

export const Applied: StoryObj = {
  render: () => (
    <AppliedCard
      applied={{
        credits: "4492800.00",
        fundContributions: "5070000.00",
        openingInvoices: 31,
        openingInvoicesTotal: "37200.00",
      }}
      matches
      acceptedAt="2026-11-06T10:15:00+07:00"
      locale="th"
    />
  ),
};
