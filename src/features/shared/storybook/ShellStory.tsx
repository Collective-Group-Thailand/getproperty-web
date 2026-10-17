import { NextIntlClientProvider } from "next-intl";

import { ConsoleProviders } from "@/features/shared/providers/ConsoleProviders";
import { MESSAGE_FILES } from "@/i18n/messages";

import { StoryPathname } from "./pathname";

/**
 * Story wrapper for the zone shells (Storybook only): the zone's Thai messages, the console providers
 * and the current path the shells mark as active. Messages are read eagerly with Vite's glob import.
 */
const files = import.meta.glob<{ default: Record<string, unknown> }>("../../../i18n/messages/th/**/*.json", {
  eager: true,
});

function messages(zone: "owner" | "staff" | "admin") {
  const pick = (area: string, file: string) => files[`../../../i18n/messages/th/${area}/${file}.json`]?.default ?? {};
  return {
    ...Object.fromEntries(MESSAGE_FILES.common.map((file) => [file, pick("common", file)])),
    [zone]: Object.fromEntries(MESSAGE_FILES[zone].map((file) => [file, pick(zone, file)])),
  };
}

export function ShellStory({
  zone,
  pathname,
  children,
}: {
  zone: "owner" | "staff" | "admin";
  pathname: string;
  children: React.ReactNode;
}) {
  return (
    <StoryPathname.Provider value={pathname}>
      <NextIntlClientProvider locale="th" messages={messages(zone)} timeZone="Asia/Bangkok">
        <ConsoleProviders>{children}</ConsoleProviders>
      </NextIntlClientProvider>
    </StoryPathname.Provider>
  );
}
