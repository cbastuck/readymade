import {
  ACCENT_PRESETS,
  FONT_PRESETS,
  ThemeName,
  useThemeControl,
} from "./ThemeContext";

const THEME_OPTIONS: Array<{ id: ThemeName; label: string }> = [
  { id: "playground", label: "Playground" },
  { id: "default", label: "Default" },
  { id: "sketch", label: "Sketch" },
];

/**
 * App-wide appearance controls (theme, harmonized accent pair, font), backed
 * by ThemeContext. Shared between the Meander settings dialog and the website
 * settings dialog — must live under a ThemeProvider.
 */
export default function AppearanceSettings() {
  const { themeName, setThemeName, accentId, setAccentId, fontId, setFontId } =
    useThemeControl();

  return (
    <div className="flex flex-col gap-5 pt-2 text-sm">
      <div className="flex flex-col gap-2">
        <span className="uppercase tracking-[0.12em] text-slate-400 text-[0.68rem] font-semibold">
          Theme
        </span>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setThemeName(option.id)}
              className={`rounded-lg border px-3 py-2 text-[0.85rem] font-semibold transition-colors ${
                themeName === option.id
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="uppercase tracking-[0.12em] text-slate-400 text-[0.68rem] font-semibold">
          Accent colors
        </span>
        <span className="text-[0.8rem] text-slate-500 leading-snug">
          Each pick swaps the primary and secondary accents used across the
          whole app.
        </span>
        <div className="flex items-center gap-2.5">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.label}
              aria-label={`Accent ${preset.label}`}
              onClick={() => setAccentId(preset.id)}
              className="rounded-full transition-shadow"
              style={{
                width: 26,
                height: 26,
                border: "2px solid #fff",
                boxShadow:
                  accentId === preset.id
                    ? `0 0 0 2px ${preset.accent}`
                    : "0 0 0 1px #dfe2e9",
                background: `linear-gradient(135deg, ${preset.accent} 50%, ${preset.accentSecondary} 50%)`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="uppercase tracking-[0.12em] text-slate-400 text-[0.68rem] font-semibold">
          Font
        </span>
        <div className="flex gap-2">
          {FONT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.label}
              onClick={() => setFontId(preset.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors ${
                fontId === preset.id
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span
                className="text-lg font-semibold leading-none text-slate-800"
                style={preset.family ? { fontFamily: preset.family } : undefined}
              >
                Aa
              </span>
              <span className="text-[0.7rem] text-slate-500">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
