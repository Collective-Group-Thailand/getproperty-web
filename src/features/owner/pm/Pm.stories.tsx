import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShellStory } from "@/features/shared/storybook/ShellStory";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";

import {
  AcceptContractButton,
  AssignStaffButton,
  DeclineContractButton,
  EndAssignmentButton,
  TerminateContractButton,
} from "./PmActions";

/**
 * Pack J PM company actions (JW3b, D-334): staffing a managed building (assign with the exclusive end in words, end),
 * answering an offer (accept explains the read grant, decline asks a reason) and terminating from either side (the
 * first day without service, a reason and the typed phrase). Open each to see its dialog.
 */
const meta: Meta = {
  title: "PM/Actions",
  decorators: [
    (Story) => (
      <ShellStory zone="owner" pathname="/portfolio">
        <div className="flex max-w-md flex-col gap-4 p-6">
          <Story />
        </div>
      </ShellStory>
    ),
  ],
};
export default meta;

const contract = {
  id: "3c0a0c01-0000-4000-8000-000000000004",
  juristicTenantId: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c88",
  juristicName: "นิติบุคคลอาคารชุด เดอะ ริเวอร์ไซด์",
  pmTenantId: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c99",
  pmName: "บริษัท ศรีนคร พร็อพเพอร์ตี้ แมเนจเมนท์ จำกัด",
  buildingId: "5c8e0a01-0000-4000-8000-000000000004",
  buildingName: "อาคาร B",
  vendorId: null,
  title: "สัญญาจ้างบริหารจัดการ อาคาร B",
  scope: null,
  fee: "72760.00",
  vatAmount: "4760.00",
  feePeriod: "monthly",
  dueDay: 5,
  startsOn: "2026-11-24",
  endsOn: "2027-11-23",
  expenseAccountId: null,
  whtKey: null,
  resolutionId: null,
  documentId: null,
  state: "offered",
  access: { active: false, validFrom: null, validTo: null, revokedAt: null },
  feesRequested: 0,
  offeredAt: "2026-11-08T09:00:00+07:00",
  acceptedAt: null,
  declinedAt: null,
  declineReason: null,
  cancelledAt: null,
  cancelReason: null,
  terminatedOn: null,
  terminatedAt: null,
  terminatedBy: null,
  terminationReason: null,
  endedAt: null,
  note: null,
  nextActions: ["accept", "decline"],
  createdAt: "2026-11-04T09:00:00+07:00",
  version: 2,
} satisfies Schemas["ManagementContractDto"];

export const AnswerAnOffer: StoryObj = {
  render: () => (
    <Card className="flex flex-col gap-3">
      <AcceptContractButton contract={contract} />
      <DeclineContractButton contract={contract} />
    </Card>
  ),
};

export const Terminate: StoryObj = {
  render: () => (
    <Card>
      <TerminateContractButton
        contract={{ ...contract, state: "active", feesRequested: 10 }}
        side="pm"
        today="2026-11-10"
      />
    </Card>
  ),
};

export const Staffing: StoryObj = {
  render: () => (
    <Card className="flex flex-col items-start gap-3">
      <AssignStaffButton
        today="2026-11-10"
        buildings={[
          { contractId: "c1", buildingName: "อาคาร A", startsOn: "2026-01-14", endsOn: "2027-01-14" },
          { contractId: "c2", buildingName: "ชมวิว เรสซิเดนซ์ อาคาร 1", startsOn: "2025-06-28", endsOn: "2027-06-28" },
        ]}
        members={[
          { userId: "u1", displayName: "มานพ ช่างไฟฟ้า" },
          { userId: "u2", displayName: "ศิริพร ธุรการ" },
        ]}
      />
      <EndAssignmentButton assignmentId="a1" name="อรุณี ผู้จัดการอาคาร" building="อาคาร A" today="2026-11-10" />
    </Card>
  ),
};
