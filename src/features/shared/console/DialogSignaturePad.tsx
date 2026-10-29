"use client";

import { useEffect, useRef } from "react";

import { SignaturePad, type SignaturePadProps } from "@/ui/components/SignaturePad";

/**
 * A SignaturePad inside a dialog whose parent keeps the signature in state (review L1): the pad starts empty each
 * time the dialog opens, so the parent's state is cleared on mount and again on unmount (close), and a PNG still
 * being encoded when the dialog closes is dropped. Without this, reopening the dialog showed an empty pad while the
 * earlier drawing was still "ready" and would have been submitted.
 */
export function DialogSignaturePad({ onChange, ...props }: SignaturePadProps) {
  const live = useRef(false);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    live.current = true;
    latest.current(null);
    return () => {
      live.current = false;
      latest.current(null);
    };
  }, []);
  return <SignaturePad {...props} onChange={(png) => live.current && latest.current(png)} />;
}
