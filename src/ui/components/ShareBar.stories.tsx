import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShareBar } from "./ShareBar";

const meta: Meta<typeof ShareBar> = {
  title: "Data/ShareBar",
  component: ShareBar,
  args: {
    label: "สัดส่วนกรรมสิทธิ์ห้อง A-101",
    segments: [
      { key: "a", label: "คุณศิริพร วงศ์สุวรรณ", share: "60", fraction: 0.6 },
      { key: "b", label: "คุณกิตติศักดิ์ พานิชกิจ", share: "40", fraction: 0.4 },
    ],
  },
};
export default meta;
export const Complete: StoryObj<typeof ShareBar> = {};

/** The register misses an owner: the empty part of the track and its word. */
export const Incomplete: StoryObj<typeof ShareBar> = {
  args: {
    label: "สัดส่วนกรรมสิทธิ์ห้อง A-102",
    segments: [{ key: "a", label: "นายธนดล เจริญทรัพย์", share: "50", fraction: 0.5 }],
    missing: "ยังขาด 50% — บิลค่าส่วนกลางของห้องนี้จะยังออกไม่ได้",
  },
};
