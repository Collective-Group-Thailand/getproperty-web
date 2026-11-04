import { cn } from "../lib/cn";

/** Thai leading vowels (เ แ โ ใ ไ) are written before the consonant they follow: the initial skips them. */
const LEADING_VOWEL = /^[เ-ไ]/;

/** The letter a person's avatar shows: the first letter of the name, past a Thai leading vowel. */
export function initialOf(name: string): string {
  const letters = Array.from(name.trim().replace(LEADING_VOWEL, ""));
  return (letters[0] ?? "?").toLocaleUpperCase();
}

/**
 * A person's initial in a round tile (members, the account menu): pale brand tint, never a stock photo. Decorative
 * beside the visible name, so it is hidden from assistive tech.
 */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        size === "sm" ? "size-7 rounded-full text-xs" : "size-9 rounded-full text-sm",
        "bg-primary-subtle text-primary-subtle-fg grid shrink-0 place-items-center font-semibold",
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}
