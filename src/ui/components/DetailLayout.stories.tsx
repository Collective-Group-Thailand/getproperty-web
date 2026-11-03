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
