/**
 * Props for a field that takes a third-party secret once (a Facebook Page token, a LINE channel secret / access
 * token) — review L9. Masked, but never offered to the browser's or an extension's password manager: Chromium ignores
 * `autocomplete="off"` on password fields and offers to save them, which would keep a long-lived secret beyond the
 * dialog. `new-password` stops the fill/save prompt for the site credentials; the `data-*` flags opt out of
 * 1Password, LastPass, Bitwarden and Dashlane.
 */
export const SECRET_FIELD_PROPS = {
  type: "password",
  autoComplete: "new-password",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;
