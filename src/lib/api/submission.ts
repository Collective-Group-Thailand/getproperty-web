/**
 * One logical action = one Idempotency-Key with **one** body (contract §3, review M1). The API fingerprints the
 * body per key: a retry after a lost answer must send exactly the first body again to get the recorded result back,
 * and a changed body with the same key is `422 idempotency.key_reused`. So a wizard that retries must not re-upload
 * its photos (new document ids) or stamp a new `installedAt`.
 *
 * `FrozenSubmission.prepare(draft, build)` builds the body once for a draft (what the user entered, photos by
 * identity) and hands the same key and the same body back for as long as the draft is unchanged; a changed draft is
 * a new submission with a new key and a freshly built body. `PhotoUploads` uploads each captured photo once, so even
 * a changed submission reuses the document of an unchanged photo.
 */

export interface PreparedSubmission<B> {
  key: string;
  body: B;
  /** True when this is a retry of the previous submission (same key, same body). */
  reused: boolean;
}

/** Deterministic JSON (sorted keys) — the identity of a draft. */
export function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : item,
  );
}

const identities = new WeakMap<object, string>();

/** A stable id for an object (a captured `File`) for as long as it lives: the same photo, the same id. */
export function objectIdentity(value: object | null | undefined): string | null {
  if (!value) return null;
  let id = identities.get(value);
  if (!id) {
    id = crypto.randomUUID();
    identities.set(value, id);
  }
  return id;
}

export class FrozenSubmission<B> {
  private current: { draft: string; key: string; body: B } | undefined;
  private building: { draft: string; promise: Promise<PreparedSubmission<B>> } | undefined;

  /**
   * The key and body for `draft`: the previous ones when the draft is unchanged, else a new key and `build()`'s
   * body (built once — a failed build, e.g. an upload without signal, leaves nothing behind).
   */
  async prepare(draft: unknown, build: () => B | Promise<B>): Promise<PreparedSubmission<B>> {
    const id = fingerprint(draft);
    if (this.current?.draft === id) return { key: this.current.key, body: this.current.body, reused: true };
    if (this.building?.draft === id) return this.building.promise;
    const promise = (async () => {
      const body = await build();
      this.current = { draft: id, key: crypto.randomUUID(), body };
      return { key: this.current.key, body, reused: false };
    })();
    this.building = { draft: id, promise };
    try {
      return await promise;
    } finally {
      if (this.building?.promise === promise) this.building = undefined;
    }
  }

  /** Forget the submission (after `idempotency.key_reused`: the key is spent on another body). */
  forget(): void {
    this.current = undefined;
  }

  /** The key of the submission in flight or last sent, if any (tests, diagnostics). */
  get key(): string | undefined {
    return this.current?.key;
  }
}

/** Uploads each photo (by object identity) once; a failed upload is forgotten so the next attempt tries again. */
export class PhotoUploads {
  private readonly done = new WeakMap<Blob, Promise<string>>();

  upload(photo: Blob, run: () => Promise<string>): Promise<string> {
    const existing = this.done.get(photo);
    if (existing) return existing;
    const promise = run();
    this.done.set(photo, promise);
    promise.catch(() => {
      if (this.done.get(photo) === promise) this.done.delete(photo);
    });
    return promise;
  }
}
