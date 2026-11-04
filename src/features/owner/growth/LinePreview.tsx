import { useTranslations } from "next-intl";

import { PhotoPlaceholder } from "@/ui/components/PhotoPlaceholder";
import { Icon } from "@/ui/icons";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

export interface PreviewListing {
  id: string;
  title: string;
  /** Formatted rent ("฿15,000"). */
  rent: string;
  place: string | null;
  /** The listing's cover (signed URL), when it has one. */
  photo: string | null;
}

/**
 * What a recipient sees in LINE (G5): the sponsored label, then one card per chosen listing — its cover, title, rent
 * and place, and the button that opens the listing — drawn from the listings' own facts as the builder changes. A
 * picture of the message, not the message: LINE renders the real one. Works in server and client components.
 */
export function LinePreview({ listings }: { listings: PreviewListing[] }) {
  const t = useTranslations("owner.broadcast.preview");
  return (
    <section
      aria-labelledby="line-preview"
      className="rounded-card border-border bg-surface shadow-card flex flex-col border"
      data-testid="line-preview"
    >
      <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id="line-preview" className="text-base font-semibold">
          {t("title")}
        </h2>
        <span className="text-muted text-xs">{t("note")}</span>
      </header>
      <div className="bg-bg-subtle flex flex-col gap-2 p-4">
        <p className="text-muted m-0 flex items-center gap-1.5 text-xs">
          <Icon icon={IconMegaphone} />
          {t("sponsored")}
        </p>
        {listings.length === 0 ? (
          <p className="text-muted rounded-control border-border-strong m-0 border border-dashed px-4 py-8 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <ul className="relative m-0 flex snap-x list-none gap-2 overflow-x-auto p-0 pb-1">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="rounded-card border-border bg-surface w-56 shrink-0 snap-start overflow-hidden border"
              >
                {listing.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed object-storage preview
                  <img src={listing.photo} alt="" className="bg-bg-subtle aspect-[16/10] w-full object-cover" />
                ) : (
                  <PhotoPlaceholder className="aspect-[16/10] w-full border-0" />
                )}
                <div className="flex flex-col gap-1 p-3">
                  <p className="m-0 line-clamp-2 text-sm leading-snug font-semibold">{listing.title}</p>
                  <p className="m-0 text-sm font-semibold tabular-nums">{t("rent", { rent: listing.rent })}</p>
                  {listing.place ? <p className="text-muted m-0 truncate text-xs">{listing.place}</p> : null}
                  <span className="rounded-control border-border text-primary mt-2 grid h-9 place-items-center border text-sm font-medium">
                    {t("open")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
