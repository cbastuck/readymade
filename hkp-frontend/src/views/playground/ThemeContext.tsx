import { createContext } from "react";

const defaultTheme = {
  textColor: "",
  runtimeBackgroundColor: "",
  runtimeBackgroundImage: "",
  serviceBackgroundColor: "",
  dropBarColor: "#0ABCFBFF",
  popoverBackgroundColor: "",
};

const testTheme = {
  textColor: "white",
  runtimeBackgroundColor: "white",
  runtimeBackgroundImage:
    'url("https://images.unsplash.com/photo-1717034231682-96bde6d558f4?q=80&w=2487&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
  serviceBackgroundColor: "#FFFFFFA0",
  dropBarColor: "#0ABCFBFF",
  popoverBackgroundColor: "#CCCCCCaa",
};

const useDefaultTheme = true;
export type ThemeContextState = typeof defaultTheme;
export const ThemeCtx = createContext<ThemeContextState>(
  useDefaultTheme ? defaultTheme : testTheme
);
