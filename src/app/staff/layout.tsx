import type { Viewport } from "next";

import { ConsoleProviders } from "@/features/shared/providers/ConsoleProviders";
import { ZoneDocument, zoneMetadata, zoneViewport } from "@/features/shared/shell/ZoneDocument";

/** Staff zone root layout — `staff.localhost:3000`, rewritten onto `/staff` by src/proxy.ts (00-master-plan.md §2). */
export async function generateMetadata() {
  return {
    ...(await zoneMetadata("staff")),
    // The installable PWA (F1 1.3 §5): manifest and service worker live at the staff host's root.
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default" as const, title: "getproperty" },
  };
}

export const viewport: Viewport = {
  ...zoneViewport,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZoneDocument zone="staff">
      <ConsoleProviders>{children}</ConsoleProviders>
    </ZoneDocument>
  );
}
