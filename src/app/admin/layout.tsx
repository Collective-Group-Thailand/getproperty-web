import { ConsoleProviders } from "@/features/shared/providers/ConsoleProviders";
import { ZoneDocument, zoneMetadata } from "@/features/shared/shell/ZoneDocument";

/** Admin zone root layout — `admin.localhost:3000`, rewritten onto `/admin` by src/proxy.ts (00-master-plan.md §2). */
export async function generateMetadata() {
  return zoneMetadata("admin");
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZoneDocument zone="admin">
      <ConsoleProviders>{children}</ConsoleProviders>
    </ZoneDocument>
  );
}
