import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

const cardVariants = cva("rounded-card border border-border bg-surface text-fg", {
  variants: {
    padding: { none: "", sm: "p-3", md: "p-4 md:p-5", lg: "p-5 md:p-6" },
    /** `interactive` lifts on hover — only for a card that is itself a link or button. */
    interactive: { true: "transition-shadow duration-fast ease-standard hover:shadow-raised", false: "shadow-card" },
  },
  defaultVariants: { padding: "md", interactive: false },
});

export interface CardProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof cardVariants> {
  as?: "div" | "section" | "article" | "li";
}

export function Card({ as: Component = "div", padding, interactive, className, ...props }: CardProps) {
  return <Component className={cn(cardVariants({ padding, interactive }), className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** One action, top-right (design-system.md §1: one primary action per view). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="text-muted mt-0.5 text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
