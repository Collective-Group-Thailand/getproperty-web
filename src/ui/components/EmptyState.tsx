import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: IconName;
  /** What is missing *and* why it matters ("ยังไม่มีห้อง — เพิ่มห้องจาก Excel ใน 1 นาที"). */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The one primary action (design-system.md §4). */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon = "building", title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className="bg-primary-subtle text-primary-subtle-fg mb-4 flex size-14 items-center justify-center rounded-full text-3xl">
        <Icon name={icon} />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="text-muted mt-1 max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
