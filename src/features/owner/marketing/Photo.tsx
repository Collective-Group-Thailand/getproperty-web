import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { cn } from "@/ui/lib/cn";

import type { MarketingPhoto } from "./photos";

/** A marketing photo through the image optimiser, alt text from i18n; the box decides the crop. */
export async function Photo({
  photo,
  className,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  decorative = false,
}: {
  photo: MarketingPhoto;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** The photo only sets a mood next to text that says everything: empty alt. */
  decorative?: boolean;
}) {
  const t = await getTranslations("owner.marketing.photos");
  return (
    <div className={cn("bg-surface-subtle relative overflow-hidden", className)}>
      <Image
        src={photo.src}
        alt={decorative ? "" : t(photo.alt)}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
