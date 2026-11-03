import { cn } from "../lib/cn";

/**
 * Where a photo is missing (a listing without a cover, a unit not yet photographed): a thin-line drawing of a room —
 * window, door, floor line — on the subtle surface, never an empty grey tile (REDESIGN-PROMPT §3). Decorative: the
 * title next to it says what the thing is. The box decides the size and the radius.
 */
export function PhotoPlaceholder({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        "bg-surface-subtle border-border text-border-strong relative grid place-items-center overflow-hidden border",
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="photo-placeholder"
    >
      <svg
        viewBox="0 0 160 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-1/2 max-h-32 w-auto"
        aria-hidden="true"
      >
        {/* back wall and floor */}
        <path d="M14 96h132" />
        <path d="M24 96V30h112v66" />
        {/* window with its cross bars */}
        <rect x="38" y="42" width="40" height="30" rx="1.5" />
        <path d="M58 42v30M38 57h40" />
        {/* door */}
        <path d="M96 96V50h24v46" />
        <circle cx="114.5" cy="74" r="1.2" />
        {/* a plant by the window */}
        <path d="M44 96v-9h12v9M50 87c-4-4-4-9 0-12 4 3 4 8 0 12Z" />
      </svg>
    </div>
  );
}
