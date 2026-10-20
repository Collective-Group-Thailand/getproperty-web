import "server-only";

import { toString } from "qrcode";

/**
 * A Thai QR (EMVCo payload from the API) drawn on the server as an SVG image — no client JavaScript,
 * and the payload is shown exactly as the API issued it (never assembled here).
 */
export async function QrImage({ payload, label, size = 192 }: { payload: string; label: string; size?: number }) {
  const svg = await toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URI, nothing to optimise
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={label}
      width={size}
      height={size}
      className="rounded-control border-border border bg-white p-2"
      data-testid="qr-image"
    />
  );
}
