import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconButton } from "./IconButton";
import { Popover } from "./Popover";
import { IconHelp } from "../icons/glyphs/help";

const meta: Meta<typeof Popover> = {
  title: "Overlays/Popover",
  component: Popover,
  args: {
    defaultOpen: true,
    trigger: <IconButton icon={IconHelp} label="ค่า Ft คืออะไร?" size="sm" />,
    children: "ค่า Ft คือค่าไฟฟ้าผันแปรที่การไฟฟ้ากำหนดทุก 4 เดือน ระบบใช้ค่าล่าสุดเสมอ และห้ามเก็บเกินกว่านี้",
  } as React.ComponentProps<typeof Popover> & { defaultOpen?: boolean },
};
export default meta;
type Story = StoryObj<typeof Popover>;

export const Help: Story = { render: ({ trigger, children }) => <Popover trigger={trigger}>{children}</Popover> };
