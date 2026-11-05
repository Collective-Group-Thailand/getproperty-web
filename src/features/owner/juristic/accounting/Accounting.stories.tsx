import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShellStory } from "@/features/shared/storybook/ShellStory";
import type { Schemas } from "@/lib/api/types";

import { JournalForm } from "./JournalForm";
import { BandsEditor, WhtRatesEditor } from "./SettingsEditors";

/** Pack J light-GL pieces (JW2a): the manual journal with its live balance, the approval band and WHT editors. */
const meta: Meta = {
  title: "Juristic/Accounting",
  decorators: [
    (Story) => (
      <ShellStory zone="owner" pathname="/juristic/accounting">
        <div className="max-w-5xl p-6">
          <Story />
        </div>
      </ShellStory>
    ),
  ],
};
export default meta;

const account = (
  id: string,
  code: string,
  nameTh: string,
  type: Schemas["JuristicAccountType"],
  role: string | null = null,
) =>
  ({
    id,
    code,
    nameTh,
    nameEn: nameTh,
    type,
    role,
    fundId: null,
    bankAccountId: null,
    isSystem: true,
    isActive: true,
    used: true,
    version: 1,
  }) satisfies Schemas["AccountDto"];

export const ManualJournal: StoryObj = {
  render: () => (
    <JournalForm
      buildings={[{ id: "b1", name: "อาคาร A" }]}
      accounts={[
        account("a1", "1130", "เงินฝากธนาคาร – บัญชีดำเนินงาน", "asset", "bank"),
        account("a2", "1160-01", "เงินฝากกองทุนสำรอง – อาคาร A", "asset", "fund_bank"),
        account("a3", "2120", "ภาษีหัก ณ ที่จ่ายค้างนำส่ง", "liability"),
      ]}
      resolutions={[{ id: "r1", buildingId: "b1", label: "มติที่ 1/2569 · อนุมัติงบประมาณประจำปี" }]}
      today="2026-11-06"
    />
  ),
};

export const ApprovalBands: StoryObj = {
  render: () => (
    <BandsEditor
      editable
      bands={[
        { upTo: "10000.00", roles: ["owner", "manager", "committee"], approvals: 1 },
        { upTo: "100000.00", roles: ["owner", "manager", "committee"], approvals: 2 },
        { upTo: null, roles: ["owner", "committee"], approvals: 3 },
      ]}
    />
  ),
};

export const WithholdingRates: StoryObj = {
  render: () => (
    <WhtRatesEditor
      editable
      rates={[
        {
          key: "service",
          labelTh: "ค่าบริการ / ค่าจ้างทำของ",
          labelEn: "Services",
          incomeType: "3 เตรส",
          ratePct: "3.00",
          verified: false,
        },
        { key: "rent", labelTh: "ค่าเช่า", labelEn: "Rent", incomeType: "40(5)", ratePct: "5.00", verified: true },
      ]}
    />
  ),
};
