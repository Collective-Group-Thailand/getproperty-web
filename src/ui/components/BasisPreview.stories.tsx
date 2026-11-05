import type { Meta, StoryObj } from "@storybook/react-vite";

import { BasisPreview } from "./BasisPreview";

const meta: Meta<typeof BasisPreview> = {
  title: "Data/BasisPreview",
  component: BasisPreview,
  args: {
    caption: "ค่าส่วนกลางต่อห้อง ต่อไตรมาส",
    amountHeader: "ต่อไตรมาส",
    rows: [
      { key: "min", label: "น้อยที่สุด", amount: "฿12,341.29", detail: "A-101 · 0.043476" },
      { key: "median", label: "ค่ากลาง", amount: "฿16,149.61" },
      { key: "max", label: "มากที่สุด", amount: "฿24,795.84", detail: "A-404 · 0.087354" },
    ],
    check: { ok: true, label: "รวมทุกห้อง = งบ ✓", detail: "฿283,641.97 ต่อไตรมาส จาก 16 ห้อง" },
  },
};
export default meta;
export const Matches: StoryObj<typeof BasisPreview> = {};

/** Units without the weight: nothing can be drafted until the register has it. */
export const MissingWeights: StoryObj<typeof BasisPreview> = {
  args: {
    check: {
      ok: false,
      label: "ยังแบ่งไม่ได้ — 2 ห้องยังไม่มีอัตราส่วนกรรมสิทธิ์",
      detail: "เติมในทะเบียนเจ้าของร่วมก่อน",
    },
  },
};

export const Updating: StoryObj<typeof BasisPreview> = { args: { busy: true } };
