"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/ui/components/IconButton";
import { LazySheet } from "@/ui/components/overlays";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconMore } from "@/ui/icons/glyphs/more";

/**
 * The "⋯" of a meter point (redesign G7): its actions — install a device here, replace the meter — in a bottom sheet
 * of 56-px rows rather than two links repeated under every meter.
 */
export function MeterActions({
  title,
  actions,
}: {
  /** The meter's code: names the button and the sheet. */
  title: string;
  actions: { href: string; label: string; icon: IconGlyph }[];
}) {
  const t = useTranslations("staff.devices");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        icon={IconMore}
        size="lg"
        label={t("meterActions", { meter: title })}
        onClick={() => setOpen(true)}
        data-testid="meter-actions"
      />
      <LazySheet open={open} onOpenChange={setOpen} title={title} closeLabel={common("close")} side="bottom">
        <ul className="divide-border flex flex-col divide-y">
          {actions.map((action) => (
            <li key={action.href}>
              <a href={action.href} className="hover:bg-bg-subtle flex min-h-14 items-center gap-4 px-1 text-lg">
                <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-10 shrink-0 items-center justify-center text-xl">
                  <Icon icon={action.icon} />
                </span>
                <span className="flex-1">{action.label}</span>
                <Icon icon={IconChevronRight} className="text-subtle rtl:rotate-180" />
              </a>
            </li>
          ))}
        </ul>
      </LazySheet>
    </>
  );
}
