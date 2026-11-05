import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShellStory } from "@/features/shared/storybook/ShellStory";
import type { Schemas } from "@/lib/api/types";

import { LadderSteps } from "./LadderEditor";
import { ChannelIcons, NextStepBadgeView } from "./parts";

/** Pack J collection pieces (JW1b): the next-step badge, channel icons, the ladder editor. */
const meta: Meta = {
  title: "Juristic/Collections",
  decorators: [
    (Story) => (
      <ShellStory zone="owner" pathname="/juristic/receivables">
        <div className="max-w-4xl p-6">
          <Story />
        </div>
      </ShellStory>
    ),
  ],
};
export default meta;

const step = (
  seq: number,
  action: Schemas["CollectionAction"],
  offsetDays: number,
  patch: Partial<Schemas["CollectionStepDto"]> = {},
): Schemas["CollectionStepDto"] => ({
  id: `step-${seq}`,
  seq,
  action,
  offsetDays,
  channels: ["line", "email"],
  templateKey: `juristic.collection.${action}`,
  requiresApproval: false,
  enabled: action === "remind",
  legalReviewRequired: action !== "remind",
  gateClosedReason: action === "remind" ? null : "letter_wording_unverified",
  version: 1,
  ...patch,
});

export const NextStepBadges: StoryObj = {
  render: () => {
    const next = (kind: Schemas["CollectionAction"], patch: Partial<Schemas["ReceivableNextStepDto"]> = {}) => ({
      kind,
      date: "2026-11-12",
      legalReviewRequired: false,
      awaitingApproval: false,
      ...patch,
    });
    return (
      <div className="flex flex-wrap gap-3">
        <NextStepBadgeView locale="th" row={{ disputeOpen: false, planId: null, nextStep: next("remind") }} />
        <NextStepBadgeView locale="th" row={{ disputeOpen: false, planId: null, nextStep: next("surcharge") }} />
        <NextStepBadgeView
          locale="th"
          row={{ disputeOpen: false, planId: null, nextStep: next("notice_letter", { legalReviewRequired: true }) }}
        />
        <NextStepBadgeView
          locale="th"
          row={{ disputeOpen: false, planId: null, nextStep: next("lawyer_letter", { awaitingApproval: true }) }}
        />
        <NextStepBadgeView locale="th" row={{ disputeOpen: false, planId: "p", nextStep: null }} />
        <NextStepBadgeView locale="th" row={{ disputeOpen: true, planId: null, nextStep: null }} />
      </div>
    );
  },
};

export const Channels: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <ChannelIcons channels={["line", "email", "sms", "letter"]} />
      <ChannelIcons channels={["letter"]} />
      <ChannelIcons channels={[]} />
    </div>
  ),
};

export const Ladder: StoryObj = {
  render: () => (
    <LadderSteps
      canManage
      officeName="นิติบุคคล เดอะ ริเวอร์ไซด์"
      ladder={{
        id: "ladder",
        legalForm: "condo_act",
        name: "ขั้นตอนติดตามยอดค้าง — อาคารชุด",
        sourceTemplateKey: "condo_act",
        steps: [
          step(1, "remind", 3),
          step(2, "remind", 15, { channels: ["line", "email", "sms"] }),
          step(3, "surcharge", 30, { enabled: true, gateClosedReason: null }),
          step(4, "notice_letter", 45, { channels: ["letter", "line"] }),
          step(5, "lawyer_letter", 90, { requiresApproval: true, channels: ["letter"] }),
        ],
      }}
    />
  ),
};
