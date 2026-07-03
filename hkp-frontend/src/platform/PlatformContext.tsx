import { createContext, useContext } from "react";

// Runtime-access settings the host persists (exposure + allow-list). Changes
// take effect on the host's next start.
export type RuntimeAccessSettings = {
  allowExternalRuntimeAccess: boolean;
  allowedUsers: string[];
};

export interface PlatformCapabilities {
  saveRuntimeToDisk?: (json: string, filename: string) => Promise<void>;
  /**
   * Platform-specific login. Resolves to a raw OIDC id_token JWT on success, or
   * null if the user cancelled. Provided by hosts where the standard Auth0 web
   * redirect flow can't run (e.g. the native Meander app, which uses a
   * system-browser PKCE flow). When absent, callers fall back to the web Auth0
   * redirect login.
   */
  login?: () => Promise<string | null>;
  /** Platform-specific logout, when the platform owns the session. */
  logout?: () => Promise<void>;
  /**
   * Tells the host's embedded runtime which user is allowed to drive it from
   * other devices (the signed-in user's email, or null when signed out). Hosts
   * with a LAN-exposed embedded runtime (e.g. iOS) implement this to gate
   * inbound access to the owner. Absent on hosts that configure their allow-list
   * elsewhere (e.g. desktop via settings.json) or have no embedded runtime.
   */
  setRuntimeAllowedUser?: (email: string | null) => void;
  /**
   * Reads/writes the host's runtime-access settings (exposure + allow-list),
   * backed by the host's persistent store (settings.json on desktop, native
   * prefs on iOS). Absent on hosts without an editable store; callers should
   * feature-detect. `setRuntimeSettings` applies a partial update and returns
   * the full resulting settings.
   */
  getRuntimeSettings?: () => Promise<RuntimeAccessSettings>;
  setRuntimeSettings?: (
    patch: Partial<RuntimeAccessSettings>,
  ) => Promise<RuntimeAccessSettings>;
}

const PlatformContext = createContext<PlatformCapabilities>({});

export const PlatformProvider = PlatformContext.Provider;

export function usePlatform(): PlatformCapabilities {
  return useContext(PlatformContext);
}
