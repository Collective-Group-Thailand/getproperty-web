import { createBffHandler } from "@/lib/bff/handler";

/** The owner zone's BFF (ADR-0004): allow-listed upstream prefixes only, session from httpOnly cookies. */
export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = createBffHandler("owner");
