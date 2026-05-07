import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  fontFamily: "'DM Sans', system-ui, sans-serif",
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
  fontFamily: "'DM Sans', system-ui, sans-serif",
  serviceBoxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  runtimeBoxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const themes = { default: defaultTheme, sketch: sketchTheme, playground: playgroundTheme, mobile: mobileTheme } as const;
export type ThemeName = keyof typeof themes;
export type ThemeContextState = typeof defaultTheme;

type ThemeControl = { themeName: ThemeName; setThemeName: (name: ThemeName) => void };

export const ThemeCtx = createContext<ThemeContextState>(defaultTheme);
const ThemeControlCtx = createContext<ThemeControl>({
  themeName: "default",
  setThemeName: () => {},
});

export function ThemeProvider({ children, defaultThemeName = "default" }: { children: ReactNode; defaultThemeName?: ThemeName }) {
  const [themeName, setThemeName] = useState<ThemeName>(defaultThemeName);
  const theme = themes[themeName];

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeName);
  }, [themeName]);

  return (
    <ThemeControlCtx.Provider value={{ themeName, setThemeName }}>
      <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>
    </ThemeControlCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export function useThemeControl() {
  return useContext(ThemeControlCtx);
}
