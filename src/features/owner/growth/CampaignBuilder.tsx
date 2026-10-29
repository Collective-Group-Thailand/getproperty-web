"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useDateLabels } from "@/features/shared/console/labels";
import { ProblemNotice, useApiAction, useSubmissionKey } from "@/features/shared/console/useApiAction";
import { bangkokToday } from "@/features/shared/console/time";
import { formatNumber, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Checkbox } from "@/ui/components/Checkbox";
import { DatePicker } from "@/ui/components/DatePicker";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { ownerPath } from "../shared/links";
import {
  EMPTY_SEGMENT,
  LANGUAGES,
  UNIT_KINDS,
  initialReach,
  invalidAmount,
  perRecipientDigits,
  recipientsOrNull,
  segmentBody,
  type SegmentForm,
} from "./broadcast";

export interface BuilderListing {
  id: string;
  title: string;
  /** The API's rent, formatted on the server ("฿15,000"). */
  rent: string;
  /** District or nearest station, when the listing names one. */
  place: string | null;
  kind: Schemas["PortfolioUnitKind"] | null;
}

export interface BuilderArea {
  slug: string;
  label: string;
  count: number;
}

type EstimateRequest = Schemas["SponsoredEstimateRequestDto"];
type EstimateResult = { key: string; data: Schemas["SponsoredEstimateDto"] | null; error: unknown };

const AREAS_SHOWN = 18;

/**
 * The sponsored campaign builder (G6, D-300): a name, my published listings (at most the API's `maxListings`), the
 * segment from the closed whitelist — areas, budget, unit kinds, move-in window, languages; nothing else exists — and
 * the most people to reach. A live **estimate** (debounced `POST …/estimate`) shows the count or that it is withheld
 * below the minimum (privacy), and the API's **cost preview**; saving creates a draft (Idempotency-Key) and opens it.
 */
export function CampaignBuilder({
  product,
  listings,
  areas,
  preselect,
  canSave,
}: {
  product: Schemas["SponsoredProductDto"];
  listings: BuilderListing[];
  areas: BuilderArea[];
  preselect: string | null;
  canSave: boolean;
}) {
  const t = useTranslations("owner.broadcast");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dateLabels = useDateLabels();
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>(() =>
    preselect && listings.some((listing) => listing.id === preselect) ? [preselect] : [],
  );
  const [segment, setSegment] = useState<SegmentForm>(EMPTY_SEGMENT);
  const [max, setMax] = useState(() => initialReach(product));
  const [areaFilter, setAreaFilter] = useState("");
  const [allAreas, setAllAreas] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const action = useApiAction<Schemas["SponsoredCampaignDto"]>({ refresh: false });
  const submission = useSubmissionKey();

  const update = (patch: Partial<SegmentForm>) => setSegment((current) => ({ ...current, ...patch }));
  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const maxRecipients = recipientsOrNull(max);
  const moveInInverted = Boolean(segment.moveInFrom && segment.moveInTo && segment.moveInFrom > segment.moveInTo);
  const errors = {
    name: !name.trim() ? t("builder.nameRequired") : undefined,
    listings: chosen.length === 0 ? t("builder.listingsRequired") : undefined,
    budgetMin: invalidAmount(segment.budgetMin) ? t("builder.budgetInvalid") : undefined,
    budgetMax: invalidAmount(segment.budgetMax) ? t("builder.budgetInvalid") : undefined,
    max: maxRecipients === null ? t("builder.maxInvalid") : undefined,
  };
  const shownErrors = submitted ? errors : { ...errors, name: undefined, listings: undefined };
  const problems = Object.values(shownErrors).filter(Boolean) as string[];

  const request: EstimateRequest | null =
    chosen.length > 0 && maxRecipients !== null && !errors.budgetMin && !errors.budgetMax && !moveInInverted
      ? { listingIds: chosen, segment: segmentBody(segment), maxRecipients }
      : null;
  const requestKey = request ? `${JSON.stringify(request)}#${attempt}` : "";

  useEffect(() => {
    if (!request) return;
    let live = true;
    const key = requestKey;
    const timer = window.setTimeout(() => {
      void unwrap(browserApi().POST("/v1/owner/sponsored-campaigns/estimate", { body: request }))
        .then((data) => live && setResult({ key, data, error: null }))
        .catch((error: unknown) => live && setResult({ key, data: null, error }));
    }, 450);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // The request is rebuilt each render; its serialised key is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const estimate = request && result?.key === requestKey ? result : null;
  const counting = Boolean(request) && !estimate;

  const areaOptions = useMemo(() => {
    const needle = areaFilter.trim().toLowerCase();
    const matching = areas.filter(
      (area) => !needle || area.label.toLowerCase().includes(needle) || area.slug.includes(needle),
    );
    // Chosen areas first, so a long list never hides what is selected.
    return [
      ...matching.filter((area) => segment.areas.includes(area.slug)),
      ...matching.filter((area) => !segment.areas.includes(area.slug)),
    ];
  }, [areas, areaFilter, segment.areas]);
  const visibleAreas = allAreas || areaFilter ? areaOptions : areaOptions.slice(0, AREAS_SHOWN);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || moveInInverted || !canSave || maxRecipients === null) return;
    const body = { name: name.trim(), listingIds: chosen, segment: segmentBody(segment), maxRecipients };
    // One key per campaign body: the same save after no answer keeps it, an edited one gets a new key (review L10).
    const key = submission.for(body);
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/sponsored-campaigns", {
            params: { header: { "Idempotency-Key": key } },
            body,
          }),
        ),
      (campaign) => {
        submission.answered();
        toast.success(t("builder.saved"));
        router.push(ownerPath(locale, `/promote/broadcasts/${campaign.id}`));
      },
    );
  };

  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      noValidate
      data-testid="campaign-builder"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex min-w-0 flex-col gap-6">
        {submitted && problems.length > 0 ? (
          <Callout tone="danger" title={t("builder.fix")}>
            <ul className="m-0 list-disc ps-5" data-testid="builder-errors">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        <Card as="section" aria-labelledby="step-name" className="flex flex-col gap-4">
          <StepTitle id="step-name" n={1} title={t("builder.step.name")} />
          <Field label={t("builder.name")} hint={t("builder.nameHint")} error={shownErrors.name} required>
            <Input
              value={name}
              maxLength={120}
              placeholder={t("builder.namePlaceholder")}
              onChange={(event) => setName(event.target.value)}
              data-testid="campaign-name"
            />
          </Field>
        </Card>

        <Card as="section" aria-labelledby="step-listings" className="flex flex-col gap-4">
          <StepTitle
            id="step-listings"
            n={2}
            title={t("builder.step.listings")}
            aside={t("builder.listingsChosen", { count: chosen.length, max: product.maxListings })}
          />
          <p className="text-muted m-0 text-sm">{t("builder.listingsHint", { max: product.maxListings })}</p>
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">{t("builder.step.listings")}</legend>
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2" data-testid="campaign-listings">
              {listings.map((listing) => {
                const on = chosen.includes(listing.id);
                const full = !on && chosen.length >= product.maxListings;
                return (
                  <li
                    key={listing.id}
                    className={
                      on
                        ? "rounded-card border-primary bg-primary-subtle border p-4"
                        : "rounded-card border-border border p-4"
                    }
                    data-testid="campaign-listing"
                    data-id={listing.id}
                  >
                    <Checkbox
                      checked={on}
                      disabled={full}
                      onCheckedChange={() => setChosen((current) => toggle(current, listing.id))}
                      label={<span className="font-semibold">{listing.title}</span>}
                      description={
                        <span className="tabular-nums">
                          {[
                            t("builder.rent", { rent: listing.rent }),
                            listing.kind ? t(`kinds.${listing.kind}`) : null,
                            listing.place,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </fieldset>
          {shownErrors.listings ? (
            <Callout tone="danger">
              <span role="alert">{shownErrors.listings}</span>
            </Callout>
          ) : null}
        </Card>

        <Card as="section" aria-labelledby="step-audience" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <StepTitle id="step-audience" n={3} title={t("builder.step.audience")} />
            <p className="text-muted m-0 text-sm">{t("builder.audienceHint")}</p>
          </div>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" data-testid="campaign-areas">
            <legend className="mb-1 flex w-full flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
              <span>{t("builder.areas")}</span>
              <span className="text-muted text-xs font-normal">
                {segment.areas.length
                  ? t("builder.areasChosen", { count: segment.areas.length })
                  : t("builder.areasHint")}
              </span>
            </legend>
            <div className="relative max-w-sm">
              <Icon
                icon={IconSearch}
                className="text-muted pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
              />
              <Input
                type="search"
                inputSize="sm"
                className="ps-9"
                value={areaFilter}
                aria-label={t("builder.areasFilter")}
                placeholder={t("builder.areasFilter")}
                onChange={(event) => setAreaFilter(event.target.value)}
                data-testid="campaign-area-filter"
              />
            </div>
            {visibleAreas.length === 0 ? (
              <p className="text-muted m-0 text-sm">{t("builder.areasNone")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {visibleAreas.map((area) => {
                  const on = segment.areas.includes(area.slug);
                  return (
                    <li key={area.slug}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => update({ areas: toggle(segment.areas, area.slug) })}
                        className={
                          on
                            ? "border-primary bg-primary text-primary-fg focus-visible:ring-focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                            : "border-border bg-surface hover:border-primary focus-visible:ring-focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        }
                        data-testid="campaign-area"
                        data-slug={area.slug}
                      >
                        {on ? <Icon icon={IconCheck} /> : null}
                        {area.label}
                        <span className={on ? "text-xs opacity-80" : "text-muted text-xs"}>
                          {t("builder.areaCount", { count: area.count })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!allAreas && !areaFilter && areaOptions.length > AREAS_SHOWN ? (
              <span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAllAreas(true)}>
                  {t("builder.areasMore", { count: areaOptions.length - AREAS_SHOWN })}
                </Button>
              </span>
            ) : null}
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">{t("builder.budget")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("builder.budgetMin")} error={shownErrors.budgetMin}>
                <NumberInput
                  unit={t("builder.baht")}
                  value={segment.budgetMin}
                  onChange={(event) => update({ budgetMin: event.target.value })}
                  data-testid="campaign-budget-min"
                />
              </Field>
              <Field label={t("builder.budgetMax")} error={shownErrors.budgetMax}>
                <NumberInput
                  unit={t("builder.baht")}
                  value={segment.budgetMax}
                  onChange={(event) => update({ budgetMax: event.target.value })}
                  data-testid="campaign-budget-max"
                />
              </Field>
            </div>
            <p className="text-muted m-0 text-xs">{t("builder.budgetHint")}</p>
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" data-testid="campaign-kinds">
            <legend className="mb-1 text-sm font-medium">{t("builder.kinds")}</legend>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {UNIT_KINDS.map((kind) => (
                <Checkbox
                  key={kind}
                  checked={segment.unitKinds.includes(kind)}
                  onCheckedChange={() => update({ unitKinds: toggle(segment.unitKinds, kind) })}
                  label={t(`kinds.${kind}`)}
                  value={kind}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">{t("builder.moveIn")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("builder.moveInFrom")}>
                <DatePicker
                  value={segment.moveInFrom}
                  onChange={(value) => update({ moveInFrom: value })}
                  locale={locale}
                  labels={dateLabels}
                  min={bangkokToday()}
                />
              </Field>
              <Field label={t("builder.moveInTo")} error={moveInInverted ? t("builder.moveInInverted") : undefined}>
                <DatePicker
                  value={segment.moveInTo}
                  onChange={(value) => update({ moveInTo: value })}
                  locale={locale}
                  labels={dateLabels}
                  min={segment.moveInFrom ?? bangkokToday()}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" data-testid="campaign-languages">
            <legend className="mb-1 text-sm font-medium">{t("builder.languages")}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {LANGUAGES.map((language) => (
                <Checkbox
                  key={language}
                  checked={segment.languages.includes(language)}
                  onCheckedChange={() => update({ languages: toggle(segment.languages, language) })}
                  label={t(`languages.${language}`)}
                  value={language}
                />
              ))}
            </div>
            <p className="text-muted m-0 text-xs">{t("builder.languagesHint")}</p>
          </fieldset>
        </Card>

        <Card as="section" aria-labelledby="step-size" className="flex flex-col gap-4">
          <StepTitle id="step-size" n={4} title={t("builder.step.size")} />
          <Field
            label={t("builder.max")}
            hint={t("builder.maxHint", { minimum: product.minimumRecipients })}
            error={shownErrors.max}
            required
            className="max-w-sm"
          >
            <NumberInput
              unit={t("builder.maxUnit")}
              inputMode="numeric"
              value={max}
              onChange={(event) => setMax(event.target.value)}
              data-testid="campaign-max"
            />
          </Field>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6" aria-labelledby="estimate-title">
        <Card className="flex flex-col gap-4" data-testid="campaign-estimate">
          <h2 id="estimate-title" className="m-0 text-base font-semibold">
            {t("estimate.title")}
          </h2>
          <div aria-live="polite" className="flex flex-col gap-3">
            {!request ? (
              <p className="text-muted m-0 text-sm" data-testid="estimate-idle">
                {t("estimate.pick")}
              </p>
            ) : counting ? (
              <div className="flex flex-col gap-2" data-testid="estimate-loading">
                <Skeleton className="h-9 w-32" />
                <span className="text-muted text-sm">{t("estimate.loading")}</span>
              </div>
            ) : estimate?.data ? (
              <EstimateResultView estimate={estimate.data} max={maxRecipients ?? 0} locale={locale} />
            ) : (
              <div className="flex flex-col items-start gap-2" data-testid="estimate-error">
                <ProblemNotice error={estimate?.error} />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  iconStart={IconRefresh}
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  {t("estimate.retry")}
                </Button>
              </div>
            )}
          </div>
          <p className="text-muted border-border m-0 flex items-center gap-2 border-t pt-3 text-xs">
            <Icon icon={IconShield} className="text-sm" />
            {t("estimate.privacy")}
          </p>
        </Card>
        {canSave ? (
          <div className="flex flex-col gap-3">
            <Button type="submit" loading={action.busy} data-testid="campaign-save" className="w-full">
              {t("builder.save")}
            </Button>
            <ProblemNotice error={action.error} />
          </div>
        ) : (
          <Callout tone="neutral">{t("builder.cannotSave")}</Callout>
        )}
      </aside>
    </form>
  );
}

function StepTitle({ id, n, title, aside }: { id: string; n: number; title: string; aside?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="m-0 flex items-center gap-3 text-base font-semibold">
        <span
          aria-hidden
          className="bg-primary-subtle text-primary-subtle-fg flex size-7 items-center justify-center rounded-full text-sm tabular-nums"
        >
          {n}
        </span>
        {title}
      </h2>
      {aside ? <span className="text-muted text-sm tabular-nums">{aside}</span> : null}
    </div>
  );
}

/** The API's estimate: the count (or withheld below the minimum) and its cost preview (or not on sale). */
function EstimateResultView({
  estimate,
  max,
  locale,
}: {
  estimate: Schemas["SponsoredEstimateDto"];
  max: number;
  locale: Locale;
}) {
  const t = useTranslations("owner.broadcast.estimate");
  if (estimate.estimated === null)
    return (
      <div className="flex flex-col gap-1" data-testid="estimate-withheld">
        <p className="font-display m-0 text-2xl font-semibold">
          {t("withheld", { minimum: estimate.minimumRecipients })}
        </p>
        <p className="text-muted m-0 text-sm">{t("withheldHint")}</p>
      </div>
    );
  const cost = estimate.cost;
  return (
    <>
      <div className="flex flex-col gap-1" data-testid="estimate-count" data-count={estimate.estimated}>
        <p className="font-display m-0 text-3xl font-semibold tabular-nums">
          {t("people", { count: estimate.estimated })}
        </p>
        <p className="text-muted m-0 text-sm">
          {estimate.estimated >= max ? t("capped", { count: max }) : t("peopleHint")}
        </p>
      </div>
      <div className="border-border flex flex-col gap-2 border-t pt-3" data-testid="estimate-cost">
        <h3 className="m-0 text-sm font-semibold">{t("cost")}</h3>
        {cost && estimate.product.pricePerRecipient ? (
          <>
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
              <dt className="text-muted">
                {t("costLine", {
                  count: formatNumber(cost.recipients, locale),
                  price: formatTHB(estimate.product.pricePerRecipient, locale, {
                    decimals: perRecipientDigits(estimate.product.pricePerRecipient).split(".")[1]?.length ?? 2,
                  }),
                })}
              </dt>
              <dd className="m-0 text-end">{formatTHB(cost.subtotal, locale)}</dd>
              <dt className="text-muted">{t("vat")}</dt>
              <dd className="m-0 text-end">{formatTHB(cost.vatAmount, locale)}</dd>
              <dt className="font-semibold">{t("total")}</dt>
              <dd className="m-0 text-end font-semibold" data-testid="estimate-total">
                {formatTHB(cost.total, locale)}
              </dd>
            </dl>
            <p className="text-muted m-0 text-xs">{t("costHint")}</p>
          </>
        ) : (
          <p className="text-muted m-0 text-sm" data-testid="estimate-no-cost">
            {t("noCost")}
          </p>
        )}
      </div>
    </>
  );
}
