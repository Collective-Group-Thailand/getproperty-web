import { cn } from "../lib/cn";

/**
 * How a message will read on the resident's phone (G4 announcement composer; G5 broadcasts): a quiet band standing in
 * for the chat, the sender's initial and name, then the message card — title, text (kept to its first lines as the
 * chat list shows it) and an optional note under it. A preview of the operator's own words, never of figures.
 */
export function MessagePreview({
  label,
  sender,
  title,
  body,
  note,
  placeholder,
  className,
  testId,
}: {
  /** Accessible name of the preview ("ตัวอย่างใน LINE"), from `src/i18n`. */
  label: string;
  /** The sending account's display name. */
  sender: string;
  title: React.ReactNode;
  body: React.ReactNode;
  /** One muted line under the card ("ปักหมุดถึง 30 พ.ย. 2569"). */
  note?: React.ReactNode;
  /** Shown while title and text are still empty. */
  placeholder?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  const empty = !title && !body;
  return (
    <figure
      aria-label={label}
      className={cn("rounded-card border-border bg-bg-subtle flex flex-col gap-2 border p-4", className)}
      data-testid={testId}
    >
      <figcaption className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-primary text-primary-fg grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
        >
          {sender.trim().charAt(0).toUpperCase()}
        </span>
        <span className="text-muted min-w-0 truncate text-sm font-medium">{sender}</span>
      </figcaption>
      <div className="bg-surface rounded-card border-border shadow-card ms-9 flex flex-col gap-1.5 border px-4 py-3">
        {empty ? (
          <p className="text-muted text-sm">{placeholder}</p>
        ) : (
          <>
            {title ? <p className="font-semibold break-words">{title}</p> : null}
            {body ? <p className="line-clamp-6 text-sm break-words whitespace-pre-line">{body}</p> : null}
          </>
        )}
      </div>
      {note ? <p className="text-muted ms-9 text-xs">{note}</p> : null}
    </figure>
  );
}
