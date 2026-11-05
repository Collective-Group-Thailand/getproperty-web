"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { KioskButton as Button, KioskNote, KioskInput as Input } from "@/ui/components/Kiosk";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { FieldError } from "@/ui/components/FieldError";

import { guardFetch } from "./lib/api";

/**
 * First run of a gate tablet (D-320): the one-time code the office created for this gate → `session/enrol`. The
 * device secret the API returns stays in this app's httpOnly cookie; the page only learns the gate's name.
 */
export function EnrolScreen({ revoked, onEnrolled }: { revoked: boolean; onEnrolled: () => void }) {
  const t = useTranslations("owner.guard");
  const id = useId();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return setError(t("enrol.codeRequired"));
    setBusy(true);
    setError(null);
    const result = await guardFetch<{ gateName: string }>("/session/enrol", {
      method: "POST",
      body: { code: trimmed, ...(name.trim() ? { name: name.trim() } : {}) },
    });
    setBusy(false);
    if (result.ok) return onEnrolled();
    setError(
      result.offline ? t("problem.offline") : (result.problem?.detail ?? result.problem?.title ?? t("problem.generic")),
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-panel border-border bg-surface flex w-full max-w-xl flex-col gap-6 border p-8"
      data-testid="enrol"
    >
      <div>
        <h1 className="text-2xl font-semibold">{t("enrol.title")}</h1>
        <p className="text-muted mt-2">{t("enrol.lede")}</p>
      </div>
      {revoked ? (
        <KioskNote tone="warning" icon={IconWarning}>
          {t("enrol.revoked")}
        </KioskNote>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-code`} className="font-medium">
          {t("enrol.code")}
        </label>
        <Input
          id={`${id}-code`}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-code-hint${error ? ` ${id}-code-error` : ""}`}
          className="h-16 font-mono text-2xl tracking-widest"
          data-testid="enrol-code"
        />
        <p id={`${id}-code-hint`} className="text-muted text-sm">
          {t("enrol.codeHint")}
        </p>
        {error ? (
          <FieldError id={`${id}-code-error`} alert>
            {error}
          </FieldError>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="font-medium">
          {t("enrol.name")}
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={120}
          placeholder={t("enrol.namePlaceholder")}
          onChange={(event) => setName(event.target.value)}
          className="h-14"
        />
      </div>
      <Button type="submit" size="xl" block className="h-16" loading={busy} data-testid="enrol-submit">
        {t("enrol.submit")}
      </Button>
    </form>
  );
}
