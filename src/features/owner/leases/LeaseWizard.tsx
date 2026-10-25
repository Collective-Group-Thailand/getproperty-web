"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { LEASE_STATUS } from "@/domain/status/lease";
import { UNIT_STATUS } from "@/domain/status/unit";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDecimal, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DatePicker } from "@/ui/components/DatePicker";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Stepper } from "@/ui/components/Stepper";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconForward } from "@/ui/icons/glyphs/forward";
import { IconSign } from "@/ui/icons/glyphs/sign";

import { DocumentButton } from "../shared/DocumentButton";
import { fieldErrors } from "@/features/shared/console/FormDialog";
import { ownerPath } from "../shared/links";
import { useDateLabels } from "@/features/shared/console/labels";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { NewPartyButton } from "../parties/PartyForm";
import { LeasePreview } from "./LeasePreview";
import { ComplianceChecks } from "./ComplianceChecks";
import { LeaseInviteButton } from "./LeaseInvite";

type Step = "unit" | "parties" | "terms" | "lines" | "review" | "contract" | "sent";
const STEPS: Step[] = ["unit", "parties", "terms", "lines", "review", "contract", "sent"];
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const LINE_KINDS: Schemas["LeaseLineKind"][] = [
  "internet",
  "parking",
  "cleaning",
  "furniture",
  "common_fee",
  "water_minimum",
  "other_fixed",
];
const DRAFT_KEY = "gp:lease-wizard";

interface Co {
  partyId: string;
  displayName: string;
  role: "co_tenant" | "occupant";
}

interface Form {
  buildingId: string;
  unit: Pick<Schemas["UnitDto"], "id" | "unitNo" | "baseRent" | "unitProfileId" | "unitProfileName" | "status"> | null;
  lessee: { id: string; displayName: string } | null;
  others: Co[];
  startDate: string | null;
  months: string;
  rent: string;
  depositAmount: string;
  advanceRentAmount: string;
  billingDay: string;
  utilityBillingMode: Schemas["UtilityBillingMode"];
  keysCount: string;
  parkingSlots: string;
  lines: { kind: Schemas["LeaseLineKind"]; description: string; amount: string }[];
  addendum: Schemas["AddendumClauseDto"][];
  language?: Schemas["Language"];
  stampDutyPayer?: Schemas["StampDutyPayer"];
  bilingual?: boolean;
  savedAt?: string;
}

const EMPTY: Form = {
  buildingId: "",
  unit: null,
  lessee: null,
  others: [],
  startDate: null,
  months: "12",
  rent: "",
  depositAmount: "",
  advanceRentAmount: "",
  billingDay: "",
  utilityBillingMode: "metered",
  keysCount: "2",
  parkingSlots: "0",
  lines: [],
  addendum: [],
  language: "th",
  stampDutyPayer: "lessor",
};
const PAYERS: Schemas["StampDutyPayer"][] = ["lessor", "lessee", "shared"];

function readDraft(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(form: Form | null) {
  try {
    if (form) window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: the wizard simply does not keep a draft.
  }
}

const noSubscribe = () => () => undefined;

/**
 * The lease wizard (F2 2.2, B2.3): unit → lessee (+ co-residents, occupants) → term and amounts →
 * lease lines and the allowed addendum → review → the API creates the draft and answers its compliance
 * checks: a refusal (deposit cap, forbidden clause…) is shown with its legal reference and the step to
 * change; a D-021a warning asks for the acknowledgement and the same request is repeated → contract
 * preview (the standard contract with the addendum) → send for signature (the resident signs in
 * getproperty-liff) → status and the invitation. Defaults the owner leaves empty (deposit, advance rent)
 * are the API's — the wizard never computes an amount. The form is kept in this browser as a draft.
 */
export function LeaseWizard({
  buildings,
  templates,
  depositCapMonths,
  initialUnit,
  initialParty,
}: {
  buildings: Pick<Schemas["BuildingDto"], "id" | "name" | "access">[];
  templates: Schemas["LeaseTemplateDto"][];
  depositCapMonths: string | null;
  initialUnit: Pick<
    Schemas["UnitDto"],
    "id" | "unitNo" | "baseRent" | "unitProfileId" | "unitProfileName" | "status" | "buildingId"
  > | null;
  initialParty: { id: string; displayName: string } | null;
}) {
  const t = useTranslations("owner.leases.wizard");
  const kinds = useTranslations("owner.common.lineKind");
  const clauses = useTranslations("owner.leases.clause");
  const roles = useTranslations("owner.leases.role");
  const locale = useLocale() as Locale;
  const dateLabels = useDateLabels();
  const [step, setStep] = useState<Step>(initialUnit ? (initialParty ? "terms" : "parties") : "unit");
  const [form, setForm] = useState<Form>({
    ...EMPTY,
    buildingId: initialUnit?.buildingId ?? (buildings.length === 1 ? buildings[0]!.id : ""),
    unit: initialUnit,
    rent: initialUnit?.baseRent ?? "",
    lessee: initialParty,
  });
  const [lease, setLease] = useState<{ data: Schemas["LeaseDto"]; etag: string | null } | null>(null);
  const [units, setUnits] = useState<Schemas["UnitDto"][] | null>(null);
  const [profile, setProfile] = useState<Schemas["UnitProfileDto"] | null>(null);
  const [partyQuery, setPartyQuery] = useState("");
  const [partyHits, setPartyHits] = useState<Schemas["PartyDto"][]>([]);
  const action = useApiAction({ refresh: false });
  const sendKey = useIdempotencyKey();
  const savedDraft = useSyncExternalStore(noSubscribe, readDraft, () => "");
  const [draftDismissed, setDraftDismissed] = useState(false);
  const errors = fieldErrors(action.error);
  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  // Keep the form in this browser while it is being filled in (design-system.md §4 "autosave drafts").
  useEffect(() => {
    if (lease || step === "unit") return;
    writeDraft(form);
  }, [form, lease, step]);

  // Vacant units of the chosen building.
  useEffect(() => {
    if (!form.buildingId) return;
    let cancelled = false;
    unwrap(
      browserApi().GET("/v1/owner/units", {
        params: { query: { buildingId: form.buildingId, status: "vacant", perPage: 100 } },
      }),
    )
      .then((page) => !cancelled && setUnits(page.data))
      .catch(() => !cancelled && setUnits([]));
    return () => {
      cancelled = true;
    };
  }, [form.buildingId]);

  // The unit type's defaults (lease lines; deposit and advance months are applied by the API).
  useEffect(() => {
    if (!form.unit?.unitProfileId || !form.buildingId) return;
    let cancelled = false;
    unwrap(
      browserApi().GET("/v1/owner/buildings/{buildingId}/unit-profiles", {
        params: { path: { buildingId: form.buildingId } },
      }),
    )
      .then((list) => {
        if (cancelled) return;
        const found = list.find((candidate) => candidate.id === form.unit?.unitProfileId) ?? null;
        setProfile(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [form.unit?.unitProfileId, form.buildingId]);

  // Party search.
  useEffect(() => {
    const q = partyQuery.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      unwrap(browserApi().GET("/v1/owner/parties", { params: { query: { q, perPage: 8 } } }))
        .then((page) => !cancelled && setPartyHits(page.data))
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [partyQuery]);

  const template = templates.find((candidate) => candidate.platform) ?? templates[0];
  const version = template?.versions.find((candidate) => candidate.state === "published") ?? template?.versions[0];
  const allowedClauses = version?.allowedClauseTypes ?? [];
  // B7.5: a landlord writes on the templates of their kind, in Thai or English; the standard contract is Thai only
  const languages = [
    ...new Set(
      templates.flatMap((candidate) =>
        candidate.versions.filter((v) => v.state === "published").map((v) => v.language),
      ),
    ),
  ];
  const landlord = templates.some((candidate) => candidate.key.startsWith("landlord_"));
  const index = STEPS.indexOf(step);

  const termsValid =
    Boolean(form.startDate) &&
    Number.isInteger(Number(form.months)) &&
    Number(form.months) >= 1 &&
    MONEY.test(form.rent) &&
    (form.depositAmount === "" || MONEY.test(form.depositAmount)) &&
    (form.advanceRentAmount === "" || MONEY.test(form.advanceRentAmount)) &&
    (form.billingDay === "" ||
      (Number.isInteger(Number(form.billingDay)) && Number(form.billingDay) >= 1 && Number(form.billingDay) <= 28));
  const linesValid =
    form.lines.every((line) => line.description.trim() && MONEY.test(line.amount)) &&
    form.addendum.every((clause) => clause.title.trim() && clause.text.trim());

  const terms = (acknowledgementIds: string[]): Schemas["LeaseUpdateDto"] => ({
    startDate: form.startDate!,
    months: Number(form.months),
    rent: form.rent,
    depositAmount: form.depositAmount || undefined,
    advanceRentAmount: form.advanceRentAmount || undefined,
    billingDay: form.billingDay ? Number(form.billingDay) : null,
    utilityBillingMode: form.utilityBillingMode,
    keysCount: Number(form.keysCount) || 0,
    parkingSlots: Number(form.parkingSlots) || 0,
    lines: form.lines.map((line) => ({ ...line, recurrence: "monthly" })),
    addendum: form.addendum,
    acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined,
    ...(languages.length > 1 ? { language: form.language ?? "th", bilingual: form.bilingual ?? false } : {}),
    ...(landlord ? { stampDutyPayer: form.stampDutyPayer ?? "lessor" } : {}),
  });

  const createBody = (ackIds: string[]): Schemas["LeaseCreateDto"] => ({
    ...terms(ackIds),
    startDate: form.startDate!,
    months: Number(form.months),
    rent: form.rent,
    utilityBillingMode: form.utilityBillingMode,
    unitId: form.unit!.id,
    lesseePartyId: form.lessee!.id,
    coTenantPartyIds: form.others.filter((other) => other.role === "co_tenant").map((other) => other.partyId),
    occupantPartyIds: form.others.filter((other) => other.role === "occupant").map((other) => other.partyId),
  });

  const createOrUpdate = () =>
    action.run(
      async (ackIds) => {
        if (!lease) return unwrapWithETag(browserApi().POST("/v1/owner/leases", { body: createBody(ackIds) }));
        return unwrapWithETag(
          browserApi().PATCH("/v1/owner/leases/{leaseId}", {
            params: { path: { leaseId: lease.data.id }, header: { "If-Match": lease.etag ?? "*" } },
            body: terms(ackIds),
          }),
        );
      },
      (result) => {
        setLease(result as { data: Schemas["LeaseDto"]; etag: string | null });
        setStep("contract");
      },
    );

  const unitOptions = useMemo(() => units ?? [], [units]);
  const draft = (() => {
    if (!savedDraft || draftDismissed || lease) return null;
    try {
      return JSON.parse(savedDraft) as Form;
    } catch {
      return null;
    }
  })();

  return (
    <div className="flex flex-col gap-5" data-testid="lease-wizard" data-step={step}>
      <Stepper
        steps={STEPS.map((id) => ({ id, label: t(`step.${id}`) }))}
        current={index}
        label={t("steps")}
        progressText={t("progress", { step: index + 1, total: STEPS.length })}
      />

      {draft && step === "unit" && draft.unit ? (
        <Callout
          tone="info"
          title={t("draftTitle")}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setForm({ ...EMPTY, ...draft });
                  setStep("review");
                }}
                data-testid="restore-draft"
              >
                {t("restore")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  writeDraft(null);
                  setDraftDismissed(true);
                }}
              >
                {t("discard")}
              </Button>
            </div>
          }
        >
          {t("draftBody", { unit: draft.unit.unitNo, party: draft.lessee?.displayName ?? "—" })}
        </Callout>
      ) : null}

      {step === "unit" ? (
        <section className="flex flex-col gap-4" aria-labelledby="w-unit">
          <h2 id="w-unit" className="text-lg font-semibold">
            {t("unitTitle")}
          </h2>
          <Field label={t("building")} className="max-w-sm">
            <NativeSelect
              value={form.buildingId}
              placeholder={t("chooseBuilding")}
              onChange={(event) => update({ buildingId: event.target.value, unit: null })}
              options={buildings
                .filter((building) => building.access !== "grant")
                .map((building) => ({ value: building.id, label: building.name }))}
              data-testid="wizard-building"
            />
          </Field>
          {form.buildingId ? (
            unitOptions.length === 0 ? (
              <p className="text-muted text-sm">{units === null ? t("loadingUnits") : t("noVacant")}</p>
            ) : (
              <div
                role="radiogroup"
                aria-label={t("vacantUnits")}
                className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2"
              >
                {unitOptions.map((unit) => {
                  const chosen = form.unit?.id === unit.id;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      onClick={() => update({ unit, rent: unit.baseRent ?? form.rent })}
                      className={
                        chosen
                          ? "rounded-card border-primary bg-primary-subtle flex flex-col items-start gap-1 border-2 p-3 text-start"
                          : "rounded-card border-border bg-surface hover:bg-bg-subtle flex flex-col items-start gap-1 border p-3 text-start"
                      }
                      data-testid="wizard-unit"
                    >
                      <span className="font-mono font-semibold">{unit.unitNo}</span>
                      <StatusBadgeOf map={UNIT_STATUS} value={unit.status} size="sm" />
                      <span className="text-muted text-xs">
                        {unit.baseRent ? formatTHB(unit.baseRent, locale) : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : null}
          <div className="flex justify-end">
            <Button
              iconEnd={IconForward}
              disabled={!form.unit}
              onClick={() => setStep("parties")}
              data-testid="wizard-next"
            >
              {t("next")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "parties" ? (
        <section className="flex flex-col gap-4" aria-labelledby="w-parties">
          <h2 id="w-parties" className="text-lg font-semibold">
            {t("partiesTitle", { unit: form.unit?.unitNo ?? "" })}
          </h2>
          <Field label={t("searchParty")} hint={t("searchPartyHint")}>
            <Input
              type="search"
              value={partyQuery}
              onChange={(event) => setPartyQuery(event.target.value)}
              data-testid="party-search"
            />
          </Field>
          {partyQuery.trim().length >= 2 ? (
            <ul className="divide-border border-border rounded-card divide-y border" data-testid="party-hits">
              {partyHits.map((party) => (
                <li key={party.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>{party.displayName}</span>
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => update({ lessee: { id: party.id, displayName: party.displayName } })}
                      data-testid="choose-lessee"
                    >
                      {t("asLessee")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={form.lessee?.id === party.id || form.others.some((other) => other.partyId === party.id)}
                      onClick={() =>
                        update({
                          others: [
                            ...form.others,
                            { partyId: party.id, displayName: party.displayName, role: "co_tenant" },
                          ],
                        })
                      }
                    >
                      {t("asCo")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <NewPartyButton
            variant="secondary"
            onCreated={(party) => update({ lessee: { id: party.id, displayName: party.displayName } })}
          />
          <DescriptionList
            columns={1}
            items={[
              {
                id: "lessee",
                term: t("lessee"),
                description: form.lessee ? (
                  <span data-testid="chosen-lessee">{form.lessee.displayName}</span>
                ) : (
                  t("noLessee")
                ),
              },
            ]}
          />
          {form.others.length ? (
            <ul className="flex flex-col gap-2">
              {form.others.map((other) => (
                <li key={other.partyId} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-40">{other.displayName}</span>
                  <NativeSelect
                    inputSize="sm"
                    aria-label={t("roleOf", { name: other.displayName })}
                    value={other.role}
                    onChange={(event) =>
                      update({
                        others: form.others.map((candidate) =>
                          candidate.partyId === other.partyId
                            ? { ...candidate, role: event.target.value as Co["role"] }
                            : candidate,
                        ),
                      })
                    }
                    options={[
                      { value: "co_tenant", label: roles("co_tenant") },
                      { value: "occupant", label: roles("occupant") },
                    ]}
                    className="w-48"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconStart={IconDelete}
                    onClick={() =>
                      update({ others: form.others.filter((candidate) => candidate.partyId !== other.partyId) })
                    }
                  >
                    {t("remove")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex justify-between">
            <Button variant="secondary" iconStart={IconBack} onClick={() => setStep("unit")}>
              {t("back")}
            </Button>
            <Button
              iconEnd={IconForward}
              disabled={!form.lessee}
              onClick={() => setStep("terms")}
              data-testid="wizard-next"
            >
              {t("next")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "terms" ? (
        <section className="flex flex-col gap-4" aria-labelledby="w-terms">
          <h2 id="w-terms" className="text-lg font-semibold">
            {t("termsTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("startDate")} required error={errors.startDate}>
              <DatePicker
                value={form.startDate}
                onChange={(value) => update({ startDate: value })}
                locale={locale}
                labels={dateLabels}
                placeholder={t("chooseDate")}
              />
            </Field>
            <Field label={t("months")} required error={errors.months}>
              <Input
                type="number"
                min={1}
                max={120}
                value={form.months}
                onChange={(event) => update({ months: event.target.value })}
                data-testid="lease-months"
              />
            </Field>
            <Field label={t("rent")} required hint={t("moneyHint")} error={errors.rent}>
              <Input
                inputMode="decimal"
                value={form.rent}
                onChange={(event) => update({ rent: event.target.value })}
                data-testid="lease-rent"
              />
            </Field>
            <Field
              label={t("deposit")}
              hint={
                profile
                  ? t("defaultMonths", { months: formatDecimal(profile.defaultDepositMonths, locale) })
                  : t("defaultApi")
              }
              error={errors.depositAmount}
            >
              <Input
                inputMode="decimal"
                value={form.depositAmount}
                onChange={(event) => update({ depositAmount: event.target.value })}
                data-testid="lease-deposit"
              />
            </Field>
            <Field
              label={t("advance")}
              hint={
                profile
                  ? t("defaultMonths", { months: formatDecimal(profile.defaultAdvanceRentMonths, locale) })
                  : t("defaultApi")
              }
              error={errors.advanceRentAmount}
            >
              <Input
                inputMode="decimal"
                value={form.advanceRentAmount}
                onChange={(event) => update({ advanceRentAmount: event.target.value })}
                data-testid="lease-advance"
              />
            </Field>
            <Field label={t("billingDay")} hint={t("billingDayHint")} error={errors.billingDay}>
              <Input
                type="number"
                min={1}
                max={28}
                value={form.billingDay}
                onChange={(event) => update({ billingDay: event.target.value })}
              />
            </Field>
            <Field label={t("keys")}>
              <Input
                type="number"
                min={0}
                value={form.keysCount}
                onChange={(event) => update({ keysCount: event.target.value })}
              />
            </Field>
            <Field label={t("parking")}>
              <Input
                type="number"
                min={0}
                value={form.parkingSlots}
                onChange={(event) => update({ parkingSlots: event.target.value })}
              />
            </Field>
          </div>
          {depositCapMonths ? (
            <div data-testid="deposit-cap-hint">
              <Callout tone="info" title={t("capTitle")}>
                {t("capBody", { months: formatDecimal(depositCapMonths, locale) })}
              </Callout>
            </div>
          ) : null}
          {languages.length > 1 || landlord ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {languages.length > 1 ? (
                <div className="flex flex-col gap-2" data-testid="lease-language">
                  <span className="font-medium">{t("language")}</span>
                  <SegmentedControl
                    label={t("language")}
                    value={form.language ?? "th"}
                    onValueChange={(value) => update({ language: value as Schemas["Language"] })}
                    options={[
                      { value: "th", label: t("langTh") },
                      { value: "en", label: t("langEn") },
                    ]}
                  />
                  <p className="text-muted text-sm">{t("languageHint")}</p>
                  <Checkbox
                    label={t("bilingual")}
                    description={t("bilingualHint")}
                    checked={form.bilingual ?? false}
                    onCheckedChange={(checked) => update({ bilingual: checked === true })}
                    data-testid="lease-bilingual"
                  />
                </div>
              ) : null}
              {landlord ? (
                <Field label={t("stampDutyPayer")} hint={t("stampDutyHint")}>
                  <NativeSelect
                    value={form.stampDutyPayer ?? "lessor"}
                    onChange={(event) => update({ stampDutyPayer: event.target.value as Schemas["StampDutyPayer"] })}
                    options={PAYERS.map((value) => ({ value, label: t(`payer.${value}`) }))}
                    data-testid="lease-stamp-duty-payer"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="font-medium">{t("utilities")}</span>
            <SegmentedControl
              label={t("utilities")}
              value={form.utilityBillingMode}
              onValueChange={(value) => update({ utilityBillingMode: value as Schemas["UtilityBillingMode"] })}
              options={[
                { value: "metered", label: t("metered") },
                { value: "included", label: t("included") },
              ]}
            />
            <p className="text-muted text-sm">
              {t(form.utilityBillingMode === "metered" ? "meteredHint" : "includedHint")}
            </p>
          </div>
          <div className="flex justify-between">
            <Button variant="secondary" iconStart={IconBack} onClick={() => setStep("parties")}>
              {t("back")}
            </Button>
            <Button
              iconEnd={IconForward}
              disabled={!termsValid}
              onClick={() => {
                if (form.lines.length === 0 && profile?.defaultLeaseLines.length)
                  update({
                    lines: profile.defaultLeaseLines.map((line) => ({
                      kind: line.kind,
                      description: line.description,
                      amount: line.amount,
                    })),
                  });
                setStep("lines");
              }}
              data-testid="wizard-next"
            >
              {t("next")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "lines" ? (
        <section className="flex flex-col gap-4" aria-labelledby="w-lines">
          <h2 id="w-lines" className="text-lg font-semibold">
            {t("linesTitle")}
          </h2>
          <p className="text-muted text-sm">{t("linesHint")}</p>
          {form.lines.map((line, row) => (
            <div key={row} className="grid items-end gap-2 sm:grid-cols-[11rem_1fr_9rem_auto]" data-testid="lease-line">
              <Field label={t("lineKind")} labelHidden={row > 0}>
                <NativeSelect
                  value={line.kind}
                  onChange={(event) =>
                    update({
                      lines: form.lines.map((candidate, at) =>
                        at === row ? { ...candidate, kind: event.target.value as Schemas["LeaseLineKind"] } : candidate,
                      ),
                    })
                  }
                  options={LINE_KINDS.map((kind) => ({ value: kind, label: kinds(kind) }))}
                />
              </Field>
              <Field label={t("lineDescription")} labelHidden={row > 0} error={errors[`lines.${row}.description`]}>
                <Input
                  value={line.description}
                  onChange={(event) =>
                    update({
                      lines: form.lines.map((candidate, at) =>
                        at === row ? { ...candidate, description: event.target.value } : candidate,
                      ),
                    })
                  }
                />
              </Field>
              <Field label={t("lineAmount")} labelHidden={row > 0} error={errors[`lines.${row}.amount`]}>
                <Input
                  inputMode="decimal"
                  value={line.amount}
                  onChange={(event) =>
                    update({
                      lines: form.lines.map((candidate, at) =>
                        at === row ? { ...candidate, amount: event.target.value } : candidate,
                      ),
                    })
                  }
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                iconStart={IconDelete}
                onClick={() => update({ lines: form.lines.filter((_, at) => at !== row) })}
              >
                {t("remove")}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            iconStart={IconAdd}
            className="self-start"
            onClick={() => update({ lines: [...form.lines, { kind: "other_fixed", description: "", amount: "" }] })}
            data-testid="add-line"
          >
            {t("addLine")}
          </Button>

          <h3 className="mt-2 font-semibold">{t("addendumTitle")}</h3>
          <p className="text-muted text-sm">{t("addendumHint", { legalRef: version?.legalRef ?? "" })}</p>
          {form.addendum.map((clause, row) => (
            <div
              key={row}
              className="rounded-control border-border grid gap-2 border p-3 sm:grid-cols-[12rem_1fr]"
              data-testid="addendum-clause"
            >
              <Field label={t("clauseType")}>
                <NativeSelect
                  value={clause.type}
                  onChange={(event) =>
                    update({
                      addendum: form.addendum.map((candidate, at) =>
                        at === row
                          ? { ...candidate, type: event.target.value as Schemas["AddendumClauseType"] }
                          : candidate,
                      ),
                    })
                  }
                  options={allowedClauses.map((type) => ({ value: type, label: clauses(type) }))}
                />
              </Field>
              <Field label={t("clauseTitle")}>
                <Input
                  value={clause.title}
                  onChange={(event) =>
                    update({
                      addendum: form.addendum.map((candidate, at) =>
                        at === row ? { ...candidate, title: event.target.value } : candidate,
                      ),
                    })
                  }
                />
              </Field>
              <Field label={t("clauseText")} className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={clause.text}
                  onChange={(event) =>
                    update({
                      addendum: form.addendum.map((candidate, at) =>
                        at === row ? { ...candidate, text: event.target.value } : candidate,
                      ),
                    })
                  }
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                iconStart={IconDelete}
                className="justify-self-start"
                onClick={() => update({ addendum: form.addendum.filter((_, at) => at !== row) })}
              >
                {t("remove")}
              </Button>
            </div>
          ))}
          {allowedClauses.length ? (
            <Button
              size="sm"
              variant="secondary"
              iconStart={IconAdd}
              className="self-start"
              onClick={() =>
                update({ addendum: [...form.addendum, { type: allowedClauses[0]!, title: "", text: "" }] })
              }
            >
              {t("addClause")}
            </Button>
          ) : null}
          <div className="flex justify-between">
            <Button variant="secondary" iconStart={IconBack} onClick={() => setStep("terms")}>
              {t("back")}
            </Button>
            <Button
              iconEnd={IconForward}
              disabled={!linesValid}
              onClick={() => setStep("review")}
              data-testid="wizard-next"
            >
              {t("next")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="flex flex-col gap-4" aria-labelledby="w-review">
          <h2 id="w-review" className="text-lg font-semibold">
            {t("reviewTitle")}
          </h2>
          <DescriptionList
            items={[
              { id: "unit", term: t("unit"), description: form.unit?.unitNo ?? null },
              { id: "lessee", term: t("lessee"), description: form.lessee?.displayName ?? null },
              {
                id: "others",
                term: t("others"),
                description:
                  form.others.map((other) => `${other.displayName} (${roles(other.role)})`).join(", ") || null,
              },
              {
                id: "start",
                term: t("startDate"),
                description: form.startDate ? formatDate(form.startDate, locale) : null,
              },
              { id: "months", term: t("months"), description: form.months },
              { id: "rent", term: t("rent"), description: MONEY.test(form.rent) ? formatTHB(form.rent, locale) : null },
              {
                id: "deposit",
                term: t("deposit"),
                description: form.depositAmount ? formatTHB(form.depositAmount, locale) : t("defaultApi"),
              },
              {
                id: "advance",
                term: t("advance"),
                description: form.advanceRentAmount ? formatTHB(form.advanceRentAmount, locale) : t("defaultApi"),
              },
              { id: "utilities", term: t("utilities"), description: t(form.utilityBillingMode) },
              ...(languages.length > 1
                ? [
                    {
                      id: "language",
                      term: t("language"),
                      description: form.bilingual
                        ? t("bilingualValue")
                        : t(form.language === "en" ? "langEn" : "langTh"),
                    },
                  ]
                : []),
              ...(landlord
                ? [
                    {
                      id: "payer",
                      term: t("stampDutyPayer"),
                      description: t(`payer.${form.stampDutyPayer ?? "lessor"}`),
                    },
                  ]
                : []),
              {
                id: "lines",
                term: t("linesTitle"),
                wide: true,
                description: form.lines.length
                  ? form.lines
                      .map(
                        (line) =>
                          `${line.description} ${MONEY.test(line.amount) ? formatTHB(line.amount, locale) : ""}`,
                      )
                      .join(" · ")
                  : null,
              },
              {
                id: "addendum",
                term: t("addendumTitle"),
                wide: true,
                description: form.addendum.map((clause) => clause.title).join(" · ") || null,
              },
            ]}
          />
          {!lease && form.unit && form.lessee && form.startDate ? <LeasePreview body={createBody([])} /> : null}
          <ProblemNotice error={action.error} onAcknowledge={action.acknowledge} acknowledging={action.acknowledging} />
          {action.error ? <p className="text-muted text-sm">{t("fixHint")}</p> : null}
          <div className="flex justify-between">
            <Button variant="secondary" iconStart={IconBack} onClick={() => setStep("lines")}>
              {t("back")}
            </Button>
            <Button loading={action.busy} onClick={() => void createOrUpdate()} data-testid="lease-create">
              {lease ? t("saveDraft") : t("createDraft")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "contract" && lease ? (
        <section className="flex flex-col gap-4" aria-labelledby="w-contract">
          <h2 id="w-contract" className="text-lg font-semibold">
            {t("contractTitle")}
          </h2>
          <ComplianceChecks lease={lease.data} />
          <p className="text-muted text-sm">{t("contractBody", { template: template?.name ?? "" })}</p>
          <div>
            <DocumentButton
              document={{ kind: "leasePreview", id: lease.data.id }}
              label={t("preview")}
              title={t("previewTitle", { unit: lease.data.unitNo })}
              testId="contract-preview"
            />
          </div>
          <ProblemNotice error={action.error} onAcknowledge={action.acknowledge} acknowledging={action.acknowledging} />
          <div className="flex justify-between">
            <Button variant="secondary" iconStart={IconBack} onClick={() => setStep("review")}>
              {t("edit")}
            </Button>
            <Button
              iconStart={IconSign}
              loading={action.busy}
              onClick={() =>
                void action.run(
                  () =>
                    unwrap(
                      browserApi().POST("/v1/owner/leases/{leaseId}/actions/send-for-signature", {
                        params: { path: { leaseId: lease.data.id }, header: { "Idempotency-Key": sendKey.key } },
                      }),
                    ),
                  (result) => {
                    setLease({ data: result as Schemas["LeaseDto"], etag: null });
                    writeDraft(null);
                    setStep("sent");
                  },
                )
              }
              data-testid="send-for-signature"
            >
              {t("send")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "sent" && lease ? (
        <section className="flex flex-col gap-4" aria-labelledby="w-sent" data-testid="lease-sent">
          <h2 id="w-sent" className="text-lg font-semibold">
            {t("sentTitle", { number: lease.data.number ?? "" })}
          </h2>
          <p className="flex items-center gap-2">
            <StatusBadgeOf map={LEASE_STATUS} value={lease.data.status} />
            <span className="text-muted text-sm">{t("sentBody")}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <LeaseInviteButton
              leaseId={lease.data.id}
              parties={lease.data.parties.filter((party) => party.isSigner)}
              size="md"
            />
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, `/leases/${lease.data.id}`)} data-testid="open-lease">
                {t("openLease")}
              </a>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
