"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconLink } from "@/ui/icons/glyphs/link";

type Kit = Schemas["ShareKitDto"];
type Link = Schemas["ShareKitLinkDto"];

/**
 * The share kit of a published listing (D-268): the square photo card to download, then one row per channel with its
 * own short link and the caption to paste. Facebook groups and Marketplace forbid automatic posting, so the owner
 * copies and downloads; LINE opens its share picker. Clicks and enquiries per channel come from the API.
 */
export function ListingSharePanel({ listingId }: { listingId: string }) {
  const t = useTranslations("owner.listings.share");
  const action = useApiAction<Kit>({ refresh: false });
  const [kit, setKit] = useState<Kit | null>(null);
  const [lang, setLang] = useState<"th" | "en">("th");

  const load = () =>
    action.run(
      () => unwrap(browserApi().POST("/v1/owner/listings/{listingId}/share-kit", { params: { path: { listingId } } })),
      (result) => setKit(result),
    );

  const copy = (text: string, message: string) =>
    void navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(message))
      .catch(() => undefined);

  if (!kit)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted m-0 text-sm">{t("intro")}</p>
        <Button iconStart={IconLink} loading={action.busy} onClick={load} data-testid="listing-share-open">
          {t("prepare")}
        </Button>
        <ProblemNotice error={action.error} />
      </div>
    );

  const card = kit.cards[lang];
  const caption = (link: Link) => (lang === "th" ? link.captionTh : link.captionEn);

  return (
    <div className="flex flex-col gap-6" data-testid="listing-share">
      <SegmentedControl
        label={t("language")}
        value={lang}
        onValueChange={(value) => setLang(value === "en" ? "en" : "th")}
        options={[
          { value: "th", label: t("thai") },
          { value: "en", label: t("english") },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <figure className="m-0 flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a signed object-storage link that expires */}
          <img
            src={card.url}
            alt={t("cardAlt")}
            width={card.width}
            height={card.height}
            className="border-border rounded-card aspect-square w-full border object-cover"
            data-testid="listing-share-card"
          />
          <figcaption className="flex flex-col gap-2">
            <Button asChild variant="secondary" iconStart={IconDownload} block>
              <a href={card.url} download={`share-card-${lang}.png`} data-testid="listing-share-download">
                {t("download")}
              </a>
            </Button>
            <span className="text-muted text-xs">{t("cardNote")}</span>
          </figcaption>
        </figure>

        <ul className="m-0 flex list-none flex-col gap-0 p-0">
          {kit.links.map((link) => (
            <li
              key={link.channel}
              className="border-border flex flex-col gap-2 border-b py-4 first:pt-0 last:border-b-0"
              data-testid="listing-share-channel"
              data-channel={link.channel}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="m-0 text-base font-semibold">{t(`channels.${link.channel}`)}</h3>
                <p className="text-muted m-0 text-sm tabular-nums" data-testid="listing-share-stats">
                  {t("stats", { clicks: link.clicks, enquiries: link.enquiries })}
                </p>
              </div>
              <p className="text-muted m-0 text-sm">{t(`hints.${link.channel}`)}</p>
              <p className="m-0 font-mono text-sm break-all">{link.url}</p>
              <div className="flex flex-wrap gap-2">
                {link.shareUrl ? (
                  <Button asChild size="sm" iconStart={IconChat}>
                    <a href={link.shareUrl} target="_blank" rel="noopener noreferrer" data-testid="listing-share-line">
                      {t("shareLine")}
                    </a>
                  </Button>
                ) : null}
                {link.channel !== "qr" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    iconStart={IconCopy}
                    onClick={() => copy(caption(link), t("copiedCaption"))}
                  >
                    {t("copyCaption")}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" iconStart={IconLink} onClick={() => copy(link.url, t("copiedLink"))}>
                  {t("copyLink")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
