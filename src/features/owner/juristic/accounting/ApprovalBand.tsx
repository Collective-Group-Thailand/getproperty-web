import { getTranslations } from "next-intl/server";

import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { ProgressLine } from "@/ui/components/ProgressLine";
import { StatusText } from "@/ui/components/StatusText";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import {
  approvalProgress,
  approveBlock,
  bandIndexFor,
  bandRange,
  snapshotRange,
  type ApprovalBand,
  type BandRange,
} from "./bands";
import { memberName } from "./parts";

/** "ยอดไม่เกิน ฿10,000.00", "ยอดมากกว่า ฿10,000.00 ถึง ฿100,000.00", "ยอดมากกว่า ฿100,000.00" */
export async function bandRangeText(range: BandRange, locale: Locale): Promise<string> {
  const t = await getTranslations("owner.accounting.band");
  const money = (value: string) => formatTHB(value, locale);
  switch (range.kind) {
    case "upTo":
      return t("upTo", { amount: money(range.upTo) });
    case "between":
      return t("between", { above: money(range.above), upTo: money(range.upTo) });
    case "above":
      return t("above", { amount: money(range.above) });
    default:
      return t("any");
  }
}

/** "เจ้าของ · ผู้จัดการ · กรรมการ" */
async function rolesText(roles: readonly string[]): Promise<string> {
  const t = await getTranslations("owner.accounting.band.role");
  return roles.map((role) => t(role as "owner")).join(" · ");
}

/**
 * Who must approve an expense request and how far it is (D-311, D-329): the band in words ("ยอดไม่เกิน ฿100,000 ต้อง
 * อนุมัติ 2 คน จาก เจ้าของ · ผู้จัดการ · กรรมการ"), a progress line of approvals given / required, each decision with
 * the person and time, and — when the viewer cannot approve — why, maker ≠ checker first. A draft shows the band the
 * amount would fall in from the settings (`bands`); once submitted, the API's snapshot.
 */
export async function ApprovalBandPanel({
  request,
  bands,
  members,
  viewer,
  locale,
}: {
  request: Schemas["ExpenseRequestDto"];
  bands: ApprovalBand[];
  members: Schemas["MemberDto"][];
  viewer: { userId: string; roles: string[]; canApprove: boolean };
  locale: Locale;
}) {
  const t = await getTranslations("owner.accounting.band");
  const common = await getTranslations("owner.accounting.common");
  const draftIndex = request.band ? -1 : bandIndexFor(request.amount, bands);
  const band = request.band ?? (draftIndex >= 0 ? bands[draftIndex] : null);
  if (!band) return <p className="text-muted m-0 text-sm">{t("noBands")}</p>;
  const range = request.band ? snapshotRange(request.band) : bandRange(bands, draftIndex);
  const progress = approvalProgress(request);
  const required = request.band ? progress.required : band.approvals;
  const block = request.state === "submitted" ? approveBlock(request, viewer) : null;
  const decided = request.approvals;
  return (
    <div className="flex flex-col gap-3" data-testid="approval-band">
      <p className="m-0 text-sm" data-testid="approval-band-rule">
        {t(request.band ? "rule" : "ruleDraft", {
          range: await bandRangeText(range, locale),
          count: required,
          roles: await rolesText(band.roles),
        })}
      </p>
      {request.state === "draft" ? null : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted">{t("progress")}</span>
            <span className="font-medium tabular-nums" data-testid="approval-progress">
              {t("given", { given: progress.given, required })}
            </span>
          </div>
          <ProgressLine share={progress.share} label={t("given", { given: progress.given, required })} />
        </div>
      )}
      {decided.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="approval-list">
          {decided.map((approval) => (
            <li key={`${approval.approverUserId}-${approval.createdAt}`} className="flex flex-col gap-0.5 text-sm">
              <StatusText
                tone={approval.decision === "approved" ? "success" : "neutral"}
                icon={approval.decision === "approved" ? IconCheckCircle : IconXCircle}
                detail={formatDateTime(approval.createdAt, locale)}
              >
                {t(approval.decision === "approved" ? "approvedBy" : "rejectedBy", {
                  name: memberName(members, approval.approverUserId, common("unknownMember")),
                  role: t(`role.${approval.role}`),
                })}
              </StatusText>
              {approval.reason ? (
                <span className="text-muted ps-6">{t("quoted", { reason: approval.reason })}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : request.state === "submitted" ? (
        <StatusText tone="muted" icon={IconClock}>
          {t("noneYet")}
        </StatusText>
      ) : null}
      {block && block !== "state" ? (
        <p
          className="bg-bg-subtle rounded-control m-0 flex items-start gap-2 p-3 text-sm"
          data-testid="approve-block"
          data-block={block}
        >
          <Icon icon={IconInfo} className="text-subtle mt-0.5 shrink-0" />
          <span>{t(`block.${block}`)}</span>
        </p>
      ) : null}
    </div>
  );
}
