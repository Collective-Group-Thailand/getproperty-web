import { ZoneDocument, zoneMetadata } from "@/features/shared/shell/ZoneDocument";

/** Tenant zone root layout — `tenant.localhost:3000`, rewritten onto `/tenant` by src/proxy.ts (00-master-plan.md §2). */
export async function generateMetadata() {
  return zoneMetadata("tenant");
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <ZoneDocument zone="tenant">{children}</ZoneDocument>;
}
