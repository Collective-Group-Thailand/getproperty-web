import { Icon } from "@/ui/icons";
import { IconStar } from "@/ui/icons/glyphs/star";
import { cn } from "@/ui/lib/cn";

/**
 * A 1–5 star rating as the API sent it (G9, D-301): five glyphs, the first `rating` filled, read out as one label
 * ("4 of 5 stars") — never colour alone. Server-renderable, no client JavaScript.
 */
export function Stars({
  rating,
  label,
  size = 16,
  className,
}: {
  rating: number;
  label: string;
  size?: number;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5", className)}
      data-rating={filled}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          icon={IconStar}
          size={size}
          className={star <= filled ? "text-primary fill-current" : "text-border-strong"}
        />
      ))}
    </span>
  );
}
