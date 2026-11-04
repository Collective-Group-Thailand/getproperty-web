import type { Meta, StoryObj } from "@storybook/react-vite";

import { WizardSections } from "./WizardSections";

const meta: Meta<typeof WizardSections> = { title: "Forms/WizardSections", component: WizardSections };
export default meta;

export const SecondStep: StoryObj<typeof WizardSections> = {
  render: () => (
    <WizardSections
      current={1}
      steps={[
        { key: "floors", label: "ชั้น", summary: "ชั้น 2, ชั้น 3" },
        { key: "numbers", label: "เลขห้อง" },
        { key: "confirm", label: "ตรวจสอบ" },
        { key: "done", label: "เสร็จ" },
      ]}
    >
      <p>ตั้งรูปแบบเลขห้อง</p>
    </WizardSections>
  ),
};
