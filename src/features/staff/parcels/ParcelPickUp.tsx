"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconPackageCheck } from "@/ui/icons/glyphs/package-check";

import { problemText } from "../shared/problem";

/**
 * Hands a parcel over (D-212): the resident shows the 6-digit PIN from their app; without it, staff confirm
 * the hand-over themselves (recorded as such). Return to the sender needs a reason.
 */
export function ParcelPickUp({ parcel }: { parcel: Pick<Schemas["ParcelDto"], "id" | "unitNo"> }) {
  const t = useTranslations("staff.parcels.pickUp");
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "pin" | "return">("closed");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const path = { parcelId: parcel.id };

  const run = async (name: string, call: () => Promise<unknown>) => {
    setBusy(name);
    setError(null);
    try {
      await call();
      setMode("closed");
      router.refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };

  if (mode === "closed")
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button size="xl" iconStart={IconPackageCheck} onClick={() => setMode("pin")} data-testid="pick-up">
          {t("action")}
        </Button>
        <Button
          size="xl"
          variant="secondary"
          iconStart={IconBack}
          onClick={() => setMode("return")}
          data-testid="return"
        >
          {t("return")}
        </Button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3" data-testid="pick-up-panel">
      {mode === "pin" ? (
        <>
          <Field label={t("pin")} hint={t("pinHint")}>
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              inputSize="lg"
              className="font-mono text-2xl tracking-widest"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              data-testid="pick-up-pin"
            />
          </Field>
          <Button
            size="xl"
            block
            loading={busy === "pin"}
            disabled={pin.length !== 6}
            onClick={() =>
              void run("pin", () =>
                unwrap(
                  browserApi().POST("/v1/staff/parcels/{parcelId}/actions/pick-up", {
                    params: { path },
                    body: { pin },
                  }),
                ),
              )
            }
            data-testid="pick-up-submit"
          >
            {t("withPin")}
          </Button>
          <Button
            size="xl"
            block
            variant="secondary"
            loading={busy === "staff"}
            onClick={() =>
              void run("staff", () =>
                unwrap(
                  browserApi().POST("/v1/staff/parcels/{parcelId}/actions/pick-up", {
                    params: { path },
                    body: { staffConfirmed: true },
                  }),
                ),
              )
            }
            data-testid="pick-up-staff"
          >
            {t("staffConfirmed")}
          </Button>
        </>
      ) : (
        <>
          <Field label={t("reason")} required>
            <Textarea
              className="text-lg"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="return-reason"
            />
          </Field>
          <Button
            size="xl"
            block
            variant="secondary"
            loading={busy === "return"}
            disabled={!reason.trim()}
            onClick={() =>
              void run("return", () =>
                unwrap(
                  browserApi().POST("/v1/staff/parcels/{parcelId}/actions/return", {
                    params: { path },
                    body: { reason: reason.trim() },
                  }),
                ),
              )
            }
            data-testid="return-submit"
          >
            {t("returnSubmit")}
          </Button>
        </>
      )}
      <Button size="lg" variant="ghost" onClick={() => setMode("closed")}>
        {t("cancel")}
      </Button>
      {error ? (
        <Callout tone="danger">
          <span role="alert" data-testid="pick-up-problem">
            {problemText(error, t("offline"))}
          </span>
        </Callout>
      ) : null}
    </div>
  );
}
