import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconAlert } from "../icons/glyphs/alert";
import { IconTimer } from "../icons/glyphs/timer";
import { IconWarning } from "../icons/glyphs/warning";
import { StatusText } from "./StatusText";

const meta: Meta<typeof StatusText> = { title: "Data/StatusText", component: StatusText };
export default meta;

export const Clocks: StoryObj<typeof StatusText> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <StatusText tone="danger" icon={IconAlert} detail="ครบกำหนด 3 พ.ย. 2569 14:04 · SLA 24 ชม.">
        เกิน SLA 6 ชม.
      </StatusText>
      <StatusText tone="warning" icon={IconTimer} detail="ครบกำหนด 4 พ.ย. 2569 21:49 · SLA 8 ชม.">
        เหลือ 45 นาที
      </StatusText>
      <StatusText icon={IconTimer} detail="ครบกำหนด 5 พ.ย. 2569 16:04 · SLA 24 ชม.">
        เหลือ 20 ชม.
      </StatusText>
      <StatusText tone="warning" icon={IconWarning}>
        ยังขาด: เลขหนังสือเดินทาง
      </StatusText>
    </div>
  ),
};
