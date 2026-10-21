import { render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { loadMessages } from "@/i18n/messages";
import type { Zone } from "@/lib/zones";

/** Renders a zone's client component with that zone's real Thai catalog (component tests). */
export async function renderWithIntl(ui: React.ReactElement, zone: Zone = "owner"): Promise<RenderResult> {
  const messages = await loadMessages("th", zone);
  return render(
    <NextIntlClientProvider locale="th" messages={messages} timeZone="Asia/Bangkok">
      {ui}
    </NextIntlClientProvider>,
  );
}
