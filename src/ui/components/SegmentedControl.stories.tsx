import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { SegmentedControl } from "./SegmentedControl";
import { IconElectric } from "../icons/glyphs/electric";
import { IconWater } from "../icons/glyphs/water";

const meta: Meta<typeof SegmentedControl> = {
  title: "Navigation/SegmentedControl",
  component: SegmentedControl,
  args: {
    label: "สาธารณูปโภค",
    value: "electric",
    options: [
      { value: "electric", label: "ไฟฟ้า", icon: IconElectric },
      { value: "water", label: "น้ำ", icon: IconWater },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof SegmentedControl>;

function Demo(args: React.ComponentProps<typeof SegmentedControl>) {
  const [value, setValue] = useState(args.value);
  return <SegmentedControl {...args} value={value} onValueChange={setValue} />;
}

export const Default: Story = { render: (args) => <Demo {...args} /> };
export const Large: Story = { render: (args) => <Demo {...args} size="lg" /> };
/** `fullWidth` on a 360 px phone: the segments share the width and long Thai labels wrap instead of overflowing. */
export const FullWidth: Story = {
  args: {
    label: "ผู้ให้บริการไฟฟ้า",
    value: "mea",
    options: [
      { value: "mea", label: "การไฟฟ้านครหลวง (กฟน.)" },
      { value: "pea", label: "การไฟฟ้าส่วนภูมิภาค (กฟภ.)" },
    ],
  },
  render: (args) => (
    <div className="w-[328px]">
      <Demo {...args} fullWidth />
    </div>
  ),
};
