/**
 * Returns true when running inside the Meander desktop app (where the hkp://
 * custom scheme is registered and available for fetch calls).
 *
 * Returns false when the page is loaded in a regular browser — e.g. a phone
 * opening the SPA from the FrontendServer, or a developer browsing an IP
 * address directly.
 */
export function isMeanderApp(): boolean {
  const { protocol, hostname } = window.location;
  return protocol === "hkp:" || hostname === "localhost" || hostname === "127.0.0.1";
}
