import { ReactNode } from "react";
import {
  PlatformCapabilities,
  PlatformProvider,
  RuntimeAccessSettings,
} from "hkp-frontend/src/platform/PlatformContext";
import { getBackend } from "../backend";
import { meanderLogin } from "../auth/meanderLogin";

// Capabilities are only wired up when the native saucer APIs are actually present
// (i.e. running inside the Meander desktop webview, not in a plain browser).
// When absent the provider still wraps the tree but with an empty capabilities
// object, so hkp-frontend components fall back to their browser defaults.
const saucer = (window as any).saucer;
const isNative = !!(
  saucer?.exposed?.pickSavePath && saucer?.exposed?.writeFile
);
const isIOS = (window as any).__MEANDER_IOS__ === true;

// iOS: the embedded runtime is LAN-exposed and enforces Jwt auth with an empty
// allow-list (locked) until the owner signs in. This pushes the signed-in email
// to the native runtime (via a WKScriptMessageHandler) so it admits the owner's
// other devices; sending null on logout re-locks it.
const setRuntimeAllowedUserIOS = (email: string | null) => {
  const handler = (window as any).webkit?.messageHandlers?.hkpRuntimeAuth;
  handler?.postMessage({ email: email ?? null });
};

// Runtime-access settings (exposure + allow-list) flow through the backend's
// hkp:// scheme (settings.json on desktop, native prefs via the iOS scheme
// handler). Shared by the desktop and iOS capability sets.
const runtimeSettingsCapabilities: Partial<PlatformCapabilities> = {
  getRuntimeSettings: async (): Promise<RuntimeAccessSettings> => {
    const backend = await getBackend();
    return (
      backend.getRuntimeSettings?.() ??
      Promise.resolve({ allowExternalRuntimeAccess: false, allowedUsers: [] })
    );
  },
  setRuntimeSettings: async (
    patch: Partial<RuntimeAccessSettings>,
  ): Promise<RuntimeAccessSettings> => {
    const backend = await getBackend();
    return (
      backend.setRuntimeSettings?.(patch) ??
      Promise.resolve({ allowExternalRuntimeAccess: false, allowedUsers: [] })
    );
  },
};

const capabilities: PlatformCapabilities = isNative
  ? {
      saveRuntimeToDisk: async (json, _filename) => {
        const backend = await getBackend();
        const path = await backend.pickSavePath({ filters: ["*.json"] });
        if (path) {
          await backend.writeFile(path, json);
        }
      },
      // Native Auth0 login (system browser + PKCE). hkp-frontend's cloud view
      // calls this instead of the web redirect when present.
      login: meanderLogin,
      ...runtimeSettingsCapabilities,
    }
  : isIOS
    ? {
        setRuntimeAllowedUser: setRuntimeAllowedUserIOS,
        ...runtimeSettingsCapabilities,
      }
    : {};

export function MeanderPlatformProvider({ children }: { children: ReactNode }) {
  return <PlatformProvider value={capabilities}>{children}</PlatformProvider>;
}
