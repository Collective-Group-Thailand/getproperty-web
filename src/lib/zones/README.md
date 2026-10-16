# src/lib/zones

Host → zone resolution shared by `src/proxy.ts`, the theme defaults and (F1) the BFF. F0 ships the
minimal mapping with a unit test; F1 1.1 adds `ZONES` allow-listing, internal-path refusal, security
headers and the per-zone CSP.
