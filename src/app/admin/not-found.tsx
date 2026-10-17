import { ZoneNotFound } from "@/features/shared/errors/ZoneNotFound";

export default function NotFound() {
  return <ZoneNotFound homeHref="/" />;
}
