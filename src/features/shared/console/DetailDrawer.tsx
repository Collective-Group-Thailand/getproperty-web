"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/Button";
import { LazySheet } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import { IconCopy } from "@/ui/icons/glyphs/copy";

/**
 * A row's details in a side drawer (redesign G8: audit "before / after", an event's payload): a quiet link-styled
 * trigger in the row, the details in a 440-px sheet from the end edge (full width on phones). The content is rendered
 * by the server page and passed in — the drawer only opens and closes it.
 */
export function DetailDrawer({
  label,
  title,
  description,
  children,
  testId,
}: {
  /** The trigger's text ("ก่อน / หลัง", "รายละเอียด"). */
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="link"
        size="sm"
        className="relative z-2 h-auto px-0"
        onClick={() => setOpen(true)}
        data-testid={testId}
      >
        {label}
      </Button>
      <LazySheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        title={title}
        description={description}
        closeLabel={common("close")}
      >
        <div className="flex flex-col gap-5 pb-4">{children}</div>
      </LazySheet>
    </>
  );
}

/** A reference id in mono with a copy button (audit ids, event ids) — the value, never truncated in the drawer. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const t = useTranslations("common");
  return (
    <span className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 font-mono text-sm break-all">{value}</code>
      <Button
        variant="ghost"
        size="sm"
        iconStart={IconCopy}
        aria-label={t("copyLabel", { label })}
        className="shrink-0"
        onClick={() =>
          void navigator.clipboard?.writeText(value).then(
            () => toast.success(t("copied")),
            () => undefined,
          )
        }
      >
        {t("copy")}
      </Button>
    </span>
  );
}
