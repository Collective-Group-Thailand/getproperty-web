"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { IconKey } from "@/ui/icons/glyphs/key";

import { problemText } from "../shared/problem";

/**
 * The door codes issued to me for this visit (`GET /v1/staff/work-orders/{id}/access`, D-070, D-211) — fetched
 * only when tapped, never part of the server-rendered page (review H2: a rendered page can end up in a cache or in
 * a back/forward snapshot of a shared phone). They live in this component's memory only and are gone with the page;
 * every reveal is audited by the API.
 */
export function DoorCodes({ workOrderId }: { workOrderId: string }) {
  const t = useTranslations("staff.work");
  const locale = useLocale() as Locale;
  const [codes, setCodes] = useState<Schemas["RevealedCredentialDto"][] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = await unwrap(
        browserApi().GET("/v1/staff/work-orders/{workOrderId}/access", { params: { path: { workOrderId } } }),
      );
      setCodes(body.data);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="access" className="flex flex-col gap-2" data-testid="access-codes">
      <h2 id="access" className="text-lg font-semibold">
        {t("access.title")}
      </h2>
      {codes === null ? (
        <>
          <Button
            variant="secondary"
            size="xl"
            block
            iconStart={IconKey}
            loading={busy}
            onClick={() => void reveal()}
            data-testid="access-show"
          >
            {t("access.reveal")}
          </Button>
          <p className="text-muted text-sm">{t("access.hint")}</p>
          {error ? (
            <div data-testid="access-problem">
              <Callout tone="danger">{problemText(error, t("access.offline"))}</Callout>
            </div>
          ) : null}
        </>
      ) : codes.length === 0 ? (
        <p className="text-muted" data-testid="access-none">
          {t("access.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {codes.map((code) => (
            <li
              key={code.id}
              className="border-border rounded-card flex flex-col gap-2 border p-3"
              data-testid="access-code"
            >
              <span className="font-medium">{code.lockName}</span>
              <span className="text-muted text-sm">
                {t("access.window", {
                  from: formatDateTime(code.validFrom, locale),
                  until: code.validTo ? formatDateTime(code.validTo, locale) : "—",
                })}
              </span>
              {code.status !== "active" ? (
                <span className="text-muted text-sm">{t("access.notActive")}</span>
              ) : (
                <span className="font-mono text-3xl tracking-widest" data-testid="access-pin">
                  {code.pin ?? t("access.app")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
