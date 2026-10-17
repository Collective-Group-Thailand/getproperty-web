"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { ComplianceNotice } from "@/features/shared/compliance/ComplianceNotice";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError, isApiError, NetworkError } from "@/lib/api/errors";
import { Callout } from "@/ui/components/Callout";

export const ACK_REQUIRED = "compliance.acknowledgement_required";

/**
 * One mutation from a client island of the owner console (F2): runs the call through the BFF, keeps
 * the API's problem for `<ProblemNotice>`, and refreshes the server-rendered page on success so the
 * screen shows what the API now holds (never an optimistic guess of a money or status change).
 *
 * D-021a warnings (`409 compliance.acknowledgement_required`) are part of the flow: the notice shows
 * the warning with its legal reference and the values the API listed; acknowledging records it
 * (`POST /v1/owner/compliance-acknowledgements`) and repeats the same request with every
 * acknowledgement id collected so far. Refusals (`422 compliance.*`) only explain — there is no
 * client-side way around them (CLAUDE.md).
 */
export function useApiAction<T = unknown>(options: { refresh?: boolean } = {}) {
  const { refresh = true } = options;
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const ackIds = useRef<string[]>([]);
  const last = useRef<{
    call: (acknowledgementIds: string[]) => Promise<T>;
    done?: (result: T) => void | Promise<void>;
  } | null>(null);

  const execute = useCallback(async (): Promise<T | undefined> => {
    const current = last.current;
    if (!current) return undefined;
    setBusy(true);
    setError(null);
    try {
      const result = await current.call([...ackIds.current]);
      ackIds.current = [];
      await current.done?.(result);
      if (refresh) router.refresh();
      return result;
    } catch (failure) {
      setError(failure);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [refresh, router]);

  /** Runs `call` (it receives the acknowledgement ids to send, if the request takes them). */
  const run = useCallback(
    (call: (acknowledgementIds: string[]) => Promise<T>, done?: (result: T) => void | Promise<void>) => {
      ackIds.current = [];
      last.current = { call, done };
      return execute();
    },
    [execute],
  );

  const acknowledge = useCallback(async () => {
    if (!isApiError(error) || error.code !== ACK_REQUIRED || !error.problem.evaluationId) return;
    setAcknowledging(true);
    try {
      const ack = await unwrap(
        browserApi().POST("/v1/owner/compliance-acknowledgements", {
          body: {
            evaluationId: error.problem.evaluationId,
            language: locale,
            legalTextKey: error.problem.legalTextKey ?? error.problem.ruleId ?? error.code,
            legalTextVersion: error.problem.legalTextVersion ?? 1,
          },
        }),
      );
      ackIds.current = [...ackIds.current, ack.id];
      setAcknowledging(false);
      const current = last.current;
      if (!current) return;
      setBusy(true);
      setError(null);
      try {
        const result = await current.call([...ackIds.current]);
        ackIds.current = [];
        await current.done?.(result);
        if (refresh) router.refresh();
      } catch (failure) {
        setError(failure);
      } finally {
        setBusy(false);
      }
    } catch (failure) {
      setAcknowledging(false);
      setError(failure);
    }
  }, [error, locale, refresh, router]);

  const reset = useCallback(() => {
    setError(null);
    ackIds.current = [];
  }, []);

  return { run, busy, error, reset, acknowledge, acknowledging };
}

/**
 * The answer of a failed mutation: compliance problems with their legal reference (and the
 * acknowledgement button for D-021a warnings), other problems with the API's localised detail and the
 * request id, and a plain "no connection" when nothing came back.
 */
export function ProblemNotice({
  error,
  onAcknowledge,
  acknowledging,
  className,
}: {
  error: unknown;
  onAcknowledge?: () => void;
  acknowledging?: boolean;
  className?: string;
}) {
  const t = useTranslations("errors");
  const common = useTranslations("common");
  if (!error) return null;
  if (isApiError(error) && error.isCompliance) {
    return (
      <div className={className} role="alert" data-testid="problem-notice" data-code={error.code}>
        <ComplianceNotice
          problem={{ ...error.problem, code: error.code, title: error.title, detail: error.detail }}
          onAcknowledge={onAcknowledge ? () => onAcknowledge() : undefined}
          acknowledging={acknowledging}
        />
      </div>
    );
  }
  const api = error instanceof ApiError ? error : null;
  const offline = error instanceof NetworkError;
  return (
    <div className={className} role="alert" data-testid="problem-notice" data-code={api?.code ?? "network"}>
      <Callout tone="danger" title={api?.title || (offline ? t("offline.title") : t("unexpected.title"))}>
        <p>{api?.detail || (offline ? t("offline.body") : t("unexpected.body"))}</p>
        {api?.errors.length ? (
          <ul className="mt-1 list-disc ps-5 text-sm">
            {api.errors.map((fieldError) => (
              <li key={`${fieldError.path}-${fieldError.code}`}>
                <span className="font-mono">{fieldError.path}</span>
                {" — "}
                {fieldError.message}
              </li>
            ))}
          </ul>
        ) : null}
        {api?.requestId ? (
          <p className="mt-1 font-mono text-xs opacity-80">
            {common("requestId")}: {api.requestId}
          </p>
        ) : null}
      </Callout>
    </div>
  );
}

/** A fresh Idempotency-Key per confirmation dialog, kept across retries of the same dialog (contract §3). */
export function useIdempotencyKey(): { key: string; renew: () => void } {
  const [key, setKey] = useState(() => crypto.randomUUID());
  return { key, renew: () => setKey(crypto.randomUUID()) };
}
