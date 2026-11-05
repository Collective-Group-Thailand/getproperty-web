import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconSiren } from "../icons/glyphs/siren";
import { Button } from "./Button";
import { TakeoverBanner } from "./TakeoverBanner";

const meta: Meta<typeof TakeoverBanner> = {
  title: "Gate/TakeoverBanner",
  component: TakeoverBanner,
  args: {
    icon: IconSiren,
    title: "SOS · ไฟไหม้ · บ้าน 99/12",
    meta: "ผู้อยู่อาศัยแจ้ง · 22:41 (2 นาทีที่แล้ว) · รถในโครงการช่วงเกิดเหตุ 4 คัน",
    children: (
      <Button variant="secondary" size="xl">
        รับทราบเหตุ
      </Button>
    ),
  },
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Open: StoryObj<typeof TakeoverBanner> = {};
export const Acknowledged: StoryObj<typeof TakeoverBanner> = {
  args: {
    tone: "acknowledged",
    children: (
      <Button variant="secondary" size="xl">
        ปิดเหตุ
      </Button>
    ),
  },
};
