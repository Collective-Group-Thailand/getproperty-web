import { Icon, type IconGlyph } from "@/ui/icons";
import { IconSpinner } from "@/ui/icons/glyphs/spinner";
import { cn } from "@/ui/lib/cn";

/**
 * "Take a photo" as a dashed tile (redesign G7): where the photo will be, not another button in the stack — wide for
 * the one photo of a form (a parcel label), square beside the thumbnails of an evidence row (a work order, an
 * inspection line). Outlined, so the screen's one filled action stays the only one.
 */
export function CaptureTile({
  label,
  icon,
  onClick,
  shape = "wide",
  loading = false,
  testId,
  children,
}: {
  label: string;
  icon: IconGlyph;
  onClick: () => void;
  shape?: "wide" | "square";
  loading?: boolean;
  testId?: string;
  /** A preview inside the tile (the photo just taken); the label then sits over it. */
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading || undefined}
      className={cn(
        "rounded-control border-border-strong bg-surface text-fg hover:bg-bg-subtle focus-visible:outline-focus-ring relative flex shrink-0 flex-col items-center justify-center gap-1 overflow-hidden border-2 border-dashed font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        shape === "wide" ? "min-h-32 w-full px-4 py-5" : "size-20 px-1 text-center text-xs",
        children ? "border-solid" : null,
      )}
      data-testid={testId}
    >
      {children}
      <span
        className={cn(
          "flex flex-col items-center gap-1",
          children
            ? "bg-surface/90 rounded-thumb absolute inset-x-2 bottom-2 flex-row justify-center py-1 text-sm"
            : null,
        )}
      >
        <Icon
          icon={loading ? IconSpinner : icon}
          size={children ? 18 : shape === "wide" ? 28 : 22}
          className={cn("text-primary", loading && "animate-spin")}
        />
        <span>{label}</span>
      </span>
    </button>
  );
}
