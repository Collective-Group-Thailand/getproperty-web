import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { ActionPanel, DetailLayout } from "./DetailLayout";

const meta: Meta<typeof DetailLayout> = { title: "Layout/DetailLayout", component: DetailLayout };
export default meta;

export const Default: StoryObj<typeof DetailLayout> = {
  render: () => (
    <DetailLayout
      panel={
        <ActionPanel
          title="ขั้นต่อไป"
          status={<Badge tone="warning">รอตรวจห้อง</Badge>}
          description="ตรวจห้องก่อนคืนเงินประกัน"
          facts={[
            { key: "held", label: "เงินประกัน", value: "฿4,500.00" },
            { key: "due", label: "คืนภายใน", value: "6 พ.ย. 2569" },
          ]}
          primary={<Button>บันทึกผลตรวจห้อง</Button>}
          secondary={<Button variant="secondary">ส่งข้อความถึงผู้เช่า</Button>}
          destructive={<Button variant="destructive">ยกเลิกการคืน</Button>}
        />
      }
    >
      <Card>
        <p>ข้อมูลสัญญาและเงินประกัน</p>
      </Card>
    </DetailLayout>
  ),
};

/** A record whose state leads the panel (G4): the SLA clock of a repair request above its next steps. */
export const WithSummary: StoryObj<typeof DetailLayout> = {
  render: () => (
    <DetailLayout
      panel={
        <ActionPanel
          summary={
            <div className="flex flex-col gap-1">
              <span className="text-warning-subtle-fg font-medium">เหลือ 45 นาที</span>
              <span className="text-muted text-sm">ครบกำหนด 4 พ.ย. 2569 16:04 · SLA 24 ชม.</span>
            </div>
          }
          title="ขั้นต่อไป"
          primary={<Button>เปิดใบงาน</Button>}
          secondary={<Button variant="secondary">คัดกรอง</Button>}
          destructive={<Button variant="destructive">ยกเลิกคำขอ</Button>}
        />
      }
    >
      <Card>
        <p>ก๊อกน้ำอ่างล้างหน้ารั่ว น้ำหยดตลอดเวลา</p>
      </Card>
    </DetailLayout>
  ),
};
