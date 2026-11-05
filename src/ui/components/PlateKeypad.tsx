"use client";

import { Icon } from "../icons";
import { IconBackspace } from "../icons/glyphs/backspace";
import { cx as cn } from "../lib/cx";

export interface PlateKeypadGroup {
  key: string;
  /** The class's name as every Thai reader learnt it (อักษรกลาง…), from `src/i18n`. */
  label: string;
  letters: readonly string[];
}

export interface PlateKeypadProps {
  groups: readonly PlateKeypadGroup[];
  onKey: (value: string) => void;
  onBackspace: () => void;
  /** "ถัดไป": category → number → province. */
  onNext?: () => void;
  onDone: () => void;
  labels: { letters: string; digits: string; backspace: string; next: string; done: string };
  /** Dims the letters while the number is being typed (they still work: a letter goes back to the category). */
  emphasis?: "letters" | "digits";
  className?: string;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ZERO = "0";

/**
 * The gate's plate keypad (J-DESIGN §4 gate kiosk kit): Thai consonants grouped by class on the left, a 3 × 4 digit
 * pad on the right (stacked on a portrait tablet), backspace, next and done. Every key is ≥ 56 px with an 8-px gap —
 * gloves, one hand, no hover state needed. Keys are plain buttons: the OS keyboard never opens on the tablet.
 */
export function PlateKeypad({
  groups,
  onKey,
  onBackspace,
  onNext,
  onDone,
  labels,
  emphasis,
  className,
}: PlateKeypadProps) {
  const keyClass = cn(
    "rounded-control bg-bg-subtle text-fg flex h-14 min-w-14 items-center justify-center text-xl font-semibold",
    "active:bg-border-strong duration-fast touch-manipulation transition-colors select-none",
  );
  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-start", className)} data-testid="plate-keypad">
      <section
        aria-label={labels.letters}
        className={cn("flex min-w-0 flex-1 flex-col gap-3", emphasis === "digits" && "opacity-70")}
      >
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1.5">
            <span className="text-muted text-xs">{group.label}</span>
            <div className="flex flex-wrap gap-2">
              {group.letters.map((letter) => (
                <button key={letter} type="button" className={keyClass} onClick={() => onKey(letter)} data-key={letter}>
                  {letter}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section aria-label={labels.digits} className="flex w-full shrink-0 flex-col gap-2 lg:w-60">
        <div className="grid grid-cols-3 gap-2">
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              className={cn(keyClass, "h-16 text-2xl tabular-nums")}
              onClick={() => onKey(digit)}
              data-key={digit}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className={cn(keyClass, "h-16")}
            onClick={onBackspace}
            aria-label={labels.backspace}
            data-key="backspace"
          >
            <Icon icon={IconBackspace} size={28} />
          </button>
          <button
            type="button"
            className={cn(keyClass, "h-16 text-2xl tabular-nums")}
            onClick={() => onKey(ZERO)}
            data-key="0"
          >
            {ZERO}
          </button>
          {onNext ? (
            <button
              type="button"
              className={cn(keyClass, "bg-surface border-border-strong h-16 border text-base")}
              onClick={onNext}
              data-key="next"
            >
              {labels.next}
            </button>
          ) : (
            <span aria-hidden />
          )}
        </div>
        <button
          type="button"
          onClick={onDone}
          data-key="done"
          className="rounded-control bg-primary text-primary-fg hover:bg-primary-hover h-16 touch-manipulation text-lg font-semibold"
        >
          {labels.done}
        </button>
      </section>
    </div>
  );
}
