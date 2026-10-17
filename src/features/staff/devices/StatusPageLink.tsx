"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/ui/components/Button";
import { IconExternal } from "@/ui/icons/glyphs/external";

import { statusPageUrl } from "./statusPage";

/** The gateway's local status page on the LAN (`http://<ip>:8080`), from the address the installer types. */
export function StatusPageLink() {
  const t = useTranslations("staff.devices.detail");
  const id = useId();
  const [address, setAddress] = useState("");
  const link = statusPageUrl(address);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-muted text-sm font-medium">
        {t("ipLabel")}
      </label>
      <input
        id={id}
        value={address}
        inputMode="decimal"
        autoComplete="off"
        placeholder={t("ipPlaceholder")}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setAddress(event.target.value)}
        className="rounded-control border-border-strong bg-surface h-14 border px-4 font-mono text-lg"
      />
      <p id={`${id}-hint`} className="text-muted text-sm">
        {t("ipHint")}
      </p>
      {link ? (
        <Button asChild variant="secondary" size="xl" block iconEnd={IconExternal}>
          <a href={link} target="_blank" rel="noreferrer" data-testid="status-page-link">
            {t("openStatusPage")}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
