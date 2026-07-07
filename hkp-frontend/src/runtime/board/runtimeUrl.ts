/**
 * The runtime-URL convention, in one place.
 *
 * A runtime is addressed as `<host>/runtimes/<runtimeId>` (the host portion is
 * often still an unresolved `HKP_RUNTIME_URL` placeholder at board-design time;
 * see templateVars.ts). Parsing that shape lives here rather than inline in
 * individual services so that if the convention ever changes, the services
 * affected by it are found by looking for the callers of these helpers.
 */

/**
 * Extracts the runtime id a URL targets, e.g.
 * `"HKP_RUNTIME_URL/runtimes/upload-server"` -> `"upload-server"`. Works
 * whether or not the host portion has been resolved to a concrete address.
 * Returns `undefined` when the URL does not name a runtime.
 */
export function runtimeIdFromUrl(url: string): string | undefined {
  const match = url.match(/\/runtimes\/([^/?#]+)/);
  return match ? match[1] : undefined;
}
