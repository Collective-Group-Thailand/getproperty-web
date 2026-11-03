import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { Field } from "./Field";
import { Input } from "./Input";
import { FormColumns, FormSection, FormSummary, MobileActionBar, StickySave } from "./FormLayout";

const meta: Meta<typeof FormColumns> = { title: "Layout/FormLayout", component: FormColumns };
export default meta;

export const Default: StoryObj<typeof FormColumns> = {
  render: () => (
    <>
      <FormColumns
        summary={
          <FormSummary
            title="สรุปสัญญา"
            rows={[
              { key: "rent", label: "ค่าเช่า", value: "฿4,500.00" },
              { key: "deposit", label: "เงินประกัน", value: "฿9,000.00" },
            ]}
            total={{ label: "รับวันเข้าอยู่", value: "฿13,500.00" }}
            action={<Button>บันทึกสัญญา</Button>}
          />
        }
      >
        <FormSection number={1} title="ผู้เช่า" description="ใครจะเข้าอยู่ห้องนี้">
          <Field label="ชื่อผู้เช่า">
            <Input />
          </Field>
          <StickySave status="ยังไม่ได้บันทึก">
            <Button>บันทึก</Button>
          </StickySave>
        </FormSection>
      </FormColumns>
      <MobileActionBar aboveNav={false} summary="฿13,500.00">
        <Button>บันทึกสัญญา</Button>
      </MobileActionBar>
    </>
  ),
};
