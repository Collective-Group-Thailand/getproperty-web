"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { LISTING_VERIFICATION_STATUS } from "@/domain/status/listing";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { uploadOwnerFile } from "../shared/upload";

type Kind = Schemas["OwnershipEvidence"];
const KINDS: Kind[] = ["condo_title", "title_deed", "sale_contract"];

/**
 * Owner verification of the listing's unit (F6.2, D-252): the badge when verified, the review state while Support
 * checks it, otherwise a short form — which document, the files (up to five; deleted after the review, O-018).
 */
export function VerificationCard({
  unitId,
  verification,
}: {
  unitId: string;
  verification: Schemas["UnitVerificationDto"];
}) {
  const t = useTranslations("owner.listings.verification");
  const action = useApiAction();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("condo_title");
  const [files, setFiles] = useState<File[]>([]);
  const latest = verification.latest;

  if (verification.verified)
    return (
      <Callout tone="success" icon={IconShield} title={t("verified")}>
        {t("verifiedBody")}
      </Callout>
    );
  if (latest?.state === "pending")
    return (
      <div className="flex items-center gap-3" data-testid="verification-pending">
        <StatusBadgeOf map={LISTING_VERIFICATION_STATUS} value="pending" />
        <span className="text-muted text-sm">{t("pending")}</span>
      </div>
    );

  const submit = () =>
    action.run(async () => {
      const ids: string[] = [];
      for (const file of files)
        ids.push((await uploadOwnerFile(file, { kind: "certificate", scopeType: "unit", scopeId: unitId })).id);
      return unwrap(
        browserApi().POST("/v1/owner/units/{unitId}/verification", {
          params: { path: { unitId } },
          body: { evidenceKind: kind, documentIds: ids },
        }),
      );
    });

  return (
    <div className="flex flex-col gap-4" data-testid="verification-form">
      {latest?.state === "rejected" ? (
        <Callout tone="warning">{t("rejected", { note: latest.decisionNote ?? "" })}</Callout>
      ) : null}
      <Field label={t("evidenceKind")}>
        <NativeSelect
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
          options={KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("files")}</span>
        <p className="text-muted text-sm">{t("filesHint")}</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          className="sr-only"
          onChange={(event) => setFiles([...(event.target.files ?? [])].slice(0, 5))}
          data-testid="verification-files"
          aria-label={t("files")}
          tabIndex={-1}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" iconStart={IconUpload} onClick={() => input.current?.click()}>
            {t("chooseFiles")}
          </Button>
          <span className="text-muted text-sm">{files.map((f) => f.name).join(", ")}</span>
        </div>
      </div>
      <ProblemNotice error={action.error} />
      <div>
        <Button onClick={submit} loading={action.busy} disabled={files.length === 0} data-testid="verification-submit">
          {t("submit")}
        </Button>
      </div>
    </div>
  );
}
