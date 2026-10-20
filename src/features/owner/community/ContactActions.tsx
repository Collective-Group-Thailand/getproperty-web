"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";

const KINDS: Schemas["ContactKind"][] = ["emergency", "building", "vendor", "utility"];

function ContactFields({
  contact,
  buildings,
  errors,
}: {
  contact?: Schemas["ContactDto"];
  buildings?: { id: string; name: string }[];
  errors: Record<string, string>;
}) {
  const t = useTranslations("owner.community.contacts");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name")} required error={errors.name}>
          <Input name="name" required defaultValue={contact?.name} data-testid="contact-name" />
        </Field>
        <Field label={t("kind")} error={errors.kind}>
          <NativeSelect
            name="kind"
            defaultValue={contact?.kind ?? "building"}
            options={KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
          />
        </Field>
        {buildings ? (
          <Field label={t("building")} error={errors.buildingId}>
            <NativeSelect
              name="buildingId"
              placeholder={t("wholeTenant")}
              options={buildings.map((building) => ({ value: building.id, label: building.name }))}
            />
          </Field>
        ) : null}
        <Field label={t("phone")} hint={t("phoneOrLine")} error={errors.phone}>
          <Input name="phone" type="tel" defaultValue={contact?.phone ?? ""} data-testid="contact-phone" />
        </Field>
        <Field label={t("lineId")} error={errors.lineId}>
          <Input name="lineId" defaultValue={contact?.lineId ?? ""} />
        </Field>
        <Field label={t("sortOrder")} error={errors.sortOrder}>
          <Input name="sortOrder" type="number" min={0} defaultValue={contact?.sortOrder} />
        </Field>
      </div>
      <Field label={t("notes")} error={errors.notes}>
        <Textarea name="notes" rows={2} defaultValue={contact?.notes ?? ""} />
      </Field>
    </>
  );
}

const fields = (data: FormData) => ({
  name: text(data, "name"),
  kind: text(data, "kind") as Schemas["ContactKind"],
  phone: text(data, "phone") ?? null,
  lineId: text(data, "lineId") ?? null,
  notes: text(data, "notes") ?? null,
  sortOrder: integer(data, "sortOrder"),
});

/** A contact residents see (emergency, building, vendor, utility) — a phone, a LINE id or both (D-212). */
export function NewContact({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.community.contacts");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      variant="primary"
      testId="contact-add"
      title={t("addTitle")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/contacts", {
            body: { ...fields(data), buildingId: text(data, "buildingId") ?? null },
          }),
        )
      }
    >
      {(errors) => <ContactFields buildings={buildings} errors={errors} />}
    </FormDialog>
  );
}

export function EditContact({ contact }: { contact: Schemas["ContactDto"] }) {
  const t = useTranslations("owner.community.contacts");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      variant="ghost"
      size="sm"
      testId="contact-edit"
      title={t("editTitle", { name: contact.name })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/owner/contacts/{contactId}", {
            params: { path: { contactId: contact.id } },
            body: fields(data),
          }),
        )
      }
    >
      {(errors) => <ContactFields contact={contact} errors={errors} />}
    </FormDialog>
  );
}

export function RemoveContact({ contact }: { contact: Pick<Schemas["ContactDto"], "id" | "name"> }) {
  const t = useTranslations("owner.community.contacts");
  return (
    <ConfirmAction
      label={t("remove")}
      icon={IconDelete}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="contact-remove"
      title={t("removeTitle", { name: contact.name })}
      description={t("removeBody")}
      confirmLabel={t("remove")}
      successMessage={t("removed")}
      onConfirm={() =>
        unwrap(browserApi().DELETE("/v1/owner/contacts/{contactId}", { params: { path: { contactId: contact.id } } }))
      }
    />
  );
}
