import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import MobileApp from "./MobileApp.tsx";

import "hkp-frontend/app/globals.css";
import "hkp-frontend/src/index.css";

const isMeanderMobileNative =
  (window as any).__MEANDER_IOS__ === true ||
  (window as any).__MEANDER_ANDROID__ === true;
const Root = isMeanderMobileNative ? MobileApp : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
