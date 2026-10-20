"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { bangkokInstant, bangkokLocal } from "@/features/shared/console/time";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { fieldErrors } from "@/features/shared/console/FormDialog";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

import { ownerPath } from "../shared/links";

const LANGUAGES = ["th", "en", "my", "km", "lo", "zh"] as const;
type Language = (typeof LANGUAGES)[number];
type Translated = Exclude<Language, "th">;
type Audience = "all" | "floors" | "units";

interface BuildingChoice {
  id: string;
  name: string;
  floors: { id: string; name: string }[];
  units: { id: string; unitNo: string }[];
}

/**
 * Composes an announcement (D-073, D-212): the Thai text, translations (en, my, km, lo, zh — a resident reads
 * their language, else Thai), the building or the whole tenant, an audience of floors or units, pinned and
 * expiry; saved as a draft or published at once (LINE to the audience, quiet hours and consent apply). A
 * published text cannot change — only its pin and expiry.
 */
export function AnnouncementForm({
  buildings,
  initialBuildingId,
  announcement,
}: {
  buildings: BuildingChoice[];
  initialBuildingId: string | null;
  announcement?: Schemas["AnnouncementDto"];
}) {
  const t = useTranslations("owner.community.compose");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const action = useApiAction<Schemas["AnnouncementDto"]>({ refresh: false });
  const [buildingId, setBuildingId] = useState(
    announcement ? (announcement.buildingId ?? "") : (initialBuildingId ?? ""),
  );
  const [language, setLanguage] = useState<Language>("th");
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.bodyTh ?? "");
  const [translations, setTranslations] = useState<Schemas["TranslationsDto"]>(announcement?.translations ?? {});
  const initialAudience: Audience = announcement?.audienceFilter.unitIds?.length
    ? "units"
    : announcement?.audienceFilter.floorIds?.length
      ? "floors"
      : "all";
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [floorIds, setFloorIds] = useState<string[]>(announcement?.audienceFilter.floorIds ?? []);
  const [unitIds, setUnitIds] = useState<string[]>(announcement?.audienceFilter.unitIds ?? []);
  const [pinned, setPinned] = useState(announcement?.pinned ?? false);
  const [expiresAt, setExpiresAt] = useState(bangkokLocal(announcement?.expiresAt));
  const building = buildings.find((candidate) => candidate.id === buildingId) ?? null;
  const errors = fieldErrors(action.error);

  const filter: Schemas["AudienceFilterDto"] =
    audience === "floors" ? { floorIds } : audience === "units" ? { unitIds } : {};
  const cleanTranslations = Object.fromEntries(
    Object.entries(translations).filter(([, value]) => value && value.body.trim()),
  ) as Schemas["TranslationsDto"];

  const save = (publish: boolean) =>
    action.run(
      () =>
        announcement
          ? unwrap(
              browserApi().PATCH("/v1/owner/announcements/{announcementId}", {
                params: { path: { announcementId: announcement.id } },
                body: {
                  title: title.trim(),
                  bodyTh: body.trim(),
                  translations: cleanTranslations,
                  audienceFilter: filter,
                  pinned,
                  expiresAt: bangkokInstant(expiresAt) ?? null,
                },
              }),
            ).then((saved) =>
              publish
                ? unwrap(
                    browserApi().POST("/v1/owner/announcements/{announcementId}/actions/publish", {
                      params: { path: { announcementId: saved.id } },
                    }),
                  )
                : saved,
            )
          : unwrap(
              browserApi().POST("/v1/owner/announcements", {
                body: {
                  buildingId: buildingId || null,
                  title: title.trim(),
                  bodyTh: body.trim(),
                  translations: cleanTranslations,
                  audienceFilter: filter,
                  pinned,
                  expiresAt: bangkokInstant(expiresAt) ?? null,
                  publish,
                },
              }),
            ),
      (saved) => {
        router.push(ownerPath(locale, `/announcements/${saved.id}`));
        router.refresh();
      },
    );

  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((one) => one !== id));
  const translated = language === "th" ? null : (translations[language as Translated] ?? { title: "", body: "" });

  return (
    <Card className="flex flex-col gap-5" data-testid="announcement-form">
      {!announcement ? (
        <Field label={t("building")} hint={t("buildingHint")} error={errors.buildingId}>
          <NativeSelect
            value={buildingId}
            onChange={(event) => {
              setBuildingId(event.target.value);
              setFloorIds([]);
              setUnitIds([]);
              if (!event.target.value) setAudience("all");
            }}
            placeholder={t("wholeTenant")}
            options={buildings.map((one) => ({ value: one.id, label: one.name }))}
            data-testid="announcement-building"
          />
        </Field>
      ) : null}
      <SegmentedControl
        label={t("language")}
        value={language}
        onValueChange={(value) => setLanguage(value as Language)}
        options={LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) }))}
      />
      {language === "th" ? (
        <>
          <Field label={t("title")} required error={errors.title}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} data-testid="announcement-title" />
          </Field>
          <Field label={t("body")} required error={errors.bodyTh}>
            <Textarea
              rows={6}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              data-testid="announcement-body"
            />
          </Field>
        </>
      ) : (
        <>
          <p className="text-muted text-sm">{t("translationHint", { language: t(`languages.${language}`) })}</p>
          <Field label={t("translatedTitle", { language: t(`languages.${language}`) })}>
            <Input
              value={translated?.title ?? ""}
              onChange={(event) =>
                setTranslations((current) => ({
                  ...current,
                  [language]: { title: event.target.value, body: current[language as Translated]?.body ?? "" },
                }))
              }
              data-testid={`translation-title-${language}`}
            />
          </Field>
          <Field label={t("translatedBody", { language: t(`languages.${language}`) })}>
            <Textarea
              rows={6}
              value={translated?.body ?? ""}
              onChange={(event) =>
                setTranslations((current) => ({
                  ...current,
                  [language]: { title: current[language as Translated]?.title ?? "", body: event.target.value },
                }))
              }
              data-testid={`translation-body-${language}`}
            />
          </Field>
        </>
      )}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">{t("audience")}</legend>
        <SegmentedControl
          label={t("audience")}
          value={audience}
          onValueChange={(value) => setAudience(value as Audience)}
          options={[
            { value: "all", label: building ? t("audienceBuilding") : t("audienceTenant") },
            ...(building
              ? [
                  { value: "floors", label: t("audienceFloors") },
                  { value: "units", label: t("audienceUnits") },
                ]
              : []),
          ]}
        />
        {audience === "floors" && building ? (
          <div className="grid gap-2 sm:grid-cols-3" data-testid="audience-floors">
            {building.floors.map((floor) => (
              <Checkbox
                key={floor.id}
                label={floor.name}
                checked={floorIds.includes(floor.id)}
                onCheckedChange={(on) => setFloorIds((list) => toggle(list, floor.id, on === true))}
              />
            ))}
          </div>
        ) : null}
        {audience === "units" && building ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-4" data-testid="audience-units">
            {building.units.map((unit) => (
              <Checkbox
                key={unit.id}
                label={unit.unitNo}
                checked={unitIds.includes(unit.id)}
                onCheckedChange={(on) => setUnitIds((list) => toggle(list, unit.id, on === true))}
              />
            ))}
          </div>
        ) : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Checkbox label={t("pinned")} checked={pinned} onCheckedChange={(on) => setPinned(on === true)} />
        <Field label={t("expiresAt")} hint={t("expiresHint")} error={errors.expiresAt}>
          <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </Field>
      </div>
      <ProblemNotice error={action.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          loading={action.busy}
          disabled={!title.trim() || !body.trim()}
          onClick={() => void save(false)}
          data-testid="announcement-save"
        >
          {t("saveDraft")}
        </Button>
        <Button
          iconStart={IconMegaphone}
          loading={action.busy}
          disabled={!title.trim() || !body.trim()}
          onClick={() => void save(true)}
          data-testid="announcement-publish-now"
        >
          {t("publishNow")}
        </Button>
      </div>
    </Card>
  );
}
