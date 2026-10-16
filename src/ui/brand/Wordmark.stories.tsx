import type { Meta, StoryObj } from "@storybook/react-vite";

import { Mark } from "./Mark";
import { Wordmark } from "./Wordmark";

const meta: Meta<typeof Wordmark> = { title: "Brand/Wordmark", component: Wordmark };
export default meta;
type Story = StoryObj<typeof Wordmark>;

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-6">
      <Wordmark size="sm" />
      <Wordmark size="md" />
      <Wordmark size="lg" />
      <Wordmark compact />
      <Mark size={64} className="text-primary" />
    </div>
  ),
};
