import { createContext, useContext, ReactNode } from "react";

// Runtime-access settings the host persists (exposure + allow-list). Changes
// take effect on the host's next start.
export type RuntimeAccessSettings = {
  allowExternalRuntimeAccess: boolean;
  allowedUsers: string[];
};

/**
 * A request for a scoped capability token, expressed as the semantic action the
 * caller wants to authorize on the host's embedded runtime. The host maps each
 * action to the concrete REST request shape (method + path) the token is scoped
 * to, so callers express intent and never encode REST details themselves.
 *
 * Extend this union as more out-of-band capabilities are needed (e.g. adding or
 * removing a service on a runtime); each new action stays a localized change to
 * the host's translation and its transport.
 */
export type RuntimeTokenRequest = { action: "processRuntime"; runtimeId: string };

export interface PlatformCapabilities {
  saveRuntimeToDisk?: (json: string, filename: string) => Promise<void>;
  /**
   * Platform-specific login. Resolves to a raw OIDC id_token JWT on success, or
   * null if the user cancelled. Provided by hosts where the standard Auth0 web
   * redirect flow can't run (e.g. the native Readymade app, which uses a
   * system-browser PKCE flow). When absent, callers fall back to the web Auth0
   * redirect login.
   */
  login?: () => Promise<string | null>;
  /** Platform-specific logout, when the platform owns the session. */
  logout?: () => Promise<void>;
  /**
   * Restores a previously established platform session, resolving to a raw
   * id_token or null when there is none (or it has expired).
   *
   * Hosts whose `login` is their own flow must implement this: nothing else holds
   * that token, so without it a page reload silently signs the user out. App
   * startup waits for this before declaring the auth state settled, so anything
   * that needs credentials — notably restoring a board with a remote runtime —
   * does not race it.
   */
  restoreSession?: () => Promise<string | null>;
  /**
   * Renews a host-owned session, resolving to a fresh raw id_token or null when
   * it cannot be renewed (nothing stored, or the credential behind it is spent).
   *
   * Hosts whose `login` is their own flow implement this so the session can
   * outlive its id_token: the app keeps a token that expires in hours, while the
   * session behind it lasts days, and without renewal the difference shows up as
   * a user who looks signed out and is then signed straight back in without
   * being asked for anything. Called shortly before expiry, and at startup when
   * the stored token has already aged out.
   */
  refreshSession?: () => Promise<string | null>;
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
  /**
   * Mints a short-lived capability token from the host's embedded runtime,
   * scoped to the requested action (see RuntimeTokenRequest). Handed to an
   * out-of-band device (e.g. a phone via a QR code) so it can perform just that
   * one action without a user session. Resolves to null if the host can't mint
   * (unknown runtime, no embedded runtime). Absent on the plain web platform.
   */
  mintToken?: (request: RuntimeTokenRequest) => Promise<string | null>;
}

const PlatformContext = createContext<PlatformCapabilities>({});

// Module-level mirror of the active capabilities, so non-React code (e.g. a
// browser runtime service that runs during board load) can reach host
// capabilities that otherwise only live in React context. Set during
// PlatformProvider's render — i.e. at the app root, before any board mounts or
// processes — which avoids the timing races of wiring capabilities onto a
// per-runtime scope from a UI component's render.
let activeCapabilities: PlatformCapabilities = {};

export function PlatformProvider({
  value,
  children,
}: {
  value: PlatformCapabilities;
  children: ReactNode;
}) {
  activeCapabilities = value;
  return (
    <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformCapabilities {
  return useContext(PlatformContext);
}

// Non-React accessor for the host's token minter. Resolves to null when no host
// capability is present (plain web), mirroring PlatformCapabilities.mintToken.
export function mintTokenViaPlatform(
  request: RuntimeTokenRequest,
): Promise<string | null> {
  return activeCapabilities.mintToken
    ? activeCapabilities.mintToken(request)
    : Promise.resolve(null);
}
