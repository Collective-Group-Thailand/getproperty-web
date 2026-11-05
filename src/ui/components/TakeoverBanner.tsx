import { Icon, type IconGlyph } from "../icons";
import { cx as cn } from "../lib/cx";

export interface TakeoverBannerProps {
  icon: IconGlyph;
  title: React.ReactNode;
  /** One line under the title: place, time, who raised it. */
  meta?: React.ReactNode;
  /** The banner's actions (acknowledge, resolve). */
  children?: React.ReactNode;
  /** `alert` (open: announced at once) or `acknowledged` (calmer, still above everything). */
  tone?: "alert" | "acknowledged";
  className?: string;
}

/**
 * A band that takes over the top of a kiosk screen (J-DESIGN §4: the gate's SOS banner). Full width, no side
 * stripe: the pale danger tint with a danger rule under it while open (announced assertively), the amber tint once
 * someone has acknowledged it. Nothing else on the screen is hidden — the guard can still let a car in.
 */
export function TakeoverBanner({ icon, title, meta, children, tone = "alert", className }: TakeoverBannerProps) {
  const alert = tone === "alert";
  return (
    <section
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
      data-testid="takeover-banner"
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-3 border-b-2 px-6 py-4",
        alert
          ? "bg-danger-subtle text-danger-subtle-fg border-danger"
          : "bg-warning-subtle text-warning-subtle-fg border-warning",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-full",
            alert ? "bg-danger text-danger-fg" : "bg-surface text-warning-subtle-fg",
          )}
        >
          <Icon icon={icon} size={30} />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-semibold">{title}</p>
          {meta ? <p className="text-base">{meta}</p> : null}
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </section>
  );
}
