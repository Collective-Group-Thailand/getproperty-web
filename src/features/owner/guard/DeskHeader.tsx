"use client";

import { useTranslations } from "next-intl";

import { KioskButton as Button, KioskChip, KioskAvatar } from "@/ui/components/Kiosk";
import { Icon } from "@/ui/icons";
import { IconSyncPending } from "@/ui/icons/glyphs/sync-pending";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconOffline } from "@/ui/icons/glyphs/offline";
import { IconOnline } from "@/ui/icons/glyphs/online";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconSwap } from "@/ui/icons/glyphs/swap";
import { IconUnlock } from "@/ui/icons/glyphs/unlock";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import type { GuardHardware, GuardMe } from "./lib/api";
import { bangkokTime } from "./lib/timers";
import { useNow } from "./lib/useNow";
import type { Network } from "./lib/useDesk";
import type { StreamStatus } from "./lib/stream";

/** Barrier state for the header (J4.2 `gate.state`): the first live barrier of the gate, or none. */
export function barrierOf(hardware: readonly GuardHardware[]): GuardHardware | null {
  return hardware.find((device) => device.kind === "barrier") ?? null;
}

/**
 * The tablet's top bar (J-DESIGN §3): gate + estate, the clock, the connection with the queue count ("ออฟไลน์ · จะส่ง
 * เมื่อกลับมาออนไลน์ (3)"), the barrier and its open button, the guard on shift, lock and switch shift.
 */
export function DeskHeader({
  me,
  network,
  stream,
  pending,
  hardware,
  onLock,
  onSwitchShift,
}: {
  me: GuardMe;
  network: Network;
  stream: StreamStatus;
  pending: number;
  hardware: readonly GuardHardware[];
  onLock: () => void;
  onSwitchShift: () => void;
}) {
  const t = useTranslations("owner.guard.header");
  const now = useNow(1000);
  const barrier = barrierOf(hardware);
  const offline = network === "offline";

  const connection = offline ? (
    <KioskChip tone="warning" icon={IconOffline} size="lg">
      {pending > 0 ? t("offlineQueue", { count: pending }) : t("offline")}
    </KioskChip>
  ) : pending > 0 ? (
    <KioskChip tone="info" icon={IconSyncPending} size="lg">
      {t("syncing", { count: pending })}
    </KioskChip>
  ) : stream === "open" ? (
    <KioskChip tone="success" icon={IconOnline} size="lg">
      {t("online")}
    </KioskChip>
  ) : (
    <KioskChip tone="neutral" icon={IconOnline} size="lg">
      {t("reconnecting")}
    </KioskChip>
  );

  return (
    <header className="border-border bg-surface flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-6 py-3">
      <div className="flex min-w-[13rem] flex-1 items-center gap-3">
        <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-12 shrink-0 items-center justify-center">
          <Icon icon={IconShield} size={26} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold" data-testid="gate-name">
            {me.gateName}
          </p>
          <p className="text-muted truncate text-sm">{me.propertyName}</p>
        </div>
      </div>

      <p
        className="rounded-control border-border text-fg flex h-14 items-center border px-4 font-mono text-3xl font-semibold tabular-nums"
        aria-label={t("clock")}
        suppressHydrationWarning
      >
        {bangkokTime(now)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span aria-live="polite" data-testid="connection">
          {connection}
        </span>
        {barrier ? (
          <>
            <KioskChip
              tone={barrier.hwState === "fault" ? "danger" : barrier.hwState === "open" ? "warning" : "neutral"}
              icon={barrier.hwState === "fault" ? IconWarning : barrier.hwState === "open" ? IconUnlock : IconLock}
              className="h-10 px-3 text-base"
            >
              {t(`barrier.${barrier.hwState ?? "unknown"}`)}
            </KioskChip>
          </>
        ) : null}
      </div>

      <div className="border-border flex w-full items-center justify-end gap-2 lg:w-auto lg:border-s lg:ps-5">
        <KioskAvatar name={me.guardName} size="md" />
        <div className="me-auto min-w-0 lg:me-0">
          <p className="truncate font-semibold">{me.guardName}</p>
          <p className="text-muted text-sm">{t("shiftSince", { time: bangkokTime(me.startedAt) })}</p>
        </div>
        <Button
          variant="ghost"
          size="lg"
          className="h-12 px-3"
          iconStart={IconLock}
          onClick={onLock}
          data-testid="lock"
        >
          {t("lock")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="h-12 px-4"
          iconStart={IconSwap}
          onClick={onSwitchShift}
          data-testid="switch-shift"
        >
          {t("switchShift")}
        </Button>
      </div>
    </header>
  );
}
