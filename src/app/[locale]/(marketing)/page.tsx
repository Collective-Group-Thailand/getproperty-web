import { setRequestLocale } from "next-intl/server";

import { PlaceholderShell } from "@/features/shared/shell/PlaceholderShell";

export default async function OwnerHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlaceholderShell zone="owner" />;
}
