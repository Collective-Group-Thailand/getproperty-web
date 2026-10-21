import type { Meta, StoryObj } from "@storybook/react-vite";

import { Mark } from "./Mark";
import { Wordmark } from "./Wordmark";

const meta: Meta<typeof Wordmark> = {
  title: "Brand/Wordmark",
  component: Wordmark,
  args: { size: "md", tone: "auto", compact: false, decorative: false },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    tone: { control: "inline-radio", options: ["auto", "onDark"] },
  },
};
export default meta;
type Story = StoryObj<typeof Wordmark>;

/** The founder's logo: "getproper" navy, the house "ty" blue, the chimney's sky → azure gradient. */
export const Default: Story = {};

/** Sized by height: sm 28 px (top bars, sign-in), md 36 px, lg 56 px (marketing hero). */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-6">
      <Wordmark size="sm" />
      <Wordmark size="md" />
      <Wordmark size="lg" />
    </div>
  ),
};

/** The house alone — collapsed sidebar, a phone's top bar. `compact` and `<Mark>` are the same drawing. */
export const Compact: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <Wordmark compact size="sm" />
      <Wordmark compact size="md" />
      <Mark size="lg" />
      <Mark size={96} />
    </div>
  ),
};

/** The founder's one-colour white version, on the brand blue. */
export const OnDark: Story = {
  render: () => (
    <div className="bg-primary rounded-card flex items-center gap-6 p-6">
      <Wordmark tone="onDark" size="md" />
      <Mark tone="onDark" size="md" />
    </div>
  ),
};

/** The `auto` tone on the dark theme: the founder's one-colour white version (`logo-*` tokens). */
export const Dark: Story = {
  globals: { theme: "dark" },
  render: () => (
    <div className="bg-bg flex items-center gap-6 p-6">
      <Wordmark size="sm" />
      <Mark size="sm" />
    </div>
  ),
};

/** High contrast keeps the founder's colours (navy 12 : 1, blue 8.1 : 1 on white). */
export const HighContrast: Story = {
  globals: { theme: "hc" },
  render: () => (
    <div className="bg-bg flex items-center gap-6 p-6">
      <Wordmark size="sm" />
      <Mark size="sm" />
    </div>
  ),
};

/** Many instances on one page keep their own gradient ids (useId), so every chimney keeps its gradient. */
export const ManyInstances: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: 6 }, (_, index) => (
        <Mark key={index} size="sm" decorative={index > 0} />
      ))}
    </div>
  ),
};
