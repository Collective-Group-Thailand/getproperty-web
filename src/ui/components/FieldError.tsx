import { cx as cn } from "../lib/cx";

/**
 * The words under a field that failed (design-system §4 forms: inline, specific). Give it the `id` the field's
 * `aria-describedby` names; `alert` announces it at once (a submit that failed), otherwise it is read with the field.
 */
export function FieldError({
  id,
  children,
  alert = false,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  alert?: boolean;
  className?: string;
}) {
  return (
    <p
      id={id}
      role={alert ? "alert" : undefined}
      className={cn("text-danger-subtle-fg text-sm font-medium", className)}
    >
      {children}
    </p>
  );
}
