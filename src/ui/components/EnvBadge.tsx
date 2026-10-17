import { cn } from "../lib/cn";

/**
 * Non-production environment marker in every shell (`NEXT_PUBLIC_ENV_BADGE`): loud enough that nobody
 * mistakes UAT for production, never shown in production. Text, not colour alone.
 */
export function EnvBadge({ label, className }: { label?: string; className?: string }) {
  if (!label) return null;
  return (
    <span
      data-testid="env-badge"
      className={cn(
        "bg-info-subtle text-info-subtle-fg border-info/30 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}
