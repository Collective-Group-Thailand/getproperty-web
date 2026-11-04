import type { Meta, StoryObj } from "@storybook/react-vite";

import { DisclosureSheet } from "./DisclosureSheet";

const meta: Meta<typeof DisclosureSheet> = { title: "Overlays/DisclosureSheet", component: DisclosureSheet };
export default meta;

export const MeterLine: StoryObj<typeof DisclosureSheet> = {
  render: () => (
    <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
      <span>E-A-201 · ใช้ไป 212.4 kWh</span>
      <DisclosureSheet label="ดูเลขมิเตอร์" title="มิเตอร์ E-A-201" closeLabel="ปิด">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted">เลขก่อนหน้า</dt>
          <dd className="font-mono tabular-nums">12300.000</dd>
          <dt className="text-muted">เลขล่าสุด</dt>
          <dd className="font-mono tabular-nums">12512.400</dd>
        </dl>
      </DisclosureSheet>
    </p>
  ),
};
