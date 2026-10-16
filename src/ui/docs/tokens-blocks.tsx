import { oklchToHex } from "../tokens/color";
import { DURATION, FONT_SIZE, RADIUS, SHADOW } from "../tokens/scale";
import { SEMANTIC_KEYS, THEME_NAMES, THEMES } from "../tokens/semantic";

/** Swatch table for the Tokens docs page: every semantic key in every theme, with its sRGB hex. */
export function Swatches() {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="text-start">token</th>
          {THEME_NAMES.map((t) => (
            <th key={t} className="text-start">
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SEMANTIC_KEYS.map((key) => (
          <tr key={key}>
            <td>
              <code>{key}</code>
            </td>
            {THEME_NAMES.map((theme) => {
              const hex = oklchToHex(THEMES[theme][key]);
              return (
                <td key={theme}>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="border-border inline-block size-5 rounded-sm border" style={{ background: hex }} />
                    <code>{hex}</code>
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Scale() {
  const rows = [
    ["--text-*", Object.entries(FONT_SIZE)],
    ["--radius-*", Object.entries(RADIUS)],
    ["--shadow-*", Object.entries(SHADOW)],
    ["--duration-*", Object.entries(DURATION)],
  ] as const;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {rows.map(([name, entries]) => (
        <table key={name} className="text-sm">
          <caption className="text-start font-medium">{name}</caption>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td>
                  <code>{k}</code>
                </td>
                <td>
                  <code className="text-muted">{v}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
