import { cn } from "../lib/cn";

/**
 * The placeholder mark (D-100): a building outline in the brand teal with a single lit "meter" dot —
 * the one reading that becomes a bill. Drawn here, on a 32-px grid, from nothing but geometry; it
 * is replaced wholesale when the brand kit arrives. `currentColor` so it follows `text-primary`.
 */
export function Mark({
  size = 28,
  className,
  ...props
}: { size?: number | string; className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      {...props}
    >
      <rect x="4" y="3" width="24" height="26" rx="6" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M10 11h4M18 11h4M10 17h4M18 17h4M13 29v-6h6v6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="23" r="2.25" fill="currentColor" />
    </svg>
  );
}
