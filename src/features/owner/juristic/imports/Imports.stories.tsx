import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShellStory } from "@/features/shared/storybook/ShellStory";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { DifferencesTable, GoLiveChecklist, ReconcileBlock, RowIssuesTable, SummaryFacts } from "./pieces";
import { differenceView } from "./wizard";

/**
 * Pack J import wizard pieces (JW3a, Stitch `import-wizard-desktop`): the reconcile blocks (money in ink, the badge
 * explains), the row issues table, the parallel cycle's per-unit differences, the go-live checklist and the summary
 * facts of the sticky panel.
 */
const meta: Meta = {
  title: "Juristic/Import",
  decorators: [
    (Story) => (
      <ShellStory zone="owner" pathname="/juristic/import">
        <div className="flex max-w-5xl flex-col gap-6 p-6">
          <Story />
        </div>
      </ShellStory>
    ),
  ],
};
export default meta;

const items: Schemas["JuristicReconcileItemDto"][] = [
  {
    key: "receivables",
    kind: "receivables",
    label: "receivables",
    imported: "612450.00",
    reference: "612450.00",
    difference: "0.00",
    status: "match",
  },
  {
    key: "bank:2",
    kind: "bank",
    label: "operating ••4012",
    imported: "2186330.15",
    reference: "2184330.15",
    difference: "2000.00",
    status: "mismatch",
  },
  {
    key: "bank:3",
    kind: "bank",
    label: "fund กองทุนสำรอง",
    imported: "880000.00",
    reference: null,
    difference: null,
    status: "no_statement",
  },
];

export const ReconcileBlocks: StoryObj = {
  render: () => (
    <Card className="flex flex-col gap-8">
      {items.map((item) => (
        <ReconcileBlock key={item.key} item={item} locale="th" />
      ))}
    </Card>
  ),
};

const rows: Schemas["JuristicImportRowDto"][] = [
  {
    sheet: "register",
    rowNo: 7,
    data: { unit_no: "B-106", owner_name: "กาญจนา ทองคำ", share_pct: "100", phone: "0811045640", id_last4: null },
    errors: [{ column: "id_last4", code: "id_full_refused", message: "ไม่รับเลขบัตรเต็ม (PDPA) — ใส่เฉพาะ 4 ตัวท้าย" }],
    warnings: [],
  },
  {
    sheet: "register",
    rowNo: 19,
    data: { unit_no: "B-303", owner_name: "ณัฐวุฒิ ใจดี", share_pct: "100", phone: "0811150437" },
    errors: [{ column: "share_pct", code: "shares_exceeded", message: "สัดส่วนของห้อง B-303 รวมกันเกิน 100% (150%)" }],
    warnings: [],
  },
  {
    sheet: "register",
    rowNo: 33,
    data: { unit_no: "B-506", owner_name: "อนุชา วงศ์ทอง", share_pct: "100", phone: "02-123" },
    errors: [{ column: "phone", code: "phone", message: "เบอร์โทรไม่ถูกต้อง เช่น 0812345678" }],
    warnings: [{ column: "share_pct", code: "shares_incomplete", message: "สัดส่วนของห้อง B-506 รวมกันไม่ถึง 100%" }],
  },
];

export const RowIssues: StoryObj = {
  render: () => (
    <Card padding="none" className="overflow-hidden">
      <RowIssuesTable sheet="register" rows={rows} locale="th" />
    </Card>
  ),
};

const diff = (
  n: number,
  unitNo: string,
  computed: string,
  legacy: string,
  difference: string,
  explanation: string | null = null,
) => ({
  id: `d${n}`,
  unitId: null,
  unitNo,
  computed,
  legacy,
  difference,
  explanation,
  explainedAt: explanation ? "2026-11-05T10:00:00+07:00" : null,
});

export const Differences: StoryObj = {
  render: () => (
    <Card padding="none" className="overflow-hidden">
      <DifferencesTable
        locale="th"
        rows={
          differenceView(
            [
              diff(1, "B-101", "1043.10", "1043.10", "0.00"),
              diff(2, "B-205", "1254.55", "1204.55", "50.00"),
              diff(3, "B-503", "1677.45", "1797.45", "-120.00", "ระบบเดิมรวมค่าที่จอดรถคันที่สองไว้ในค่าส่วนกลาง"),
              diff(4, "B-708", "1043.10", "1007.60", "35.50"),
            ],
            "all",
          ).rows
        }
      />
    </Card>
  ),
};

export const Checklist: StoryObj = {
  render: () => (
    <Card>
      <GoLiveChecklist
        checks={[
          { key: "reconcile", state: "done", values: { explained: 1 } },
          { key: "parallel", state: "done", values: { units: 48 } },
          { key: "differences", state: "todo", values: { different: 3, unexplained: 2 } },
        ]}
      />
    </Card>
  ),
};

export const Summary: StoryObj = {
  render: () => (
    <Card className="max-w-sm">
      <SummaryFacts
        title="สรุปข้อมูลที่นำเข้า"
        facts={[
          { key: "units", icon: IconBuilding, label: "ห้องในอาคาร", value: "48 ห้อง" },
          { key: "owners", icon: IconResidents, label: "เจ้าของร่วมและผู้รับบิล", value: "53 คน" },
          { key: "arrears", icon: IconBill, label: "ห้องที่มียอดค้างยกมา", value: "12 ห้อง" },
          { key: "receivables", icon: IconWallet, label: "ยอดค้างยกมารวม", value: "฿612,450.00" },
          { key: "history", icon: IconHistory, label: "ประวัติการชำระ", value: "36 รายการ" },
        ]}
      />
    </Card>
  ),
};
