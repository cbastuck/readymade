import { ReactNode } from "react";
import {
  PickedFile,
  PlatformCapabilities,
  PlatformProvider,
  RuntimeAccessSettings,
  RuntimeTokenRequest,
} from "hkp-frontend/src/platform/PlatformContext";
import { getBackend } from "../backend";
import { meanderLogin, type NativeLogin } from "../auth/meanderLogin";
import { iosLogin } from "../auth/iosLogin";
import { saveSession } from "../auth/session";
import {
  refreshNativeSession,
  restoreNativeSession,
} from "../auth/refreshSession";
import { meanderLogout } from "../auth/meanderLogout";

// Capabilities are only wired up when the native saucer APIs are actually present
// (i.e. running inside the Readymade desktop webview, not in a plain browser).
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

/**
 * Keeps a successful native login across reloads. The tokens are the only thing
 * the native flow returns, so if they are not persisted here nothing else will.
 *
 * The refresh token is what lets the session outlive the id_token's few hours; a
 * flow that returns none (the iOS/Android bridge does the exchange natively and
 * hands back only an id_token) keeps the shorter session it always had.
 */
function withPersistedSession(
  login: () => Promise<NativeLogin | string | null>,
): () => Promise<string | null> {
  return async () => {
    const result = await login();
    if (!result) {
      return null;
    }
    const session = typeof result === "string" ? { idToken: result } : result;
    saveSession(session.idToken, session.refreshToken);
    return session.idToken;
  };
}


/**
 * The native file chooser, reading what was picked.
 *
 * `pickFile` hands back a path, and `readFile` takes one — so unlike a web file
 * input, what comes back knows *where* it came from. That is what lets a picked
 * composition resolve the units named beside it without anything else being
 * chosen or saved first.
 */
const pickFilesNative = async (options?: {
  filters?: string[];
  multiple?: boolean;
}): Promise<PickedFile[]> => {
  const backend = await getBackend();
  const uri = await backend.pickFile({ filters: options?.filters });
  if (!uri) {
    return [];
  }
  const source = await backend.readFile(uri);
  return [{ name: uri.split("/").pop() ?? uri, source, uri }];
};


/**
 * The host's board library, which on this platform is on disk rather than in
 * local storage. A composition resolving its units by name has to look here.
 */
const loadSavedBoardNative = async (name: string) => {
  const backend = await getBackend();
  try {
    return (await backend.loadBoard(name)) ?? null;
  } catch {
    // Not in the library is an answer, not a failure.
    return null;
  }
};

const capabilities: PlatformCapabilities = isNative
  ? {
      pickFiles: pickFilesNative,
      readFile: async (uri) => (await getBackend()).readFile(uri),
      loadSavedBoard: loadSavedBoardNative,
      saveRuntimeToDisk: async (json, _filename) => {
        const backend = await getBackend();
        const path = await backend.pickSavePath({ filters: ["*.json"] });
        if (path) {
          await backend.writeFile(path, json);
        }
      },
      // Native Auth0 login (system browser + PKCE). hkp-frontend's cloud view
      // calls this instead of the web redirect when present.
      login: withPersistedSession(meanderLogin),
      logout: meanderLogout,
      restoreSession: restoreNativeSession,
      refreshSession: refreshNativeSession,
      ...runtimeSettingsCapabilities,
    }
  : isIOS || isAndroid
    ? {
        loadSavedBoard: loadSavedBoardNative,
        setRuntimeAllowedUser: setRuntimeAllowedUserNative,
        // Native Auth0 login via ASWebAuthenticationSession on iOS and browser
        // redirect capture on Android.
        login: withPersistedSession(iosLogin),
        logout: meanderLogout,
        // The mobile bridges exchange tokens natively and return only an
        // id_token, so there is normally nothing to renew with — but the
        // capability is wired all the same, so a bridge that starts returning a
        // refresh token needs no change here.
        restoreSession: restoreNativeSession,
        refreshSession: refreshNativeSession,
        ...runtimeSettingsCapabilities,
      }
    : {};

export function MeanderPlatformProvider({ children }: { children: ReactNode }) {
  return <PlatformProvider value={capabilities}>{children}</PlatformProvider>;
}
