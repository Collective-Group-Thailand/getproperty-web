"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import type { FieldMember } from "../shared/members";

export type AssigneeKind = "user" | "party" | "none";

/**
 * Who does the work (D-072, D-154): a member who handles service requests in the building — they work in the
 * staff PWA — or an external technician **party** (they work in getproperty-liff with LINE or SMS sign-in).
 * The choice is sent as `assigneeUserId` / `assigneePartyId` form fields; the API checks the permission
 * and refuses anyone else (422).
 */
export function AssigneeFields({
  members,
  initial,
  allowNone = true,
  errors = {},
}: {
  members: FieldMember[];
  initial?: { kind: AssigneeKind; id?: string | null; name?: string | null };
  allowNone?: boolean;
  errors?: Record<string, string>;
}) {
  const t = useTranslations("owner.service.assignee");
  const [kind, setKind] = useState<AssigneeKind>(initial?.kind ?? (allowNone ? "none" : "user"));
  const [userId, setUserId] = useState(initial?.kind === "user" ? (initial.id ?? "") : "");
  const [partyId, setPartyId] = useState(initial?.kind === "party" ? (initial.id ?? "") : "");
  const [q, setQ] = useState("");
  const [parties, setParties] = useState<Pick<Schemas["PartyDto"], "id" | "displayName" | "phone">[]>(
    initial?.kind === "party" && initial.id ? [{ id: initial.id, displayName: initial.name ?? "", phone: null }] : [],
  );

  useEffect(() => {
    if (kind !== "party" || q.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      void unwrap(browserApi().GET("/v1/owner/parties", { params: { query: { q: q.trim(), perPage: 20 } } }))
        .then((page) => setParties(page.data))
        .catch(() => setParties([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [kind, q]);

  const options: { value: AssigneeKind; label: string }[] = [
    ...(allowNone ? [{ value: "none" as const, label: t("none") }] : []),
    { value: "user", label: t("staff") },
    { value: "party", label: t("technician") },
  ];

  return (
    <div className="flex flex-col gap-3" data-testid="assignee-fields">
      <input type="hidden" name="assigneeUserId" value={kind === "user" ? userId : ""} />
      <input type="hidden" name="assigneePartyId" value={kind === "party" ? partyId : ""} />
      <SegmentedControl
        label={t("label")}
        value={kind}
        onValueChange={(value) => setKind(value as AssigneeKind)}
        options={options}
      />
      {kind === "user" ? (
        <Field label={t("member")} hint={t("memberHint")} error={errors.assigneeUserId}>
          <NativeSelect
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder={t("choose")}
            options={members.map((member) => ({
              value: member.userId,
              label: `${member.displayName} · ${t(`role.${member.role}`)}`,
            }))}
            data-testid="assignee-member"
          />
        </Field>
      ) : null}
      {kind === "party" ? (
        <>
          <Field label={t("search")} hint={t("searchHint")}>
            <Input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              data-testid="assignee-search"
            />
          </Field>
          <Field label={t("party")} hint={t("partyHint")} error={errors.assigneePartyId}>
            <NativeSelect
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
              placeholder={parties.length ? t("choose") : t("noParty")}
              options={parties.map((party) => ({
                value: party.id,
                label: party.phone ? `${party.displayName} · ${party.phone}` : party.displayName,
              }))}
              data-testid="assignee-party"
            />
          </Field>
        </>
      ) : null}
    </div>
  );
}

/** The schedule of a visit as two `datetime-local` fields (Bangkok wall time). */
export function VisitWindowFields({
  from,
  until,
  errors = {},
}: {
  from?: string;
  until?: string;
  errors?: Record<string, string>;
}) {
  const t = useTranslations("owner.service.assignee");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("scheduledAt")} hint={t("bangkokTime")} error={errors.scheduledAt}>
        <Input type="datetime-local" name="scheduledAt" defaultValue={from} data-testid="scheduled-at" />
      </Field>
      <Field label={t("scheduledUntil")} error={errors.scheduledUntil}>
        <Input type="datetime-local" name="scheduledUntil" defaultValue={until} data-testid="scheduled-until" />
      </Field>
    </div>
  );
}
