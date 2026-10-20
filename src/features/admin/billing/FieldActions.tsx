"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { bangkokInstant } from "@/features/shared/console/SettingEditor";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";

export interface Assignee {
  id: string;
  name: string;
}

/**
 * A platform install / de-install order's next steps (D-081, D-205): assign a field engineer, start,
 * tick the items installed, complete (the API refuses while items are open), cancel.
 */
export function InstallOrderActions({
  order,
  assignees,
}: {
  order: Schemas["InstallOrderDto"];
  assignees: Assignee[];
}) {
  const t = useTranslations("admin.billing.field");
  const [assignee, setAssignee] = useState(order.assignedTo ?? assignees[0]?.id ?? "");
  const [items, setItems] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const act = (action: Schemas["InstallOrderAction"], payload: Schemas["InstallOrderActionDto"]) =>
    unwrap(
      browserApi().POST("/v1/admin/install-orders/{orderId}/actions/{action}", {
        params: { path: { orderId: order.id, action } },
        body: payload,
      }),
    );
  return (
    <div className="flex flex-wrap gap-1">
      {order.nextActions.map((action) => (
        <ConfirmAction
          key={action}
          label={t(`orderAction.${action}`)}
          size="sm"
          variant={action === "cancel" ? "secondary" : "primary"}
          tone={action === "cancel" ? "destructive" : "primary"}
          testId={`order-${action}`}
          title={t(`orderActionTitle.${action}`, { building: order.buildingName })}
          description={t("orderActionBody", { building: order.buildingName, count: order.items.length })}
          confirmLabel={t(`orderAction.${action}`)}
          ready={action !== "assign" || assignee !== ""}
          onConfirm={() =>
            act(action as Schemas["InstallOrderAction"], {
              assignedTo: action === "assign" ? assignee : undefined,
              itemIndexes: action === "complete-items" ? items : undefined,
              note: note.trim() || null,
            })
          }
          successMessage={t("orderMoved")}
        >
          {action === "assign" ? (
            <Field label={t("assignee")} required>
              <NativeSelect
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                options={assignees.map((a) => ({ value: a.id, label: a.name }))}
              />
            </Field>
          ) : null}
          {action === "complete-items" ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-medium">{t("itemsDone")}</legend>
              {order.items.map((item, index) =>
                item.done ? null : (
                  <Checkbox
                    key={`${item.deviceKind}-${index}`}
                    label={t("itemLabel", { kind: item.deviceKind, index: index + 1 })}
                    checked={items.includes(index)}
                    onCheckedChange={(checked) =>
                      setItems(checked === true ? [...items, index] : items.filter((value) => value !== index))
                    }
                  />
                ),
              )}
            </fieldset>
          ) : null}
          <Field label={t("note")}>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </ConfirmAction>
      ))}
    </div>
  );
}

/**
 * A site survey for an upgrade to Smart (D-156, D-205): schedule (when, who), complete with the
 * findings — opening the install order by default — or cancel.
 */
export function SiteSurveyActions({ survey, assignees }: { survey: Schemas["SiteSurveyDto"]; assignees: Assignee[] }) {
  const t = useTranslations("admin.billing.field");
  const [when, setWhen] = useState("");
  const [assignee, setAssignee] = useState(survey.assignedTo ?? assignees[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [install, setInstall] = useState(true);
  const open = survey.state === "requested" || survey.state === "scheduled";
  if (!open) return null;
  const act = (action: Schemas["SiteSurveyAction"], payload: Schemas["SiteSurveyActionDto"]) =>
    unwrap(
      browserApi().POST("/v1/admin/site-surveys/{surveyId}/actions/{action}", {
        params: { path: { surveyId: survey.id, action } },
        body: payload,
      }),
    );
  return (
    <div className="flex flex-wrap gap-1">
      <ConfirmAction
        label={t("surveyAction.schedule")}
        size="sm"
        variant="secondary"
        testId="survey-schedule"
        title={t("surveyActionTitle.schedule")}
        description={t("surveyBody", { plan: survey.targetPlanKey })}
        confirmLabel={t("surveyAction.schedule")}
        ready={when !== ""}
        onConfirm={() =>
          act("schedule", {
            scheduledFor: bangkokInstant(when) ?? null,
            assignedTo: assignee || null,
            notes: notes.trim() || null,
          })
        }
        successMessage={t("surveyMoved")}
      >
        <Field label={t("scheduledFor")} required>
          <Input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            data-testid="survey-when"
          />
        </Field>
        <Field label={t("assignee")}>
          <NativeSelect
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            options={assignees.map((a) => ({ value: a.id, label: a.name }))}
            placeholder={t("nobody")}
          />
        </Field>
      </ConfirmAction>
      <ConfirmAction
        label={t("surveyAction.complete")}
        size="sm"
        testId="survey-complete"
        title={t("surveyActionTitle.complete")}
        description={t("surveyBody", { plan: survey.targetPlanKey })}
        confirmLabel={t("surveyAction.complete")}
        ready={notes.trim() !== ""}
        onConfirm={() => act("complete", { findings: { summary: notes.trim() }, notes: notes.trim(), install })}
        successMessage={t("surveyMoved")}
      >
        <Field label={t("findings")} required>
          <Textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            data-testid="survey-findings"
          />
        </Field>
        <Checkbox
          label={t("openInstall")}
          checked={install}
          onCheckedChange={(checked) => setInstall(checked === true)}
        />
      </ConfirmAction>
      <ConfirmAction
        label={t("surveyAction.cancel")}
        size="sm"
        variant="secondary"
        tone="destructive"
        testId="survey-cancel"
        title={t("surveyActionTitle.cancel")}
        description={t("surveyBody", { plan: survey.targetPlanKey })}
        confirmLabel={t("surveyAction.cancel")}
        onConfirm={() => act("cancel", { notes: notes.trim() || null })}
        successMessage={t("surveyMoved")}
      />
    </div>
  );
}
