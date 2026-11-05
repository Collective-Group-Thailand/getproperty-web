"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { ProblemNotice } from "@/features/shared/console/useApiAction";
import { formatDate, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { EmptyState } from "@/ui/components/EmptyState";
import { Progress } from "@/ui/components/Progress";
import { IconPrinter } from "@/ui/icons/glyphs/printer";
import { IconQr } from "@/ui/icons/glyphs/qr";

export interface InviteCandidate {
  key: string;
  unitId: string;
  unitNo: string;
  partyId: string;
  name: string;
  /** Already linked in the LINE Mini App: not chosen by default. */
  linked: boolean;
}

type Created = Schemas["UnitResidentInviteCreatedDto"] & { name: string };

/**
 * Chooses co-owners, creates one invite code each (one request per code, its own Idempotency-Key kept across a retry
 * of the batch), then lays the codes out as A4 cards to print. A failed code stays listed with the API's answer;
 * the others print.
 */
export function InviteSheet({
  candidates,
  office,
  unitWord,
  backHref,
}: {
  candidates: InviteCandidate[];
  office: string;
  unitWord: string;
  backHref: string;
}) {
  const t = useTranslations("owner.juristic.invites");
  const locale = useLocale() as Locale;
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(candidates.filter((candidate) => !candidate.linked).map((candidate) => candidate.key)),
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [created, setCreated] = useState<Created[]>([]);
  const [failed, setFailed] = useState<{ candidate: InviteCandidate; error: unknown }[]>([]);
  const keys = useRef(new Map<string, string>());
  const selected = useMemo(() => candidates.filter((candidate) => chosen.has(candidate.key)), [candidates, chosen]);

  if (candidates.length === 0)
    return (
      <EmptyState
        variant="card"
        icon={IconQr}
        title={t("emptyTitle")}
        description={t("empty", { unit: unitWord })}
        action={
          <Button asChild variant="secondary">
            <a href={backHref}>{t("back")}</a>
          </Button>
        }
      />
    );

  const run = async () => {
    setBusy(true);
    setDone(0);
    setFailed([]);
    const made: Created[] = [];
    const errors: { candidate: InviteCandidate; error: unknown }[] = [];
    for (const candidate of selected) {
      // One key per code: a second run after a dropped connection replays instead of creating it twice.
      const key = keys.current.get(candidate.key) ?? crypto.randomUUID();
      keys.current.set(candidate.key, key);
      try {
        const answer = await unwrap(
          browserApi().POST("/v1/owner/units/{unitId}/resident-invites", {
            params: { path: { unitId: candidate.unitId }, header: { "Idempotency-Key": key } },
            body: { channel: "line_qr", partyId: candidate.partyId, language: locale },
          }),
        );
        made.push({ ...answer, name: candidate.name });
      } catch (error) {
        errors.push({ candidate, error });
      }
      setDone((n) => n + 1);
    }
    setCreated(made);
    setFailed(errors);
    setBusy(false);
  };

  if (created.length > 0)
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <p className="m-0" aria-live="polite" data-testid="invites-created">
            {t("created", { count: created.length })}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <a href={backHref}>{t("back")}</a>
            </Button>
            <Button iconStart={IconPrinter} onClick={() => window.print()} data-testid="invites-print">
              {t("print")}
            </Button>
          </div>
        </div>
        {failed.length ? (
          <div className="flex flex-col gap-2 print:hidden">
            {failed.map(({ candidate, error }) => (
              <div key={candidate.key} className="flex flex-col gap-1">
                <p className="m-0 text-sm font-medium">
                  {t("failedFor", { unit: candidate.unitNo, name: candidate.name })}
                </p>
                <ProblemNotice error={error} />
              </div>
            ))}
          </div>
        ) : null}
        <ul
          className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 print:grid-cols-2 print:gap-6"
          data-testid="invite-sheet"
        >
          {created.map((invite) => (
            <li
              key={invite.id}
              className="rounded-card border-border bg-surface flex break-inside-avoid flex-col items-center gap-3 border p-5 text-center"
              data-testid="invite-card"
            >
              <p className="text-muted m-0 text-sm">{office}</p>
              <p className="m-0 text-base font-semibold">
                {unitWord} <span className="font-mono">{invite.unitNo}</span> · {invite.name}
              </p>
              {/* The API's QR image of the link (PNG data URL) — encoded by the API, printed as it is. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invite.qrPngDataUrl}
                alt={t("qrAlt", { unit: invite.unitNo })}
                width={168}
                height={168}
                className="bg-white"
              />
              <p className="m-0 font-mono text-base tracking-wider">{invite.code}</p>
              <p className="m-0 text-sm">{t("cardHow")}</p>
              <p className="text-muted m-0 text-xs">
                {t("cardExpires", { date: formatDate(invite.expiresAt, locale) })} · {t("cardPurpose")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );

  const all = chosen.size === candidates.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border-border bg-surface shadow-card flex flex-col border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <Checkbox
            label={t("chooseAll", { count: candidates.length })}
            checked={all ? true : chosen.size === 0 ? false : "indeterminate"}
            onCheckedChange={() => setChosen(all ? new Set() : new Set(candidates.map((candidate) => candidate.key)))}
          />
          <span className="text-muted text-sm">{t("defaultHint")}</span>
        </div>
        <ul className="divide-border m-0 list-none divide-y p-0" data-testid="invite-candidates">
          {candidates.map((candidate) => (
            <li key={candidate.key} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <Checkbox
                label={
                  <span>
                    <span className="font-mono">{candidate.unitNo}</span> · {candidate.name}
                  </span>
                }
                checked={chosen.has(candidate.key)}
                onCheckedChange={(checked) =>
                  setChosen((previous) => {
                    const next = new Set(previous);
                    if (checked === true) next.add(candidate.key);
                    else next.delete(candidate.key);
                    return next;
                  })
                }
                data-testid="invite-candidate"
              />
              {candidate.linked ? <span className="text-muted text-sm">{t("linked")}</span> : null}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted m-0 text-sm">{t("purpose")}</p>
      {busy ? (
        <Progress
          value={done}
          max={Math.max(1, selected.length)}
          label={t("progressLabel")}
          valueText={t("progress", { done: formatNumber(done, locale), total: formatNumber(selected.length, locale) })}
        />
      ) : null}
      {failed.length && created.length === 0 ? <ProblemNotice error={failed[0]!.error} /> : null}
      <div className="flex justify-end">
        <Button
          iconStart={IconQr}
          onClick={() => void run()}
          loading={busy}
          disabled={selected.length === 0}
          data-testid="invites-create"
        >
          {t("create", { count: selected.length })}
        </Button>
      </div>
    </div>
  );
}
