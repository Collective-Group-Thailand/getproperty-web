import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface ErrorStateProps {
  title: React.ReactNode;
  /** Specific and recoverable: what happened and what to do (design-system.md §4). */
  description?: React.ReactNode;
  /** The API's request id, shown small so support can find the log. */
  requestId?: string;
  requestIdLabel?: string;
  /** Usually a retry button. */
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({ title, description, requestId, requestIdLabel, action, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className="bg-danger-subtle text-danger-subtle-fg mb-4 flex size-14 items-center justify-center rounded-full text-3xl">
        <Icon name="alert" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="text-muted mt-1 max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
      {requestId ? (
        <p className="text-muted mt-6 font-mono text-xs">
          {requestIdLabel ? `${requestIdLabel}: ` : null}
          {requestId}
        </p>
      ) : null}
    </div>
  );
}
