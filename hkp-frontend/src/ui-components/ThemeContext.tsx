import { createContext, useContext, useState, useEffect, ReactNode } from "react";

/** The app's UI family. Themes that don't name their own font fall back to it,
 *  and the font presets layer their own family on top of it. */
export const UI_FONT_STACK = "'DM Sans', system-ui, sans-serif";

const defaultTheme = {
  textColor: "",
  backgroundColor: "white",
  borderColor: "lightgray",
  borderRadius: 0 as string | number,
  serviceBorderRadius: 0 as string | number,
  accentColor: "#0ABCFB",
  buttonBackgroundColor: "transparent",
  runtimeBackgroundColor: "white",
  runtimeBackgroundImage: "",
  serviceBackgroundColor: "white",
  dropBarColor: "#0ABCFBFF",
  popoverBackgroundColor: "",
  serviceBorderWidth: 1,
  serviceContentPaddingBottom: 0,
  fontFamily: "",
  serviceBoxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  runtimeBoxShadow: "0 1px 3px rgba(0,0,0,0.10)",
};

const sketchTheme = {
  textColor: "",
  backgroundColor: "white",
  borderColor: "#aaa",
  borderRadius: "6px 20px 8px 18px / 18px 8px 20px 6px" as string | number,
  serviceBorderRadius: "6px 20px 8px 18px / 18px 8px 20px 6px" as string | number,
  accentColor: "#0ABCFB",
  buttonBackgroundColor: "transparent",
  runtimeBackgroundColor: "#fafafa",
  runtimeBackgroundImage: "",
  serviceBackgroundColor: "white",
  dropBarColor: "#0ABCFBFF",
  popoverBackgroundColor: "",
  serviceBorderWidth: 1,
  serviceContentPaddingBottom: 10,
  fontFamily: "'Kalam', cursive",
  serviceBoxShadow: "5px 5px 0px rgba(0,0,0,0.08)",
  runtimeBoxShadow: "6px 6px 0px rgba(0,0,0,0.07)",
};

const playgroundTheme = {
  textColor: "oklch(0.2 0.01 62)",
  backgroundColor: "oklch(0.99 0.003 62)",
  borderColor: "oklch(0.87 0.022 268)",
  borderRadius: "var(--r-runtime, 18px)" as string | number,
  serviceBorderRadius: "var(--r-card, 14px)" as string | number,
  accentColor: "oklch(0.6 0.17 196)",
  buttonBackgroundColor: "transparent",
  runtimeBackgroundColor: "oklch(0.978 0.012 268)",
  runtimeBackgroundImage: "",
  serviceBackgroundColor: "#ffffff",
  dropBarColor: "oklch(0.6 0.17 196)",
  popoverBackgroundColor: "",
  serviceBorderWidth: 1,
  serviceContentPaddingBottom: 0,
  fontFamily: UI_FONT_STACK,
  serviceBoxShadow: "var(--shadow-card, 0 1px 2px oklch(0.4 0.01 280 / 0.05), 0 3px 12px oklch(0.4 0.01 280 / 0.07))",
  runtimeBoxShadow: "var(--shadow-runtime, 0 2px 8px oklch(0.4 0.02 280 / 0.07), 0 8px 28px oklch(0.4 0.02 280 / 0.05))",
};

const mobileTheme = {
  textColor: "#1a1a1a",
  backgroundColor: "#f2ede8",
  borderColor: "#e2dbd4",
  borderRadius: 18 as string | number,
  serviceBorderRadius: 14 as string | number,
  accentColor: "#0ab5a0",
  buttonBackgroundColor: "transparent",
  runtimeBackgroundColor: "#eef2fc",
  runtimeBackgroundImage: "",
  serviceBackgroundColor: "#ffffff",
  dropBarColor: "#0ab5a0",
  popoverBackgroundColor: "#ffffff",
  serviceBorderWidth: 1.5,
  serviceContentPaddingBottom: 0,
  fontFamily: UI_FONT_STACK,
  serviceBoxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  runtimeBoxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const themes = { default: defaultTheme, sketch: sketchTheme, playground: playgroundTheme, mobile: mobileTheme } as const;
export type ThemeName = keyof typeof themes;
export type ThemeContextState = typeof defaultTheme;

// ── Appearance (user-controlled accent + font, app-wide) ─────────────────────
//
// The editor uses two accent colors (a teal `--hkp-accent` and a violet
// `--hkp-accent-violet`). Presets keep the two harmonized: picking one swaps
// both plus their dim variants via CSS variables on <html>, so every theme and
// the start page follow.

export type AccentPreset = {
  id: string;
  label: string;
  /** Primary accent (teal role). */
  accent: string;
  /** Secondary accent (violet role). */
  accentSecondary: string;
};

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "lagoon", label: "Lagoon", accent: "oklch(0.6 0.17 195)", accentSecondary: "#7c3aed" },
  { id: "cobalt", label: "Cobalt", accent: "#3b5bff", accentSecondary: "#6a3bff" },
  { id: "meadow", label: "Meadow", accent: "#17b877", accentSecondary: "#0a8a72" },
  { id: "ember", label: "Ember", accent: "#f2a417", accentSecondary: "#c76a00" },
  { id: "rose", label: "Rose", accent: "#e0355f", accentSecondary: "#a01040" },
];

export type FontPreset = {
  id: string;
  label: string;
  /** CSS font-family; empty string means "whatever the theme defines". */
  family: string;
  /** Bundled webfont, registered lazily on first use. */
  webfont?: WebfontSource;
};

/** A bundled family: one entry per subset, each with the URL of its woff2. */
type WebfontSource = {
  family: string;
  /** Weight range the variable font covers, as the CSS font-weight value. */
  weight: string;
  subsets: { url: string; unicodeRange: string }[];
};

// Latin ranges as published by Google Fonts for these families.
const LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, " +
  "U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, " +
  "U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT_RANGE =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, " +
  "U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, " +
  "U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

// Resolved by the bundler, so the files ship with the app and the browser
// fetches them from this origin only when a preset that uses them is active.
const SPACE_GROTESK: WebfontSource = {
  family: "Space Grotesk",
  weight: "400 700",
  subsets: [
    {
      url: new URL("../assets/fonts/space-grotesk-latin.woff2", import.meta.url).href,
      unicodeRange: LATIN_RANGE,
    },
    {
      url: new URL("../assets/fonts/space-grotesk-latin-ext.woff2", import.meta.url).href,
      unicodeRange: LATIN_EXT_RANGE,
    },
  ],
};

const ARCHIVO: WebfontSource = {
  family: "Archivo",
  weight: "400 800",
  subsets: [
    {
      url: new URL("../assets/fonts/archivo-latin.woff2", import.meta.url).href,
      unicodeRange: LATIN_RANGE,
    },
    {
      url: new URL("../assets/fonts/archivo-latin-ext.woff2", import.meta.url).href,
      unicodeRange: LATIN_EXT_RANGE,
    },
  ],
};

export const FONT_PRESETS: FontPreset[] = [
  { id: "theme", label: "Theme default", family: "" },
  {
    id: "character",
    label: "Character",
    family: `'Space Grotesk', ${UI_FONT_STACK}`,
    webfont: SPACE_GROTESK,
  },
  {
    id: "swiss",
    label: "Swiss",
    family: `'Archivo', ${UI_FONT_STACK}`,
    webfont: ARCHIVO,
  },
];

export type DensityPreset = { id: string; label: string };

// Compactness of service cards — a size axis independent of the colour theme.
// "comfortable" leaves every theme at its own defaults; "compact" swaps a
// handful of size tokens (`--hkp-svc-*` in index.css) by putting
// `data-density="compact"` on <html>, the same mechanism accent and font use.
export const DENSITY_PRESETS: DensityPreset[] = [
  { id: "comfortable", label: "Comfortable" },
  { id: "compact", label: "Compact" },
];

type AppearanceState = { accentId: string; fontId: string; densityId: string };

const APPEARANCE_STORAGE_KEY = "hkp-appearance";
const DEFAULT_APPEARANCE: AppearanceState = {
  accentId: "lagoon",
  fontId: "theme",
  densityId: "compact",
};

function restoreAppearance(): AppearanceState {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_APPEARANCE;
    }
    const parsed = JSON.parse(raw) as Partial<AppearanceState>;
    return {
      accentId: typeof parsed.accentId === "string" ? parsed.accentId : DEFAULT_APPEARANCE.accentId,
      fontId: typeof parsed.fontId === "string" ? parsed.fontId : DEFAULT_APPEARANCE.fontId,
      densityId:
        typeof parsed.densityId === "string" ? parsed.densityId : DEFAULT_APPEARANCE.densityId,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Registers a preset's bundled webfont once. The browser downloads the woff2
 *  only when text actually renders in that family. */
function ensureWebfontLoaded(preset: FontPreset) {
  if (!preset.webfont) {
    return;
  }
  const id = `hkp-font-${preset.id}`;
  if (document.getElementById(id)) {
    return;
  }
  const style = document.createElement("style");
  style.id = id;
  style.textContent = preset.webfont.subsets
    .map(
      (subset) => `@font-face {
  font-family: "${preset.webfont!.family}";
  font-style: normal;
  font-weight: ${preset.webfont!.weight};
  font-display: swap;
  src: url("${subset.url}") format("woff2");
  unicode-range: ${subset.unicodeRange};
}`,
    )
    .join("\n");
  document.head.appendChild(style);
}

function applyAppearance(appearance: AppearanceState) {
  const root = document.documentElement;
  const accent = ACCENT_PRESETS.find((p) => p.id === appearance.accentId);

  // The default preset removes the overrides so the theme's own values apply.
  if (!accent || accent.id === DEFAULT_APPEARANCE.accentId) {
    root.style.removeProperty("--hkp-accent");
    root.style.removeProperty("--hkp-accent-dim");
    root.style.removeProperty("--hkp-accent-violet");
    root.style.removeProperty("--hkp-accent-violet-dim");
  } else {
    root.style.setProperty("--hkp-accent", accent.accent);
    root.style.setProperty(
      "--hkp-accent-dim",
      `color-mix(in srgb, ${accent.accent} 12%, transparent)`,
    );
    root.style.setProperty("--hkp-accent-violet", accent.accentSecondary);
    root.style.setProperty(
      "--hkp-accent-violet-dim",
      `color-mix(in srgb, ${accent.accentSecondary} 12%, transparent)`,
    );
  }

  const font = FONT_PRESETS.find((p) => p.id === appearance.fontId);
  if (!font || !font.family) {
    root.style.removeProperty("--hkp-start-font");
  } else {
    ensureWebfontLoaded(font);
    root.style.setProperty("--hkp-start-font", font.family);
  }

  const density = DENSITY_PRESETS.find((p) => p.id === appearance.densityId);
  // `compact` is what the CSS keys on; `comfortable` carries the attribute too
  // but no rule targets it, so the bare `:root` token values apply.
  if (!density) {
    root.removeAttribute("data-density");
  } else {
    root.setAttribute("data-density", density.id);
  }
}

type ThemeControl = {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  accentId: string;
  setAccentId: (id: string) => void;
  fontId: string;
  setFontId: (id: string) => void;
  densityId: string;
  setDensityId: (id: string) => void;
};

export const ThemeCtx = createContext<ThemeContextState>(defaultTheme);
const ThemeControlCtx = createContext<ThemeControl>({
  themeName: "default",
  setThemeName: () => {},
  accentId: DEFAULT_APPEARANCE.accentId,
  setAccentId: () => {},
  fontId: DEFAULT_APPEARANCE.fontId,
  setFontId: () => {},
  densityId: DEFAULT_APPEARANCE.densityId,
  setDensityId: () => {},
});

export function ThemeProvider({ children, defaultThemeName = "default" }: { children: ReactNode; defaultThemeName?: ThemeName }) {
  // Persist per host surface (desktop playground / mobile / …) so each one
  // remembers its own theme.
  const themeStorageKey = `hkp-theme-name:${defaultThemeName}`;
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem(themeStorageKey);
    return stored && stored in themes ? (stored as ThemeName) : defaultThemeName;
  });
  const setThemeName = (name: ThemeName) => {
    setThemeNameState(name);
    localStorage.setItem(themeStorageKey, name);
  };
  const [appearance, setAppearance] = useState<AppearanceState>(restoreAppearance);

  const fontPreset = FONT_PRESETS.find((p) => p.id === appearance.fontId);
  const accentPreset = ACCENT_PRESETS.find((p) => p.id === appearance.accentId);
  const baseTheme = themes[themeName];
  const theme: ThemeContextState = {
    ...baseTheme,
    ...(fontPreset?.family ? { fontFamily: fontPreset.family } : {}),
    ...(accentPreset && accentPreset.id !== DEFAULT_APPEARANCE.accentId
      ? { accentColor: accentPreset.accent, dropBarColor: accentPreset.accent }
      : {}),
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeName);
  }, [themeName]);

  useEffect(() => {
    applyAppearance(appearance);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  }, [appearance]);

  const control: ThemeControl = {
    themeName,
    setThemeName,
    accentId: appearance.accentId,
    setAccentId: (id) => setAppearance((prev) => ({ ...prev, accentId: id })),
    fontId: appearance.fontId,
    setFontId: (id) => setAppearance((prev) => ({ ...prev, fontId: id })),
    densityId: appearance.densityId,
    setDensityId: (id) => setAppearance((prev) => ({ ...prev, densityId: id })),
  };

  return (
    <ThemeControlCtx.Provider value={control}>
      <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>
    </ThemeControlCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}

/** The family to render UI text in: whatever the active theme (and the user's
 *  font preset) resolves to, falling back to the app's own stack for themes
 *  that leave the choice to the document. */
export function useUiFont() {
  return useTheme().fontFamily || UI_FONT_STACK;
}

export function useThemeControl() {
  return useContext(ThemeControlCtx);
}
