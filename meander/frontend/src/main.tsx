import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { setSecretStore } from "hkp-frontend/src/core/secrets";
import { setVaultPersist, vaultSecretStore } from "hkp-frontend/src/vault";

import { getBackend } from "./backend";

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

// The store learns an audience the first time a secret is released. The cache
// it learns into is a copy of what the host injected, so without this the
// constraint would be forgotten at the next launch and re-learned from
// whatever ran first that time.
setVaultPersist({
  setAudience: (alias, audience) => {
    void getBackend()
      .then((backend) => backend.setSecretAudience?.(alias, audience))
      .catch(() => {
        // A host with no secret store, or an older build with no way to write
        // one. The constraint still holds for this session.
      });
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
