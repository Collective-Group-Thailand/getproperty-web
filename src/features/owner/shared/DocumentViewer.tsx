"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { PdfFrame } from "@/features/shared/documents/PdfFrame";
import { Button } from "@/ui/components/Button";
import { Spinner } from "@/ui/components/Spinner";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconExternal } from "@/ui/icons/glyphs/external";

import { resolveDocument, type DocumentRef, type ResolvedDocument } from "./documents";
import { ProblemNotice } from "./useApiAction";

/** The PDF viewer of the owner console (lazy chunk of `DocumentButton`). */
export function DocumentViewer({ document, title }: { document: DocumentRef; title: string }) {
  const t = useTranslations("owner.common.document");
  const [resolved, setResolved] = useState<ResolvedDocument | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    resolveDocument(document)
      .then((answer) => !cancelled && setResolved(answer))
      .catch((failure: unknown) => !cancelled && setError(failure));
    return () => {
      cancelled = true;
    };
  }, [document]);

  if (error) return <ProblemNotice error={error} />;
  if (!resolved) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner label={t("loading")} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="document-viewer" data-url={resolved.url}>
      <PdfFrame url={resolved.url} title={title} failedText={t("inlineFailed")} loadingText={t("loading")} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="secondary" size="sm" iconStart={IconExternal}>
          <a href={resolved.url} target="_blank" rel="noopener noreferrer">
            {t("openTab")}
          </a>
        </Button>
        <Button asChild variant="primary" size="sm" iconStart={IconDownload}>
          <a href={resolved.url} download={resolved.number ?? true}>
            {t("download")}
          </a>
        </Button>
      </div>
    </div>
  );
}
