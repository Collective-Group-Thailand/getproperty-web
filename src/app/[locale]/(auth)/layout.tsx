import { ConsoleProviders } from "@/features/shared/providers/ConsoleProviders";

/** Sign-in, tenant picker, invitation: console providers (toasts, tooltips) without the shell. */
export default function OwnerAuthLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleProviders>{children}</ConsoleProviders>;
}
