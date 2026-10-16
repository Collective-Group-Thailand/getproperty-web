import type { ColumnDef } from "@tanstack/react-table";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { MoneyDisplay } from "./MoneyDisplay";

interface Row {
  room: string;
  resident: string;
  amount: string;
  status: "paid" | "due" | "overdue";
}

const ROWS: Row[] = [
  { room: "A-301", resident: "คุณสมชาย", amount: "4850.50", status: "paid" },
  { room: "A-302", resident: "คุณมาลี", amount: "5120.00", status: "due" },
  { room: "B-101", resident: "คุณอนันต์", amount: "3980.25", status: "overdue" },
];

const STATUS = {
  paid: { tone: "success", label: "จ่ายแล้ว" },
  due: { tone: "warning", label: "ครบกำหนดใน 3 วัน" },
  overdue: { tone: "danger", label: "ค้างชำระ" },
} as const;

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "room", header: "ห้อง", cell: (c) => <span className="font-mono">{c.getValue<string>()}</span> },
  { accessorKey: "resident", header: "ผู้เช่า" },
  {
    accessorKey: "amount",
    header: "ยอดบิล",
    meta: { numeric: true },
    cell: (c) => <MoneyDisplay amount={c.getValue<string>()} />,
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    enableSorting: false,
    cell: (c) => {
      const s = STATUS[c.getValue<Row["status"]>()];
      return <Badge tone={s.tone}>{s.label}</Badge>;
    },
  },
];

const meta: Meta<typeof DataTable<Row>> = {
  title: "Data/DataTable",
  component: DataTable,
  args: { columns, data: ROWS, caption: "บิลรอบ ก.ย. 2569" },
};
export default meta;
type Story = StoryObj<typeof DataTable<Row>>;

export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = {
  args: {
    data: [],
    empty: <EmptyState icon="bill" title="ยังไม่มีบิลในรอบนี้" description="ออกบิลเมื่อเลขมิเตอร์ครบทุกห้อง" />,
  },
};
export const Compact: Story = { args: { density: "compact" } };
