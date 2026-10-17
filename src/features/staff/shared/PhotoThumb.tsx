"use client";

import { useEffect, useRef, useState } from "react";

import type { Schemas } from "@/lib/api/types";
import { cn } from "@/ui/lib/cn";

/**
 * `GET /v1/staff/files/{fileId}` through the BFF with a plain `fetch` (typed by the contract): the round
 * list ships no API client until a capture is opened (D-179).
 */
async function signedUrl(fileId: string): Promise<string> {
  const response = await fetch(`/bff/v1/staff/files/${encodeURIComponent(fileId)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`file ${response.status}`);
  const file = (await response.json()) as Schemas["FileDownloadDto"];
  return file.thumbnailUrl ?? file.url;
}

/**
 * Evidence photo by document id (D-035 "show the evidence"): the signed URL is asked for when the
 * thumbnail scrolls into view (`GET /v1/staff/files/{id}`, 5 minutes), so a round of 100 meters does
 * not sign 100 URLs up front. A photo that cannot be shown (offline, still scanning) leaves the space
 * empty rather than breaking the card.
 */
export function PhotoThumb({
  fileId,
  alt,
  className,
  size = "md",
}: {
  fileId: string;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const load = () =>
      signedUrl(fileId)
        .then((signed) => !cancelled && setUrl(signed))
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
  }, [fileId]);

  const box = size === "sm" ? "size-14" : size === "lg" ? "aspect-[4/3] w-full" : "size-20";
  return (
    <span ref={ref} className={cn("rounded-control bg-bg-subtle block shrink-0 overflow-hidden", box, className)}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed storage URL, not an optimisable asset
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : null}
    </span>
  );
}
