import { createContext, useContext } from "react";

const defaultTheme = {
  textColor: "",
  backgroundColor: "white",
  borderColor: "lightgray",
  borderRadius: 0,
  accentColor: "#0ABCFB",
  buttonBackgroundColor: "transparent",
  runtimeBackgroundColor: "white",
  runtimeBackgroundImage: "",
  serviceBackgroundColor: "white",
  dropBarColor: "#0ABCFBFF",
  popoverBackgroundColor: "",
  serviceBorderWidth: 1,
};

const testTheme = {
  textColor: "black",
  backgroundColor: "white",
  borderColor: "white",
  borderRadius: 0,
  accentColor: "#E2D440",
  buttonBackgroundColor: "transparent",
  runtimeBackgroundColor: "#00B1FF",
  runtimeBackgroundImage: "", //'url("https://images.unsplash.com/photo-1717034231682-96bde6d558f4?q=80&w=2487&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
  serviceBackgroundColor: "#FFFFFFA0",
  dropBarColor: "#0ABCFBFF",
  popoverBackgroundColor: "#CCCCCCaa",
  serviceBorderWidth: 2,
};

const useDefaultTheme = true;
export type ThemeContextState = typeof defaultTheme;
export const ThemeCtx = createContext<ThemeContextState>(
  useDefaultTheme ? defaultTheme : testTheme
);

export function useTheme() {
  return useContext(ThemeCtx);
}
