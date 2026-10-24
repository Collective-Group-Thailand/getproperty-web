import { headers } from "next/headers";

import { jsonLd, type JsonLd } from "./structured-data";

/** Structured data for a page, carrying the request's CSP nonce. */
export async function JsonLdScript({ graphs }: { graphs: JsonLd[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd(...graphs) }} />;
}
