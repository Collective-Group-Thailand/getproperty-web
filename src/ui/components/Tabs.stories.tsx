import type { Meta, StoryObj } from "@storybook/react-vite";

import { TabPanel, Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Navigation/Tabs",
  component: Tabs,
  args: {
    label: "สัญญาเช่า",
    defaultValue: "bills",
    tabs: [
      { value: "details", label: "รายละเอียด" },
      { value: "bills", label: "บิล", count: 3 },
      { value: "documents", label: "เอกสาร" },
      { value: "history", label: "ประวัติ", disabled: true },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabPanel value="details" className="py-4">
        รายละเอียดสัญญา
      </TabPanel>
      <TabPanel value="bills" className="py-4">
        บิล 3 ใบ
      </TabPanel>
      <TabPanel value="documents" className="py-4">
        เอกสาร
      </TabPanel>
    </Tabs>
  ),
};
