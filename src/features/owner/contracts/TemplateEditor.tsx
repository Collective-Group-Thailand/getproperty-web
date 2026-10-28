"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { TabPanel, Tabs } from "@/ui/components/Tabs";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { Icon } from "@/ui/icons";

import { DocumentButton } from "../shared/DocumentButton";
import { insertVariable, outline, textParts, variablesIn } from "./clauses";

type Detail = Schemas["ContractTemplateDetailDto"];
type Check = Schemas["ContractTemplateCheckDto"];
type View = "preview" | "diff" | "compliance";

const DIFF_TONE: Record<Schemas["ClauseStatus"], "neutral" | "warning" | "success" | "danger"> = {
  unchanged: "neutral",
  changed: "warning",
  added: "success",
  removed: "danger",
};

/**
 * The template editor (G3, D-294). The text is the API's Handlebars HTML; the console never renders it — the clause
 * list and the live preview are plain text parsed from what is typed, with `{{variables}}` marked. Saving
 * (`PATCH`) is where the API refuses unsafe HTML and unknown variables; the diff, the compliance check and the sample
 * PDF are the API's, of the saved draft. Publishing is refused in the สคบ. scope while a forbidden clause remains
 * (422 `compliance.forbidden_clause` with its legal reference); outside it the warnings stay on screen.
 */
export function TemplateEditor({
  detail,
  diff,
  canEdit,
}: {
  detail: Detail;
  diff: Schemas["ContractTemplateDiffDto"] | null;
  canEdit: boolean;
}) {
  const t = useTranslations("owner.contracts.editor");
  const c = useTranslations("owner.contracts");
  const [name, setName] = useState(detail.name);
  const [body, setBody] = useState(detail.bodyHtml);
  const [view, setView] = useState<View>("preview");
  const [check, setCheck] = useState<Check | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const save = useApiAction();
  const checking = useApiAction<Check>({ refresh: false });
  const dirty = body !== detail.bodyHtml || name.trim() !== detail.name;
  const clauses = useMemo(() => outline(body), [body]);
  const used = useMemo(() => variablesIn(body), [body]);
  const unknown = used.filter((name) => !detail.variables.includes(name));
  const draft = detail.current.state === "draft";
  const path = { templateId: detail.id };

  const insert = (variable: string) => {
    const element = area.current;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? body.length;
    const next = insertVariable(body, start, end, variable);
    setBody(next.text);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onSave = () =>
    save.run(() =>
      unwrap(
        browserApi().PATCH("/v1/owner/contract-templates/{templateId}", {
          params: { path },
          body: {
            ...(name.trim() !== detail.name ? { name: name.trim() } : {}),
            ...(body !== detail.bodyHtml ? { bodyHtml: body } : {}),
          },
        }),
      ).then((answer) => {
        setCheck(null);
        return answer;
      }),
    );

  const onCheck = () =>
    checking.run(
      () => unwrap(browserApi().POST("/v1/owner/contract-templates/{templateId}/actions/check", { params: { path } })),
      (result) => {
        setCheck(result);
        setView("compliance");
      },
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card as="section" aria-labelledby="template-text" data-testid="template-text">
          <CardHeader title={<span id="template-text">{t("textTitle")}</span>} description={t("textHint")} />
          <div className="flex flex-col gap-4">
            {canEdit ? (
              <Field label={t("name")} required>
                <Input
                  value={name}
                  maxLength={200}
                  onChange={(event) => setName(event.target.value)}
                  data-testid="template-name"
                />
              </Field>
            ) : null}
            <Field label={t("body")} hint={canEdit ? t("bodyHint") : undefined}>
              <Textarea
                ref={area}
                rows={16}
                value={body}
                readOnly={!canEdit}
                spellCheck={false}
                onChange={(event) => setBody(event.target.value)}
                className="font-mono text-sm"
                data-testid="template-body"
              />
            </Field>
            {canEdit && detail.current.state !== "draft" ? (
              <p className="text-muted text-sm">{t("nextDraft", { version: detail.current.version + 1 })}</p>
            ) : null}
            {dirty ? (
              <span data-testid="template-dirty">
                <Badge tone="warning" size="sm">
                  {t("unsaved")}
                </Badge>
              </span>
            ) : null}
            <ProblemNotice error={save.error} />
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={onSave} disabled={!dirty || save.busy} data-testid="template-save">
                  {save.busy ? t("saving") : t("save")}
                </Button>
                <Button
                  variant="secondary"
                  iconStart={IconShield}
                  onClick={onCheck}
                  disabled={dirty || checking.busy}
                  data-testid="template-check"
                >
                  {t("check")}
                </Button>
                <ConfirmAction
                  label={t("publish")}
                  icon={IconCheckCircle}
                  variant="secondary"
                  disabled={dirty || !draft}
                  testId="template-publish"
                  title={t("publishTitle")}
                  description={t("publishBody", {
                    version: c("versionLabel", {
                      language: c(`language.${detail.current.language}`),
                      version: detail.current.version,
                    }),
                  })}
                  confirmLabel={t("publish")}
                  successMessage={t("published")}
                  onConfirm={() =>
                    unwrap(
                      browserApi().POST("/v1/owner/contract-templates/{templateId}/actions/publish", {
                        params: { path },
                      }),
                    )
                  }
                  onDone={(result) => {
                    const published = result as Schemas["ContractTemplatePublishedDto"];
                    setCheck(published.check);
                    if (published.check.findings.length) setView("compliance");
                  }}
                />
              </div>
            ) : null}
            {canEdit && (dirty || !draft) ? (
              <p className="text-muted text-sm">{dirty ? t("saveFirst") : t("nothingToPublish")}</p>
            ) : null}
          </div>
        </Card>

        <aside className="flex flex-col gap-6">
          <Card as="section" aria-labelledby="template-variables" data-testid="template-variables">
            <CardHeader
              title={<span id="template-variables">{t("variables")}</span>}
              description={t("variablesHint")}
            />
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {detail.variables.map((variable) => {
                const isUsed = used.includes(variable);
                return (
                  <li key={variable}>
                    <button
                      type="button"
                      onClick={() => insert(variable)}
                      disabled={!canEdit}
                      className="hover:bg-bg-subtle rounded-control flex w-full items-center justify-between gap-2 px-2 py-1.5 text-start text-sm disabled:cursor-default disabled:hover:bg-transparent"
                      data-testid="template-variable"
                      data-variable={variable}
                      aria-label={canEdit ? t("insert", { variable }) : variable}
                    >
                      <code className="font-mono text-xs break-all">{variable}</code>
                      {isUsed ? (
                        <span className="text-success-subtle-fg flex items-center gap-1 text-xs">
                          <Icon icon={IconCheck} />
                          {t("used")}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {unknown.length ? (
              <div className="mt-3" data-testid="template-unknown">
                <Callout tone="warning" title={t("unknownTitle")}>
                  <p>{t("unknownBody")}</p>
                  <p className="font-mono text-xs">{unknown.join(", ")}</p>
                </Callout>
              </div>
            ) : null}
          </Card>

          <Card as="section" aria-labelledby="template-clauses" data-testid="template-clauses">
            <CardHeader title={<span id="template-clauses">{t("clauses")}</span>} />
            {clauses.length ? (
              <ol className="m-0 flex list-decimal flex-col gap-1 ps-5 text-sm">
                {clauses.map((clause, index) => (
                  <li key={`${clause.title}-${index}`} data-testid="template-clause">
                    <span className="font-medium">{clause.title || t("frame")}</span>
                    {clause.variables.length ? (
                      <span className="text-muted"> · {t("variableCount", { count: clause.variables.length })}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted text-sm">{t("noClauses")}</p>
            )}
          </Card>
        </aside>
      </div>

      <Tabs
        label={t("views")}
        value={view}
        onValueChange={(value) => setView(value as View)}
        tabs={[
          { value: "preview", label: t("preview") },
          { value: "diff", label: t("diff") },
          { value: "compliance", label: t("compliance") },
        ]}
      >
        <TabPanel value="preview" className="pt-4" data-testid="template-preview">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted text-sm">{t("previewHint")}</p>
              <DocumentButton
                document={{ kind: "contractTemplatePreview", id: detail.id }}
                label={t("previewPdf")}
                title={t("previewPdfTitle", { name: detail.name })}
                testId="template-preview-pdf"
              />
            </div>
            <div className="flex flex-col gap-4" lang={detail.current.language}>
              {clauses.map((clause, index) => (
                <section key={`${clause.title}-${index}`} className="flex flex-col gap-1">
                  {clause.title ? <h3 className="font-semibold">{clause.title}</h3> : null}
                  <p className="text-sm leading-relaxed">
                    {textParts(clause.text).map((part, n) =>
                      part.kind === "variable" ? (
                        <code
                          key={n}
                          className="bg-primary-subtle text-primary-subtle-fg rounded px-1 font-mono text-xs"
                          data-testid="preview-variable"
                        >
                          {part.value}
                        </code>
                      ) : (
                        <span key={n}>{part.value}</span>
                      ),
                    )}
                  </p>
                </section>
              ))}
            </div>
          </Card>
        </TabPanel>

        <TabPanel value="diff" className="pt-4" data-testid="template-diff">
          <Card>
            {dirty ? <p className="text-muted mb-3 text-sm">{t("diffSaved")}</p> : null}
            {!diff ? (
              <p className="text-muted text-sm">{t("diffUnavailable")}</p>
            ) : !diff.baseVersionId ? (
              <p className="text-muted text-sm">{t("diffNoBase")}</p>
            ) : (
              <>
                <p className="text-muted mb-3 text-sm" data-testid="diff-summary">
                  {t("diffSummary", {
                    changed: diff.clauses.filter((clause) => clause.status !== "unchanged").length,
                    total: diff.clauses.length,
                  })}
                </p>
                <div className="hidden gap-4 pb-2 text-sm font-semibold md:grid md:grid-cols-2">
                  <span>{t("diffBase")}</span>
                  <span>{t("diffMine")}</span>
                </div>
                <ul className="divide-border m-0 list-none divide-y p-0">
                  {diff.clauses.map((clause) => (
                    <li
                      key={clause.key}
                      className="flex flex-col gap-2 py-3"
                      data-testid="diff-clause"
                      data-status={clause.status}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{clause.title || t("frame")}</span>
                        <Badge tone={DIFF_TONE[clause.status]} size="sm">
                          {t(`diffStatus.${clause.status}`)}
                        </Badge>
                      </span>
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <p className={clause.status === "added" ? "text-muted italic" : "bg-bg-subtle rounded p-2"}>
                          <span className="sr-only">{t("diffBase")}: </span>
                          {clause.baseText ?? t("diffNone")}
                        </p>
                        <p
                          className={
                            clause.status === "removed"
                              ? "text-muted italic"
                              : clause.status === "unchanged"
                                ? "bg-bg-subtle rounded p-2"
                                : "bg-primary-subtle rounded p-2"
                          }
                        >
                          <span className="sr-only">{t("diffMine")}: </span>
                          {clause.text ?? t("diffNone")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="compliance" className="pt-4" data-testid="template-compliance">
          <Card>
            <ProblemNotice error={checking.error} />
            {check ? (
              <CompliancePanel check={check} />
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-muted text-sm">{canEdit ? t("checkHint") : t("checkReadOnly")}</p>
                {canEdit ? (
                  <Button
                    variant="secondary"
                    iconStart={IconShield}
                    onClick={onCheck}
                    disabled={dirty || checking.busy}
                  >
                    {t("check")}
                  </Button>
                ) : null}
              </div>
            )}
            <p className="text-muted mt-4 text-xs">{t("checkNote")}</p>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
}

/** The API's check (D-020, D-158): in / out of scope, findings blocked or warned with their legal reference. */
function CompliancePanel({ check }: { check: Check }) {
  const t = useTranslations("owner.contracts.compliance");
  const root = useTranslations("owner.contracts");
  const clean = !check.findings.length && !check.problems.length && !check.unknownVariables.length;
  return (
    <div className="flex flex-col gap-4" data-testid="compliance-result" data-publishable={String(check.publishable)}>
      <Callout tone="info" title={check.inScope ? t("inScopeTitle") : t("outOfScopeTitle")}>
        {check.inScope ? t("inScopeBody") : t("outOfScopeBody")}
      </Callout>
      {clean ? (
        <Callout tone="success" title={t("cleanTitle")}>
          {t("cleanBody")}
        </Callout>
      ) : null}
      {check.findings.length ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {check.findings.map((finding, index) => (
            <li
              key={`${finding.clauseKey}-${finding.clauseType}-${index}`}
              data-testid="compliance-finding"
              data-severity={finding.severity}
            >
              <Callout
                tone={finding.severity === "block" ? "danger" : "warning"}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={finding.severity === "block" ? "danger" : "warning"} size="sm">
                      {t(`severity.${finding.severity}`)}
                    </Badge>
                    <span>{finding.clauseTitle || t("frame")}</span>
                  </span>
                }
                legalRef={finding.legalRef}
              >
                <p>
                  {t(`source.${finding.source}`)}
                  {" — "}
                  {t.has(`type.${finding.clauseType}`) ? t(`type.${finding.clauseType}`) : finding.clauseType}
                </p>
                <p className="mt-1 italic">{root("quote", { text: finding.excerpt })}</p>
              </Callout>
            </li>
          ))}
        </ul>
      ) : null}
      {check.problems.length ? (
        <Callout tone="danger" title={t("problemsTitle")}>
          <ul className="list-disc ps-5">
            {check.problems.map((problem) => (
              <li key={`${problem.path}-${problem.code}`}>{problem.message}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {check.unknownVariables.length ? (
        <Callout tone="danger" title={t("unknownTitle")}>
          <p className="font-mono text-xs">{check.unknownVariables.join(", ")}</p>
        </Callout>
      ) : null}
      <p className="text-sm font-medium" data-testid="compliance-verdict">
        {check.publishable ? t("publishable") : t("notPublishable")}
      </p>
    </div>
  );
}
