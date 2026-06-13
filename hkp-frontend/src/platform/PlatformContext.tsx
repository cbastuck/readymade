import { createContext, useContext } from "react";

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
}

const PlatformContext = createContext<PlatformCapabilities>({});

export const PlatformProvider = PlatformContext.Provider;

export function usePlatform(): PlatformCapabilities {
  return useContext(PlatformContext);
}
