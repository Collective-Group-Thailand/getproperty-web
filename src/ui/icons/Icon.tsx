import { cn } from "../lib/cn";
import { ICONS, type IconName } from "./registry";

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref" | "children"> {
  name: IconName;
  /**
   * Accessible name. Omit it for decoration that sits next to a text label — the icon is
   * then `aria-hidden`, which is what you want in a button that already says "Save".
   * Give it whenever the icon is the only thing carrying the meaning.
   */
  label?: string;
  /** Pixel size; defaults to 1em so an icon tracks the text beside it. */
  size?: number | string;
}

/**
 * The only way to render an icon (ADR-0002). Icons never come straight from `lucide-react`
 * in app code: the registry keeps the set curated and lets `src/domain/status` name one.
 *
 * Never colour alone — design-system.md §2 requires icon *and* text for status, so this
 * inherits `currentColor` and has no colour prop.
 */
export function Icon({ name, label, size = "1em", className, ...props }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      width={size}
      height={size}
      // Lucide draws on a 24-px grid; a fixed absolute stroke keeps weights even across sizes.
      strokeWidth={1.75}
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable={false}
      {...props}
    />
  );
}
