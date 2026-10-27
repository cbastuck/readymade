import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { setSecretStore } from "hkp-frontend/src/core/secrets";
import {
  hostKeepsVault,
  setVaultPersist,
  vaultGet,
  vaultSecretStore,
} from "hkp-frontend/src/vault";
import {
  hostGrantStore,
  hostKeepsGrants,
  setGrantPersist,
} from "hkp-frontend/src/grants";
import { setSecretConsent } from "hkp-frontend/src/core/secretConsent";
import { setAssistTokenStore } from "hkp-frontend/src/assist/settings";

import { getBackend } from "./backend";

import App from "./App.tsx";
import MobileApp from "./MobileApp.tsx";

import "hkp-frontend/app/globals.css";
import "hkp-frontend/src/index.css";

const isMeanderMobileNative =
  (window as any).__MEANDER_IOS__ === true ||
  (window as any).__MEANDER_ANDROID__ === true;
const Root = isMeanderMobileNative ? MobileApp : App;

// The desktop window keeps its own title bar above the page, so the toolbar
// under it is kept lower than on the web, where it is the only bar.
if (!isMeanderMobileNative) {
  document.documentElement.style.setProperty("--hkp-toolbar-height", "40px");
}

// Before anything can load a board: a board's `{{secret.…}}` references are
// resolved as it is restored, and a store registered later would leave the
// first board opened with its credentials unset.
setSecretStore(vaultSecretStore);

// The store learns an audience the first time a secret is released. The cache
// it learns into is a copy of what the host injected, so without this the
// constraint would be forgotten at the next launch and re-learned from
// whatever ran first that time.
// Grants live with the vault rather than in browser storage: what a person has
// agreed to should be somewhere they can look at, back up and undo, and should
// not be writable by anything that runs in the page. The prompt itself is
// registered by SecretConsentDialog, which is what turns the gate on at all.
// Only where the host actually keeps them: a build with nowhere to write one
// keeps the browser-storage fallback, which is worse but is not nothing.
if (hostKeepsGrants()) {
  setSecretConsent({ grants: hostGrantStore });
}
setGrantPersist({
  grant: (key, aliases) => {
    void getBackend()
      .then((backend) => backend.grantSecrets?.(key, aliases))
      .catch(() => {
        // A host with no grant store. The answer holds for this session.
      });
  },
  revoke: (key) => {
    void getBackend()
      .then((backend) => backend.revokeSecretGrant?.(key))
      .catch(() => {});
  },
});

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

// Board Assist's provider tokens are credentials like any other: kept with
// the host's secrets, where they can be seen and removed, rather than in
// browser storage. Those already in browser storage move on the first launch.
if (hostKeepsVault()) {
  setAssistTokenStore({
    read: vaultGet,
    write: async (alias, value, audience) => {
      const backend = await getBackend();
      if (!backend.setSecret) {
        throw new Error("This build cannot store secrets");
      }
      await backend.setSecret(alias, value);
      await backend.setSecretAudience?.(alias, audience);
    },
    remove: async (alias) => {
      await (await getBackend()).deleteSecret?.(alias);
    },
    setAudience: async (alias, audience) => {
      await (await getBackend()).setSecretAudience?.(alias, audience);
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
