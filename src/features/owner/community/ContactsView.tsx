import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatPhone } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconContact } from "@/ui/icons/glyphs/contact";

import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { CommunityNav } from "./CommunityNav";
import { EditContact, NewContact, RemoveContact } from "./ContactActions";

/** Contacts residents see in their app (F2 2.7, D-212): emergency, the building, vendors, utilities. */
export async function ContactsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.community.contacts");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const contacts = await unwrap(
    api.GET("/v1/owner/contacts", { params: { query: { buildingId: building?.id } } }),
  ).then((body) => [...body.data].sort((a, b) => a.sortOrder - b.sortOrder));
  const canManage = ownerCan(me, "community.manage") && !readOnly(me);
  const buildingName = (id: string | null) =>
    id ? (context.buildings.find((candidate) => candidate.id === id)?.name ?? "") : t("wholeTenant");
  return (
    <OwnerPage testId="contacts">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("title") }]}
        actions={canManage ? <NewContact buildings={context.buildings.map(({ id, name }) => ({ id, name }))} /> : null}
      />
      <CommunityNav current="/community/contacts" locale={locale} />
      {contacts.length === 0 ? (
        <Card>
          <EmptyState icon={IconContact} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="contact-table"
          minWidth="44rem"
          columns={[
            { key: "name", header: t("name") },
            { key: "reach", header: t("reach") },
            { key: "scope", header: t("building") },
            { key: "actions", header: <span className="sr-only">{t("actions")}</span> },
          ]}
          rows={contacts.map((contact) => ({
            key: contact.id,
            testId: "contact-row",
            cells: {
              name: (
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{contact.name}</span>
                  <Badge tone={contact.kind === "emergency" ? "danger" : "neutral"} size="sm">
                    {t(`kinds.${contact.kind}`)}
                  </Badge>
                </span>
              ),
              reach: (
                <span className="flex flex-col">
                  {contact.phone ? (
                    <a className="underline-offset-4 hover:underline" href={`tel:${contact.phone}`}>
                      {formatPhone(contact.phone)}
                    </a>
                  ) : null}
                  {contact.lineId ? <span className="text-muted">{t("line", { id: contact.lineId })}</span> : null}
                  {contact.notes ? <span className="text-muted text-xs">{contact.notes}</span> : null}
                </span>
              ),
              scope: buildingName(contact.buildingId),
              actions: canManage ? (
                <span className="flex justify-end gap-1">
                  <EditContact contact={contact} />
                  <RemoveContact contact={contact} />
                </span>
              ) : null,
            },
          }))}
        />
      )}
    </OwnerPage>
  );
}
