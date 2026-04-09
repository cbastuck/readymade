import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const defaultTheme = {
  textColor: "",
  backgroundColor: "white",
  borderColor: "lightgray",
  borderRadius: 0 as string | number,
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

const themes = { default: defaultTheme, sketch: sketchTheme } as const;
export type ThemeName = keyof typeof themes;
export type ThemeContextState = typeof defaultTheme;

type ThemeControl = { themeName: ThemeName; setThemeName: (name: ThemeName) => void };

export const ThemeCtx = createContext<ThemeContextState>(defaultTheme);
const ThemeControlCtx = createContext<ThemeControl>({
  themeName: "default",
  setThemeName: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("default");
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
