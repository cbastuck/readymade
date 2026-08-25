import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { setSecretStore } from "hkp-frontend/src/core/secrets";
import { vaultSecretStore } from "hkp-frontend/src/vault";

import App from "./App.tsx";
import MobileApp from "./MobileApp.tsx";

import "hkp-frontend/app/globals.css";
import "hkp-frontend/src/index.css";

const isMeanderMobileNative =
  (window as any).__MEANDER_IOS__ === true ||
  (window as any).__MEANDER_ANDROID__ === true;
const Root = isMeanderMobileNative ? MobileApp : App;

// Before anything can load a board: a board's `{{secret.…}}` references are
// resolved as it is restored, and a store registered later would leave the
// first board opened with its credentials unset.
setSecretStore(vaultSecretStore);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
