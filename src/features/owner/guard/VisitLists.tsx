"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { KioskButton as Button, KioskChip, KioskStatusLine } from "@/ui/components/Kiosk";
import { PolicyTimer } from "@/ui/components/PolicyTimer";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconLogOut } from "@/ui/icons/glyphs/log-out";
import { IconPhone } from "@/ui/icons/glyphs/phone";
import { IconQr } from "@/ui/icons/glyphs/qr";
import { IconSyncFailed } from "@/ui/icons/glyphs/sync-failed";
import { IconSyncPending } from "@/ui/icons/glyphs/sync-pending";
import { IconTimer } from "@/ui/icons/glyphs/timer";
import { IconUnlock } from "@/ui/icons/glyphs/unlock";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { cx as cn } from "@/ui/lib/cx";

import { KIND_ICONS } from "./EntryCard";
import type { GuardVisit } from "./lib/api";
import { formatPlate } from "./lib/plate";
import type { GateQueueEntry } from "./lib/queue";
import { bangkokTime, durationParts, formatStopwatch, policyProgress, sinceMs } from "./lib/timers";
import { useNow } from "./lib/useNow";

function minutesOf(visit: GuardVisit): number {
  if (!visit.respondBy) return 0;
  return Math.max(1, Math.round((Date.parse(visit.respondBy) - Date.parse(visit.createdAt)) / 60_000));
}

function Card({
  title,
  icon,
  count,
  aside,
  children,
  testId,
}: {
  title: string;
  icon: React.ComponentProps<typeof Icon>["icon"];
  count?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  testId: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="rounded-card border-border bg-surface shadow-card flex shrink-0 flex-col border"
      data-testid={testId}
    >
      <header className="border-border flex items-center gap-3 border-b px-5 py-3.5">
        <Icon icon={icon} size={24} className="text-muted" />
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {count}
        {aside ? <span className="text-muted ms-auto text-sm">{aside}</span> : null}
      </header>
      {children}
    </section>
  );
}

function PlateLine({ visit, unitLabel }: { visit: Pick<GuardVisit, "plate" | "unitNo">; unitLabel: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-mono text-xl font-semibold tracking-wide" data-testid="row-plate">
        {formatPlate(visit.plate) || "—"}
      </span>
      <span className="rounded-thumb bg-bg-subtle text-fg px-2 py-0.5 text-sm font-medium">{unitLabel}</span>
    </span>
  );
}

/**
 * "รอเจ้าของบ้านตอบ" (J-DESIGN §3): live timers with the progress line toward the house's window, the call-back flag
 * with the name of who asked, approved rows with the blue "เปิดไม้กั้น" (the documented second filled button of the
 * gate), denied and timed-out rows in words, and the offline entries that could not be sent.
 */
export function WaitingCard({
  visits,
  conflicts,
  hasBarrier,
  dismissed,
  onLetIn,
  onManage,
  onDismiss,
  onRetry,
  onDiscard,
}: {
  visits: readonly GuardVisit[];
  conflicts: readonly GateQueueEntry[];
  hasBarrier: boolean;
  dismissed: readonly string[];
  onLetIn: (visit: GuardVisit) => void;
  onManage: (visit: GuardVisit) => void;
  onDismiss: (visit: GuardVisit) => void;
  onRetry: (entry: GateQueueEntry) => void;
  onDiscard: (entry: GateQueueEntry) => void;
}) {
  const t = useTranslations("owner.guard");
  const now = useNow(1000);
  const shown = visits.filter((visit) => !dismissed.includes(visit.id));
  const total = shown.length + conflicts.length;
  const unitLabel = (unitNo: string | null) => (unitNo ? unitNo : t("waiting.noUnit"));

  return (
    <Card
      title={t("waiting.title")}
      icon={IconClock}
      testId="waiting-card"
      count={total > 0 ? <KioskChip tone="warning">{t("waiting.count", { count: total })}</KioskChip> : null}
    >
      {total === 0 ? (
        <div className="px-5 py-6">
          <p className="font-medium">{t("waiting.empty")}</p>
          <p className="text-muted text-sm">{t("waiting.emptyLede")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 p-3">
          {conflicts.map((entry) => (
            <li
              key={entry.id}
              className="rounded-control border-border flex flex-col gap-2 border px-4 py-3"
              data-testid="waiting-conflict"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PlateLine
                  visit={{ plate: null, unitNo: entry.label.unitNo }}
                  unitLabel={unitLabel(entry.label.unitNo)}
                />
                <KioskChip tone="danger" icon={IconSyncFailed}>
                  {t("waiting.conflict")}
                </KioskChip>
              </div>
              {entry.label.plate ? <span className="font-mono text-lg">{entry.label.plate}</span> : null}
              <p className="text-muted text-sm">
                {entry.problem?.detail ?? entry.problem?.title ?? t("problem.generic")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="lg" onClick={() => onRetry(entry)}>
                  {t("retry")}
                </Button>
                <Button variant="ghost" size="lg" onClick={() => onDiscard(entry)}>
                  {t("waiting.discard")}
                </Button>
              </div>
            </li>
          ))}
          {shown.map((visit) => {
            const progress = visit.state === "requested" ? policyProgress(visit.createdAt, visit.respondBy, now) : null;
            const minutes = minutesOf(visit);
            const action = visit.timeoutAction ?? "guard_calls";
            const approved = visit.state === "approved" || (visit.state === "timed_out" && action === "allow_and_log");
            return (
              <li
                key={visit.id}
                data-testid="waiting-row"
                data-state={visit.state}
                className={cn(
                  "rounded-control flex flex-col gap-3 border px-4 py-3",
                  visit.state === "approved" ? "border-border-strong bg-surface-subtle" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <PlateLine visit={visit} unitLabel={unitLabel(visit.unitNo)} />
                  <span className="flex items-center gap-2">
                    {visit.state === "requested" ? (
                      <span
                        className="text-fg flex items-center gap-1.5 text-lg font-semibold tabular-nums"
                        aria-label={t("waiting.timer", { time: formatStopwatch(sinceMs(visit.createdAt, now)) })}
                      >
                        <Icon icon={IconTimer} size={20} className="text-muted" />
                        {formatStopwatch(sinceMs(visit.createdAt, now))}
                      </span>
                    ) : null}
                    <KioskChip
                      tone={
                        visit.state === "approved"
                          ? "success"
                          : visit.state === "denied"
                            ? "danger"
                            : visit.state === "timed_out"
                              ? "warning"
                              : "neutral"
                      }
                      icon={
                        visit.state === "approved"
                          ? IconCheckCircle
                          : visit.state === "denied"
                            ? IconXCircle
                            : visit.state === "timed_out"
                              ? IconWarning
                              : IconClock
                      }
                    >
                      {t(`waiting.state.${visit.state as "requested" | "approved" | "denied" | "timed_out"}`)}
                    </KioskChip>
                  </span>
                </div>

                {progress ? (
                  <PolicyTimer
                    label={t("waiting.policyLine")}
                    fraction={progress.fraction}
                    elapsed={progress.elapsed}
                    caption={t(`waiting.policy.${action}`, { minutes })}
                    remaining={t("waiting.remaining", { time: formatStopwatch(progress.remainingMs) })}
                  />
                ) : null}
                {visit.state === "timed_out" ? (
                  <p className="text-sm font-medium">{t(`waiting.timedOut.${action}`)}</p>
                ) : null}
                {visit.state === "approved" && visit.decidedAt ? (
                  <p className="text-muted text-sm" data-testid="decided-by">
                    {visit.decidedByName
                      ? t("waiting.approvedBy", { name: visit.decidedByName, time: bangkokTime(visit.decidedAt) })
                      : t("waiting.approvedAt", { time: bangkokTime(visit.decidedAt) })}
                  </p>
                ) : null}
                {visit.state === "denied" ? (
                  <p className="text-sm">
                    {visit.decidedByName
                      ? t("waiting.deniedBy", { name: visit.decidedByName })
                      : t("waiting.deniedLede")}
                  </p>
                ) : null}
                {visit.callMeAt ? (
                  <p
                    className="text-info-subtle-fg flex items-center gap-2 text-base font-medium"
                    data-testid="call-back"
                  >
                    <Icon icon={IconPhone} size={20} />
                    {visit.callBackName
                      ? t("waiting.callBackName", { name: visit.callBackName })
                      : t("waiting.callBack")}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  {approved ? (
                    <Button
                      size="xl"
                      className="h-14 flex-1"
                      iconStart={hasBarrier ? IconUnlock : IconCheckCircle}
                      onClick={() => onLetIn(visit)}
                      data-testid="let-in"
                    >
                      {hasBarrier ? t("waiting.letIn") : t("waiting.letInNoBarrier")}
                    </Button>
                  ) : null}
                  {visit.state === "denied" ? (
                    <Button variant="secondary" size="lg" className="h-12" onClick={() => onDismiss(visit)}>
                      {t("waiting.dismiss")}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="h-12"
                      onClick={() => onManage(visit)}
                      data-testid="manage"
                    >
                      {t("waiting.manage")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** "อยู่ในโครงการ" (J-DESIGN §3): newest entry first, the entry stamp and how long ago, the overstay line, exit. */
export function InsideCard({
  visits,
  queued,
  overstayed,
  onExit,
  exiting,
}: {
  visits: readonly GuardVisit[];
  queued: readonly GateQueueEntry[];
  overstayed: readonly string[];
  onExit: (visit: GuardVisit) => void;
  exiting: string | null;
}) {
  const t = useTranslations("owner.guard");
  const now = useNow(30_000);
  const sorted = [...visits].sort(
    (a, b) => Date.parse(b.enteredAt ?? b.createdAt) - Date.parse(a.enteredAt ?? a.createdAt),
  );
  const total = sorted.length + queued.length;
  const ago = (iso: string | null) => {
    const { hours, minutes } = durationParts(sinceMs(iso, now));
    return hours > 0 ? t("inside.agoHours", { hours, minutes }) : t("inside.ago", { minutes });
  };

  return (
    <Card
      title={t("inside.title")}
      icon={IconLogOut}
      testId="inside-card"
      count={<KioskChip tone="neutral">{t("inside.count", { count: total })}</KioskChip>}
      aside={total > 1 ? t("inside.sort") : undefined}
    >
      {total === 0 ? (
        <p className="text-muted px-5 py-6">{t("inside.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2 p-3">
          {queued.map((entry) => (
            <li
              key={entry.id}
              className="rounded-control border-border flex items-center gap-4 border px-4 py-3"
              data-testid="inside-queued"
            >
              <Icon
                icon={entry.label.kind === "invite" ? IconQr : KIND_ICONS[entry.label.kind]}
                size={26}
                className="text-muted shrink-0"
              />
              <div className="min-w-0 flex-1">
                <PlateLine
                  visit={{ plate: null, unitNo: entry.label.unitNo }}
                  unitLabel={entry.label.unitNo ?? t("waiting.noUnit")}
                />
                {entry.label.plate ? <span className="font-mono text-lg">{entry.label.plate}</span> : null}
                <p className="text-muted text-sm">{t("inside.enteredAt", { time: bangkokTime(entry.createdAt) })}</p>
              </div>
              <KioskChip tone="info" icon={IconSyncPending}>
                {t("inside.queued")}
              </KioskChip>
            </li>
          ))}
          {sorted.map((visit) => {
            // `overstayedAt` from the list (J-CR); the stream's `gate.visit.overstayed` marks it before the next read.
            const over = visit.overstayedAt !== null || overstayed.includes(visit.id);
            return (
              <li
                key={visit.id}
                className="rounded-control border-border flex items-center gap-4 border px-4 py-3"
                data-testid="inside-row"
              >
                <Icon icon={KIND_ICONS[visit.kind]} size={26} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <PlateLine
                    visit={visit}
                    unitLabel={visit.unitNo ? t("inside.unit", { unit: visit.unitNo }) : t("waiting.noUnit")}
                  />
                  <p className="text-muted text-sm">
                    {t("inside.enteredAt", { time: bangkokTime(visit.enteredAt ?? visit.createdAt) })}{" "}
                    {ago(visit.enteredAt)}
                    {visit.entryBasis ? ` · ${t(`inside.basis.${visit.entryBasis}`)}` : ""}
                  </p>
                  {over ? (
                    <KioskStatusLine tone="warning" icon={IconWarning} testId="overstayed">
                      {t("inside.overstayed")}
                    </KioskStatusLine>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-14 shrink-0"
                  loading={exiting === visit.id}
                  onClick={() => onExit(visit)}
                  data-testid="exit"
                >
                  {t("inside.exit")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
