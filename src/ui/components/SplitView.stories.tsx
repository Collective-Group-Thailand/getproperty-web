import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { Card } from "./Card";
import { RowList } from "./RowList";
import { SplitView } from "./SplitView";

const meta: Meta<typeof SplitView> = {
  title: "Layout/SplitView",
  component: SplitView,
  args: {
    list: (
      <RowList
        label="คิวตรวจประกาศ"
        items={[
          {
            key: "1",
            href: "#1",
            current: true,
            title: "ห้องสตูดิโอใกล้ BTS อารีย์",
            meta: "พญาไท · หอพักตัวอย่าง",
            figure: "฿8,500",
            status: (
              <Badge size="sm" tone="info">
                ประกาศใหม่
              </Badge>
            ),
          },
          {
            key: "2",
            href: "#2",
            title: "คอนโดริมน้ำ 1 ห้องนอน",
            meta: "คลองสาน · ริมน้ำ",
            figure: "฿12,000",
            status: (
              <Badge size="sm" tone="warning">
                มีรายงาน 3
              </Badge>
            ),
          },
        ]}
      />
    ),
    detail: <Card>ตัวอย่างประกาศที่เลือก</Card>,
  },
};
export default meta;
export const Default: StoryObj<typeof SplitView> = {};
