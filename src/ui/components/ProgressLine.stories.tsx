import type { Meta, StoryObj } from "@storybook/react-vite";

import { ProgressLine } from "./ProgressLine";

const meta: Meta<typeof ProgressLine> = {
  title: "Data/ProgressLine",
  component: ProgressLine,
  args: { share: 0.5, label: "อนุมัติแล้ว 1 จาก 2" },
  decorators: [
    (Story) => (
      <div className="w-64 p-6">
        <Story />
      </div>
    ),
  ],
};
export default meta;
export const Half: StoryObj<typeof ProgressLine> = {};
export const Done: StoryObj<typeof ProgressLine> = { args: { share: 1, label: "จับคู่แล้ว 24 จาก 24" } };
/** Information rather than progress (an approved request's approvals). */
export const Neutral: StoryObj<typeof ProgressLine> = { args: { share: 1, tone: "neutral" } };
