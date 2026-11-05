"use client";

import { useEffect, useRef } from "react";

import { cn } from "../lib/cn";
import { Icon } from "../icons";
import { IconWarning } from "../icons/glyphs/warning";

export interface ErrorSummaryItem {
  /** The `id` of the field (its control) the link moves focus to. */
  fieldId: string;
  /** What is wrong, in the page language ("กรอกวันที่โอน"). */
  message: React.ReactNode;
}

/**
 * The error summary of a long form (pack J UX rule, J-DESIGN §2): after a failed submit or "next", a box at the top
 * names every problem with a link to its field, takes focus so keyboard and screen-reader users land on it, and the
 * fields keep their own inline errors (`aria-describedby`). Nothing is cleared.
 */
export function ErrorSummary({
  title,
  items,
  focusKey,
  className,
  testId = "error-summary",
}: {
  /** "แก้ไข 2 รายการก่อนไปต่อ", from `src/i18n`. */
  title: React.ReactNode;
  items: ErrorSummaryItem[];
  /** Changes on every failed attempt (a counter): the summary takes focus again each time. */
  focusKey?: number | string;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (items.length > 0) ref.current?.focus();
    // Focus once per failed attempt, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);
  if (items.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${testId}-title`}
      className={cn(
        "rounded-card border-danger bg-danger-subtle text-danger-subtle-fg focus-visible:outline-focus-ring flex gap-3 border p-4",
        className,
      )}
      data-testid={testId}
    >
      <Icon icon={IconWarning} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p id={`${testId}-title`} className="m-0 font-semibold">
          {title}
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1 ps-5 text-sm">
          {items.map((item) => (
            <li key={item.fieldId}>
              <a
                href={`#${item.fieldId}`}
                className="underline underline-offset-4"
                onClick={(event) => {
                  const target = document.getElementById(item.fieldId);
                  if (!target) return;
                  event.preventDefault();
                  target.focus();
                  target.scrollIntoView({ block: "center" });
                }}
              >
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
