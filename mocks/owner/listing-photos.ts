// Seeded listing photos (mocks/owner/listings.ts `seedPhotos`) stand for real rooms: the mock's object storage serves
// them as photographs (the same Unsplash pictures the public listings use, fetched once and kept in memory) so the
// owner's listing cards and editor look like the product will with real uploads. Any other file keeps the generic
// placeholder of `readUpload`. Mock only — production serves the owner's own uploads from object storage.

const PREFIX = "9e5c3d2b-0000-4000-8000-0000000b";

/** Unsplash photo ids per seeded listing (`b1…`, `b2…`, `b3…`), in the order the listing shows them. */
const SETS: Record<string, string[]> = {
  "1": [
    "1630699375019-c334927264df",
    "1665249934445-1de680641f50",
    "1630699144641-72fa7a6b8aa1",
    "1629307015909-5fa16cb14a70",
    "1649068559107-e5d936141e44",
    "1775027687637-6d09c3297137",
  ],
  "2": [
    "1738168246881-40f35f8aba0a",
    "1652882860938-f90aa298e644",
    "1630699144641-72fa7a6b8aa1",
    "1649068559107-e5d936141e44",
    "1629307015909-5fa16cb14a70",
  ],
  "3": [
    "1652882860938-f90aa298e644",
    "1649068559107-e5d936141e44",
    "1630699375019-c334927264df",
    "1665249934445-1de680641f50",
    "1738168246881-40f35f8aba0a",
  ],
};

/** `9e5c3d2b-…0b10d3` → the Unsplash URL of listing 1's fourth photo; null for any other file. */
export function listingPhotoSource(fileId: string): string | null {
  if (!fileId.startsWith(PREFIX)) return null;
  const match = /^(\d)0d(\d)$/.exec(fileId.slice(PREFIX.length));
  if (!match) return null;
  const id = SETS[match[1]!]?.[Number(match[2])];
  return id ? `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=75` : null;
}

const cache = new Map<string, Promise<Uint8Array | null>>();

/** The photo's bytes (cached for the life of the mock), or null when it cannot be fetched (offline runs). */
export function listingPhotoBytes(fileId: string): Promise<Uint8Array | null> | null {
  const source = listingPhotoSource(fileId);
  if (!source) return null;
  let pending = cache.get(source);
  if (!pending) {
    pending = fetch(source, { signal: AbortSignal.timeout(8000) })
      .then(async (response) => (response.ok ? new Uint8Array(await response.arrayBuffer()) : null))
      .catch(() => null);
    cache.set(source, pending);
  }
  return pending;
}
