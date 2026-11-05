import type { Meta, StoryObj } from "@storybook/react-vite";

import { BulkBar } from "./BulkBar";
import { Button } from "./Button";
import { IconBell } from "../icons/glyphs/bell";
import { IconPause } from "../icons/glyphs/pause";
import { IconRepeat } from "../icons/glyphs/repeat";

const meta: Meta<typeof BulkBar> = {
  title: "Data/BulkBar",
  component: BulkBar,
  args: {
    label: "จัดการรายการที่เลือก",
    selection: "เลือกแล้ว 3 ราย · ยอดค้างรวม ฿148,800.00",
    actions: (
      <>
        <Button size="sm" variant="secondary" iconStart={IconBell}>
          ส่งเตือน
        </Button>
        <Button size="sm" variant="secondary" iconStart={IconRepeat}>
          เสนอแผนผ่อน
        </Button>
        <Button size="sm" variant="secondary" iconStart={IconPause}>
          พักการติดตาม
        </Button>
      </>
    ),
    clear: (
      <Button size="sm" variant="ghost">
        ยกเลิกการเลือก
      </Button>
    ),
  },
};
export default meta;

export const Default: StoryObj<typeof BulkBar> = {};
