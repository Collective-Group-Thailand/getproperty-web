"use client";

import { useState } from "react";

import { ProblemNotice } from "@/features/shared/console/useApiAction";
import { Button, type ButtonProps } from "@/ui/components/Button";

import { openDetachedTab, platformFileLink } from "./files";

/**
 * Opens a platform file (a tariff notice, a DSR export) in a new tab through a 5-minute signed link the API
 * issues on click (`GET /v1/admin/files/{fileId}`) — the link is never kept on the page. While the virus scan
 * runs the API answers 409 and the problem is shown.
 */
export function PlatformFileButton({
  fileId,
  label,
  testId,
  size = "sm",
}: {
  fileId: string;
  label: string;
  testId?: string;
  size?: ButtonProps["size"];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        variant="link"
        size={size}
        className="h-auto px-0"
        loading={busy}
        data-testid={testId}
        onClick={async () => {
          setBusy(true);
          setError(null);
          // Opened before the await so the browser keeps it as the click's own window (no popup block). Not with
          // the "noopener" feature — `window.open` then returns null by spec and this tab would navigate away
          // (review L5) — but the new tab's `opener` is cut by hand before it loads anything.
          const opened = openDetachedTab();
          try {
            const link = await platformFileLink(fileId);
            if (opened) opened.location.replace(link.url);
            else window.location.assign(link.url); // popups blocked: the file opens here instead
          } catch (failure) {
            opened?.close();
            setError(failure);
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      <ProblemNotice error={error} />
    </span>
  );
}
