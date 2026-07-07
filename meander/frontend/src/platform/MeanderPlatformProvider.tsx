import { ReactNode } from "react";
import {
  PlatformCapabilities,
  PlatformProvider,
  RuntimeAccessSettings,
  RuntimeTokenRequest,
} from "hkp-frontend/src/platform/PlatformContext";
import { getBackend } from "../backend";
import { meanderLogin } from "../auth/meanderLogin";
import { iosLogin } from "../auth/iosLogin";

// Capabilities are only wired up when the native saucer APIs are actually present
// (i.e. running inside the Meander desktop webview, not in a plain browser).
// When absent the provider still wraps the tree but with an empty capabilities
// object, so hkp-frontend components fall back to their browser defaults.
const saucer = (window as any).saucer;
const isNative = !!(
  saucer?.exposed?.pickSavePath && saucer?.exposed?.writeFile
);
const isIOS = (window as any).__MEANDER_IOS__ === true;
const isAndroid = (window as any).__MEANDER_ANDROID__ === true;

// iOS: the embedded runtime is LAN-exposed and enforces Jwt auth with an empty
// allow-list (locked) until the owner signs in. This pushes the signed-in email
// to the native runtime (via a WKScriptMessageHandler) so it admits the owner's
// other devices; sending null on logout re-locks it.
const setRuntimeAllowedUserNative = (email: string | null) => {
  const payload = { email: email ?? null };
  const nativeHandler = (window as any).hkpRuntimeAuth;
  if (nativeHandler?.postMessage) {
    nativeHandler.postMessage(payload);
    return;
  }
  const webkitHandler = (window as any).webkit?.messageHandlers?.hkpRuntimeAuth;
  webkitHandler?.postMessage(payload);
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
  // Mints a scoped capability token from the embedded runtime via the hkp://
  // scheme (in-process, owner-only). Handed to an out-of-band device by a QR.
  // The semantic action is translated to its backend transport here; add a
  // case as new mint-token actions are introduced.
  mintToken: async (request: RuntimeTokenRequest): Promise<string | null> => {
    const backend = await getBackend();
    switch (request.action) {
      case "processRuntime":
        return (await backend.mintProcessRuntimeToken?.(request.runtimeId)) ?? null;
      default:
        return null;
    }
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
  : isIOS || isAndroid
    ? {
        setRuntimeAllowedUser: setRuntimeAllowedUserNative,
        // Native Auth0 login via ASWebAuthenticationSession on iOS and browser
        // redirect capture on Android.
        login: iosLogin,
        ...runtimeSettingsCapabilities,
      }
    : {};

export function MeanderPlatformProvider({ children }: { children: ReactNode }) {
  return <PlatformProvider value={capabilities}>{children}</PlatformProvider>;
}
