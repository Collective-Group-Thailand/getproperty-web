"use client";

import { useState } from "react";

import type { PublicTariff } from "@/lib/api/pending";
import { Card } from "@/ui/components/Card";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

/** Copy resolved on the server (the public pages ship no client-side message formatting). */
export interface LossTeaserCopy {
  title: string;
  body: string;
  provider: string;
  providers: Record<"mea" | "pea", string>;
  ceiling: string;
  perUnit: string;
  /** "<tariff name>, effective <date>" per provider. */
  tariffLines: Partial<Record<"mea" | "pea", string>>;
  source: string;
  cta: string;
  unavailable: string;
}

/**
 * The loss-calculator teaser (F1 1.3 §7): the lawful ceiling per unit as the API publishes it, per
 * provider. It shows the API's number as is — no arithmetic here (CLAUDE.md: the UI never computes
 * tariffs); the full check runs on every invoice inside the product.
 */
export function LossTeaser({
  tariffs,
  signInHref,
  copy,
}: {
  tariffs: Partial<Record<"mea" | "pea", PublicTariff>>;
  signInHref: string;
  copy: LossTeaserCopy;
}) {
  const available = (["mea", "pea"] as const).filter((provider) => tariffs[provider]);
  const [provider, setProvider] = useState<"mea" | "pea">(available[0] ?? "mea");
  const tariff = tariffs[provider];

  return (
    <Card padding="lg" className="flex flex-col gap-4" data-testid="loss-teaser">
      <h2 className="text-2xl font-semibold">{copy.title}</h2>
      <p className="text-muted">{copy.body}</p>
      {available.length === 0 || !tariff ? (
        <p className="text-muted text-sm">{copy.unavailable}</p>
      ) : (
        <>
          {available.length > 1 ? (
            <SegmentedControl
              label={copy.provider}
              value={provider}
              onValueChange={(value) => setProvider(value as "mea" | "pea")}
              options={available.map((value) => ({ value, label: copy.providers[value] }))}
            />
          ) : null}
          <div>
            <p className="text-muted text-sm">{copy.ceiling}</p>
            <p className="font-display text-4xl font-semibold tabular-nums" data-testid="loss-ceiling">
              {tariff.ceilingPerUnit}
              <span className="text-muted ms-2 text-base font-normal">{copy.perUnit}</span>
            </p>
            <p className="text-muted mt-1 text-sm">
              {copy.tariffLines[provider]} ·{" "}
              <a
                className="underline underline-offset-4"
                href={tariff.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {copy.source}
              </a>
            </p>
          </div>
        </>
      )}
      <a className="text-primary font-semibold underline underline-offset-4" href={signInHref}>
        {copy.cta}
      </a>
    </Card>
  );
}
