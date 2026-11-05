import type { Meta, StoryObj } from "@storybook/react-vite";

import { GroupedTimeline } from "./GroupedTimeline";
import { IconBell } from "../icons/glyphs/bell";
import { IconDispute } from "../icons/glyphs/dispute";
import { IconFlag } from "../icons/glyphs/flag";
import { IconLock } from "../icons/glyphs/lock";
import { IconPercent } from "../icons/glyphs/percent";
import { Icon } from "../icons";

const meta: Meta<typeof GroupedTimeline> = {
  title: "Data/GroupedTimeline",
  component: GroupedTimeline,
  args: {
    pinned: (
      <div className="flex items-start gap-3">
        <Icon icon={IconLock} />
        <div className="flex flex-col">
          <span className="font-medium">ขั้นถัดไป · หนังสือแจ้งเตือน · 12 พ.ย. 2569</span>
          <span className="text-sm">ต้องให้ทนายยืนยันก่อนเปิดใช้ — ขั้นนี้จะยังไม่ถูกส่ง</span>
        </div>
      </div>
    ),
    groups: [
      {
        key: "2026-11",
        label: "พฤศจิกายน 2569",
        events: [
          {
            id: "d",
            title: "เปิดข้อโต้แย้ง",
            time: "3 พ.ย.",
            actor: "วศิน ผู้จัดการนิติ",
            icon: IconDispute,
            tone: "warning",
          },
        ],
      },
      {
        key: "2026-10",
        label: "ตุลาคม 2569",
        events: [
          {
            id: "s",
            title: "คิดเงินเพิ่ม ฿2,730.00",
            time: "20 ต.ค.",
            actor: "ระบบ",
            icon: IconPercent,
            tone: "primary",
          },
          {
            id: "r",
            title: "ส่งเตือนทาง LINE และอีเมล",
            time: "5 ต.ค.",
            actor: "ระบบ",
            icon: IconBell,
            tone: "primary",
          },
          { id: "o", title: "เริ่มติดตาม", time: "2 ต.ค.", icon: IconFlag },
        ],
      },
    ],
  },
};
export default meta;

export const Default: StoryObj<typeof GroupedTimeline> = {};
export const Empty: StoryObj<typeof GroupedTimeline> = {
  args: { pinned: undefined, groups: [], empty: <p className="text-muted text-sm">ยังไม่มีเหตุการณ์</p> },
};
