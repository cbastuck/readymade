import {
  ACCENT_PRESETS,
  DENSITY_PRESETS,
  FONT_PRESETS,
  ThemeName,
  useThemeControl,
} from "./ThemeContext";
import {
  SettingsChoices,
  SettingsSection,
  SettingsStack,
} from "./settings/kit";

const THEME_OPTIONS: Array<{ id: ThemeName; label: string }> = [
  { id: "playground", label: "Playground" },
  { id: "default", label: "Default" },
  { id: "sketch", label: "Sketch" },
];

/**
 * App-wide appearance controls (theme, harmonized accent pair, font), backed
 * by ThemeContext. Shared between the Readymade settings dialog and the website
 * settings dialog — must live under a ThemeProvider.
 */
export default function AppearanceSettings() {
  const {
    themeName,
    setThemeName,
    accentId,
    setAccentId,
    fontId,
    setFontId,
    densityId,
    setDensityId,
  } = useThemeControl();

  return (
    <SettingsStack>
      <SettingsSection label="Theme">
        <SettingsChoices
          options={THEME_OPTIONS}
          value={themeName}
          onChange={setThemeName}
        />
      </SettingsSection>

      <SettingsSection
        label="Accent colors"
        hint="Each pick swaps the primary and secondary accents used across the whole app."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.label}
              aria-label={`Accent ${preset.label}`}
              aria-pressed={accentId === preset.id}
              onClick={() => setAccentId(preset.id)}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                cursor: "pointer",
                borderRadius: "50%",
                border: "2px solid #fff",
                boxShadow:
                  accentId === preset.id
                    ? `0 0 0 2px ${preset.accent}`
                    : "0 0 0 1px #dfe2e9",
                background: `linear-gradient(135deg, ${preset.accent} 50%, ${preset.accentSecondary} 50%)`,
                transition: "box-shadow 0.12s",
              }}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        label="Density"
        hint="Compact shrinks service cards and their text across every theme."
      >
        <SettingsChoices
          options={DENSITY_PRESETS.map((preset) => ({
            id: preset.id,
            label: preset.label,
          }))}
          value={densityId}
          onChange={setDensityId}
        />
      </SettingsSection>

      <SettingsSection label="Font">
        <SettingsChoices
          options={FONT_PRESETS.map((preset) => ({
            id: preset.id,
            title: preset.label,
            label: (
              <span
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  fontFamily: preset.family ?? undefined,
                }}
              >
                Aa
              </span>
            ),
            sub: preset.label,
          }))}
          value={fontId}
          onChange={setFontId}
        />
      </SettingsSection>
    </SettingsStack>
  );
}
