# src/lib/realtime

SSE realtime through the zone BFF (contract §6): `sse.ts` parses the stream, `client.ts` authorises,
reconnects with backoff and maps event types to TanStack Query keys. The provider is
`src/features/shared/realtime/RealtimeProvider.tsx`.
