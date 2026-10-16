import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card } from "./Card";
import { Skeleton, SkeletonText } from "./Skeleton";

const meta: Meta<typeof Skeleton> = { title: "Feedback/Skeleton", component: Skeleton };
export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Card_: Story = {
  name: "Card",
  render: () => (
    <Card className="max-w-sm space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-9 w-1/2" />
      <SkeletonText lines={2} />
    </Card>
  ),
};
