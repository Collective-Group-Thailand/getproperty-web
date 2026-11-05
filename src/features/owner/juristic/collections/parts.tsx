import { useTranslations } from "next-intl";

import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconLetter } from "@/ui/icons/glyphs/letter";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconSms } from "@/ui/icons/glyphs/sms";
import { cn } from "@/ui/lib/cn";

import { channelList, nextStepBadge, type CollectionChannel } from "./receivables";

const CHANNEL_ICON: Record<CollectionChannel, IconGlyph> = {
  line: IconChat,
  email: IconMail,
  sms: IconSms,
  letter: IconLetter,
};

/** The channels that reach the owner, as quiet icons with their names for screen readers and on hover. */
export function ChannelIcons({ channels, className }: { channels: readonly string[]; className?: string }) {
  const t = useTranslations("owner.collections.channel");
  const list = channelList(channels);
  if (list.length === 0) return <span className="text-muted text-sm">—</span>;
  return (
    <ul className={cn("m-0 flex list-none items-center gap-1.5 p-0", className)} data-testid="receivable-channels">
      {list.map((channel) => (
        <li
          key={channel}
          title={t(channel)}
          className="border-border text-muted rounded-thumb flex size-7 items-center justify-center border"
        >
          <Icon icon={CHANNEL_ICON[channel]} size={15} />
          <span className="sr-only">{t(channel)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The next-step badge of an account (J-DESIGN §3): icon + words, the date where there is one. A legal step counsel has
 * not confirmed reads "รอทนายยืนยัน" with a lock (O-038) — never as something about to happen.
 */
export function NextStepBadgeView({
  row,
  locale,
}: {
  row: Pick<Schemas["ReceivableRowDto"], "disputeOpen" | "planId" | "nextStep">;
  locale: Locale;
}) {
  const t = useTranslations("owner.collections");
  const badge = nextStepBadge(row);
  const day = (value: string) => formatDate(value, locale, { style: "dayMonth" });
  switch (badge.kind) {
    case "none":
      return <span className="text-muted text-sm">{t("next.none")}</span>;
    case "dispute":
      return (
        <Badge tone="neutral" icon={badge.icon}>
          {t("next.dispute")}
        </Badge>
      );
    case "plan":
      return (
        <Badge tone="primary" icon={badge.icon}>
          {t("next.plan")}
        </Badge>
      );
    case "approval":
      return (
        <Badge tone="warning" icon={badge.icon}>
          {t("next.approval", { step: t(`action.${badge.action}`) })}
        </Badge>
      );
    case "locked":
      return (
        <Badge tone="neutral" icon={badge.icon}>
          {t("next.locked", { step: t(`action.${badge.action}`) })}
        </Badge>
      );
    case "step":
      return (
        <Badge tone={badge.tone} icon={badge.icon}>
          {t("next.step", { step: t(`action.${badge.action}`), date: day(badge.date) })}
        </Badge>
      );
  }
}
