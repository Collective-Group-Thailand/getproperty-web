# Sign-in with Google, Apple and LINE — set-up (D-255, D-283)

The code runs end to end today against the fake verifiers (`OAUTH_MODE=fake` here, `INTEGRATIONS_MODE=fake` in the
API). Going live needs only the provider clients below — no code change. A provider's button appears on the owner
sign-in, sign-up and **Settings › Ways to sign in** pages as soon as its variables are set (`OAUTH_MODE=live`, the
production default).

| Where | Variable | What |
|---|---|---|
| getproperty-web (server) | `OAUTH_MODE` | `live` (production default) or `fake` (default elsewhere; a local test page stands in for the provider). |
| getproperty-web | `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET` | A **LINE Login** channel for the web console (LINE Developers → provider → new channel "LINE Login", app type *Web app*). |
| getproperty-web | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud (the Firebase project's) → APIs & Services → Credentials → *OAuth client ID*, type *Web application*. |
| getproperty-web | `APPLE_SERVICES_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Apple Developer → Identifiers → *Services ID* with Sign in with Apple; Keys → a key with Sign in with Apple (the `.p8` text, newlines as `\n`). |
| getproperty-web | `FIREBASE_WEB_API_KEY` | Firebase console → Project settings → *Web API key* of getproperty's project (Google and Apple tokens are exchanged there for Firebase ID tokens). |
| getproperty-liff (server) | `OAUTH_MODE`, `GOOGLE_*`, `APPLE_*`, `FIREBASE_WEB_API_KEY` | The same Google / Apple clients for prospects and residents outside LINE (LINE itself is the LIFF). |
| getproperty-api | `FIREBASE_PROJECT_ID` | The Firebase project id (the API verifies Firebase ID tokens against it). |
| getproperty-api | `LINE_LOGIN_CHANNEL_IDS` | Add the web console's LINE Login channel id to the LIFF channel id(s) already there (comma-separated). |

**Redirect / callback URLs to register**

- LINE Login (web): `https://<OWNER_HOST>/bff/oauth/line/callback`
- Google (web): `https://<OWNER_HOST>/bff/oauth/google/callback`; (LIFF) `https://<liff host>/bff/oauth/google/callback`
- Apple (web): `https://<OWNER_HOST>/bff/oauth/apple/callback`; (LIFF) `https://<liff host>/bff/oauth/apple/callback` — Apple
  also needs the domains listed on the Services ID.
- Firebase console → Authentication → Sign-in method: enable **Google** and **Apple** (Apple with the same Services ID,
  team, key id and key); Settings → Authorized domains: add both hosts.

**One LINE provider.** LINE user ids are per *provider* in LINE Developers: create the web console's LINE Login channel
under the same provider as the LIFF channels (resident app), so the LINE a landlord links here is the one the LINE app's
quick actions (`/landlord` in getproperty-liff, L5 5.3) sign in with.

**Rules the code keeps** (API D-255): an operator or a resident signs in with Google / Apple / LINE only after linking
it (Settings › Ways to sign in, or the landlord sign-up); an identity is never matched by e-mail and never moved from
one account to another; Google and Apple can be removed while another way to sign in remains; LINE and the phone stay
(notifications and lease links). Provider buttons use plain text ("Continue with Google") — if a provider's branding
guidelines ask for its mark at review time, add it then.
