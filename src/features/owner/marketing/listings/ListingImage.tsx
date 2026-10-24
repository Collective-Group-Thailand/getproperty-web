import Image from "next/image";

import { cn } from "@/ui/lib/cn";

import type { PublicListingPhoto } from "./contract";

/**
 * A listing photo. Unsplash samples (mock data) go through the image optimiser; the API's own renditions (D-252: three
 * sizes, EXIF stripped) are already sized, so they are served as they are.
 */
export function ListingImage({
  photo,
  alt,
  className,
  sizes,
  priority = false,
}: {
  photo: PublicListingPhoto;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const optimised = photo.url.startsWith("https://images.unsplash.com/");
  return (
    <div className={cn("bg-surface-subtle relative overflow-hidden", className)}>
      <Image
        src={photo.url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={!optimised}
        className="object-cover"
      />
    </div>
  );
}
