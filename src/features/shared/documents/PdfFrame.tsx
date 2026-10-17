"use client";

import { useEffect, useState } from "react";

import { Spinner } from "@/ui/components/Spinner";

/**
 * A PDF from a signed URL (or a same-origin BFF path) shown in the browser's own viewer: the bytes are
 * fetched and framed from a `blob:` URL — the only frame source the owner CSP allows — so no PDF
 * library ships to the console (D-179) and no other origin is framed. When the bytes cannot be read
 * (storage without CORS, offline) the caller's "open" and "download" links still work.
 */
export function PdfFrame({
  url,
  title,
  failedText,
  loadingText,
}: {
  url: string;
  title: string;
  failedText: string;
  loadingText: string;
}) {
  const [state, setState] = useState<{ src: string | null; failed: boolean }>({ src: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(
          blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }),
        );
        if (!cancelled) setState({ src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (state.failed) {
    return (
      <p className="text-muted rounded-card border-border border border-dashed p-6 text-center text-sm" role="status">
        {failedText}
      </p>
    );
  }
  if (!state.src) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label={loadingText} />
      </div>
    );
  }
  return (
    <iframe
      src={state.src}
      title={title}
      className="border-border h-[70vh] w-full rounded-md border"
      data-testid="pdf-frame"
    />
  );
}
