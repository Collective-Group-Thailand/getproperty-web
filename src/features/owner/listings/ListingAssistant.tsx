"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { messageKey } from "@/i18n/keys";
import { ProblemNotice, useApiAction, useSubmissionKey } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconSparkles } from "@/ui/icons/glyphs/sparkles";

type Language = Schemas["AssistantLanguage"];
type Draft = Schemas["ListingDraftDto"];
const LANGUAGES: Language[] = ["th", "en", "zh"];
/** The listing has Thai and English fields; a Chinese draft is shown to copy only (D-301: zh is not stored). */
const FILLABLE = new Set<Language>(["th", "en"]);

/** Refusals that are states of the assistant, in the screen's own words (G9). */
const KNOWN = new Set([
  "assistant.limit_reached",
  "assistant.unavailable",
  "assistant.output_rejected",
  "assistant.disabled",
]);

/**
 * "Draft with AI" in the listing editor (G9, D-301, D-161): the API writes a title and description per language from
 * the listing's own public facts (and, when asked, reads its first photos — never changes them). Nothing is saved:
 * the owner copies a draft into the Thai / English fields and saves with the usual button. Each request carries an
 * Idempotency-Key (a retry is not a second AI call) and counts towards the tenant's monthly limit; the API's
 * disclaimer is always shown with the drafts.
 */
export function ListingAssistant({
  listingId,
  quota: initial,
  hasPhotos,
  onUse,
}: {
  listingId: string;
  quota: Schemas["ListingAssistantQuotaDto"];
  hasPhotos: boolean;
  onUse: (language: "th" | "en", draft: Draft) => void;
}) {
  const t = useTranslations("owner.insight.assistant");
  const action = useApiAction<Schemas["ListingAssistantResultDto"]>({ refresh: false });
  const submission = useSubmissionKey();
  const [languages, setLanguages] = useState<Language[]>(["th", "en"]);
  const [photos, setPhotos] = useState(false);
  const [result, setResult] = useState<Schemas["ListingAssistantResultDto"] | null>(null);
  const [used, setUsed] = useState(initial.usedThisMonth);
  const limit = result?.monthlyLimit ?? initial.monthlyLimit;
  const exhausted = used >= limit;
  const code = isApiError(action.error) ? action.error.code : null;

  if (!initial.enabled) {
    return (
      <div className="bg-bg-subtle rounded-card flex items-start gap-3 p-3 text-sm" data-testid="assistant-off">
        <Icon icon={IconSparkles} className="text-muted mt-0.5" />
        <span className="text-muted">{t("off")}</span>
      </div>
    );
  }

  const generate = () => {
    const body = { languages, includePhotos: photos && hasPhotos };
    // One key per request body: a retry of the same request keeps it, a changed one gets a new key (review L10).
    const key = submission.for(body);
    return action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/listings/{listingId}/assistant", {
            params: { path: { listingId }, header: { "Idempotency-Key": key } },
            body,
          }),
        ),
      (answer) => {
        submission.answered();
        setResult(answer);
        setUsed(answer.usedThisMonth);
      },
    );
  };

  const copy = (draft: Draft) =>
    void navigator.clipboard
      ?.writeText(`${draft.title}\n\n${draft.description}`)
      .then(() => toast.success(t("copied")))
      .catch(() => undefined);

  return (
    <section
      aria-labelledby={`assistant-${listingId}`}
      className="border-primary/30 bg-primary-subtle/40 rounded-card flex flex-col gap-4 border p-4"
      data-testid="listing-assistant"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="bg-primary text-primary-fg grid size-9 shrink-0 place-items-center rounded-full">
            <Icon icon={IconSparkles} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h3 id={`assistant-${listingId}`} className="text-base font-semibold">
              {t("title")}
            </h3>
            <p className="text-muted m-0 text-sm">{t("intro")}</p>
          </div>
        </div>
        <Badge size="sm" tone={exhausted ? "warning" : "neutral"}>
          <span data-testid="assistant-quota">{t("quota", { used, limit })}</span>
        </Badge>
      </div>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">{t("languages")}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {LANGUAGES.map((language) => (
            <Checkbox
              key={language}
              checked={languages.includes(language)}
              onCheckedChange={(value) =>
                setLanguages(
                  value === true
                    ? LANGUAGES.filter((one) => one === language || languages.includes(one))
                    : languages.filter((one) => one !== language),
                )
              }
              label={t(`language.${language}`)}
              data-testid={`assistant-language-${language}`}
            />
          ))}
        </div>
        <Switch
          label={t("photos")}
          description={hasPhotos ? t("photosHint") : t("noPhotos")}
          checked={photos && hasPhotos}
          disabled={!hasPhotos}
          onCheckedChange={setPhotos}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          iconStart={IconSparkles}
          loading={action.busy}
          disabled={languages.length === 0 || exhausted}
          onClick={() => void generate()}
          data-testid="assistant-generate"
        >
          {result ? t("again") : t("generate")}
        </Button>
        <span className="text-muted text-sm">{exhausted ? t("exhausted") : t("nothingSaved")}</span>
      </div>

      {code && KNOWN.has(code) ? (
        <div data-testid="assistant-problem" data-code={code}>
          <Callout
            tone={code === "assistant.output_rejected" ? "warning" : "neutral"}
            title={t(`problem.${messageKey(code, "assistant.")}.title`)}
          >
            {t(`problem.${messageKey(code, "assistant.")}.body`)}
          </Callout>
        </div>
      ) : (
        <ProblemNotice error={action.error} />
      )}

      {result ? (
        <div className="flex flex-col gap-3" data-testid="assistant-drafts">
          {LANGUAGES.map((language) => {
            const draft = result.drafts[language];
            if (!draft) return null;
            return (
              <article
                key={language}
                className="border-border bg-surface rounded-card flex flex-col gap-2 border p-3"
                data-testid="assistant-draft"
                data-language={language}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge size="sm">{t(`language.${language}`)}</Badge>
                  {FILLABLE.has(language) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onUse(language as "th" | "en", draft);
                        toast.success(t("used"));
                      }}
                      data-testid={`assistant-use-${language}`}
                    >
                      {t(`use.${language}`)}
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" iconStart={IconCopy} onClick={() => copy(draft)}>
                      {t("copy")}
                    </Button>
                  )}
                </div>
                <p className="m-0 font-semibold break-words">{draft.title}</p>
                <p className="text-muted m-0 max-h-48 overflow-y-auto text-sm break-words whitespace-pre-line">
                  {draft.description}
                </p>
                {!FILLABLE.has(language) ? <p className="text-muted m-0 text-xs">{t("zhNote")}</p> : null}
              </article>
            );
          })}
          <p className="text-muted m-0 text-xs" data-testid="assistant-disclaimer">
            {result.disclaimer}
            {result.photosUsed > 0 ? ` ${t("photosUsed", { count: result.photosUsed })}` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
