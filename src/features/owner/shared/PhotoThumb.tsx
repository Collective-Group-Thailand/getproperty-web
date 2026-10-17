"use client";

import { useTranslations } from "next-intl";
import { Suspense, useEffect, useRef, useState } from "react";

import type { Schemas } from "@/lib/api/types";
import { LazyDialog } from "@/ui/components/overlays";
import { lazyWarm } from "@/ui/lib/lazy";
import { cn } from "@/ui/lib/cn";

const ImageViewer = lazyWarm(() => import("@/ui/components/ImageViewer").then((module) => module.ImageViewer));

/** `GET /v1/owner/files/{fileId}` through the BFF, with a plain typed `fetch` (no API client on list pages). */
async function signed(fileId: string, purpose?: string): Promise<Schemas["FileDownloadDto"]> {
  const query = purpose ? `?purpose=${encodeURIComponent(purpose)}` : "";
  const response = await fetch(`/bff/v1/owner/files/${encodeURIComponent(fileId)}${query}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`file ${response.status}`);
  return (await response.json()) as Schemas["FileDownloadDto"];
}

/**
 * Evidence photo by document id (design-system.md §1 "show the evidence"): meter photos on invoice
 * lines and readings, inspection photos in the settlement comparison, deduction evidence. The signed
 * URL (5 minutes) is asked for when the thumbnail scrolls into view; a click opens it full size with
 * zoom. A photo that cannot be shown (still being scanned, offline) leaves an empty frame.
 */
export function PhotoThumb({
  fileId,
  alt,
  purpose,
  size = "md",
  className,
}: {
  fileId: string;
  alt: string;
  purpose?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("owner.common.photo");
  const ref = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<Schemas["FileDownloadDto"] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const load = () =>
      signed(fileId, purpose)
        .then((answer) => !cancelled && setFile(answer))
        .catch(() => !cancelled && setFailed(true));
    if (typeof IntersectionObserver === "undefined") {
      void load();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        void load();
      }
    });
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [fileId, purpose]);

  const box = size === "sm" ? "size-12" : size === "lg" ? "aspect-[4/3] w-full" : "size-20";
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => file && setOpen(true)}
        disabled={!file}
        aria-label={t("open", { alt })}
        className={cn("rounded-control bg-bg-subtle block shrink-0 overflow-hidden", box, className)}
        data-testid="photo-thumb"
        data-file={fileId}
      >
        {file && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed storage URL, not an optimisable asset
          <img
            src={file.thumbnailUrl ?? file.url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : null}
      </button>
      {file ? (
        <LazyDialog open={open} onOpenChange={setOpen} title={alt} size="lg" closeLabel={t("close")}>
          <Suspense fallback={null}>
            <ImageViewer
              src={file.url}
              alt={alt}
              labels={{ zoomIn: t("zoomIn"), zoomOut: t("zoomOut"), zoom: (percent) => t("zoom", { percent }) }}
              data-testid="photo-viewer"
            />
          </Suspense>
        </LazyDialog>
      ) : null}
    </>
  );
}
