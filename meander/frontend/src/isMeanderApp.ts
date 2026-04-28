let probePromise: Promise<boolean> | null = null;

function probe(): Promise<boolean> {
  return fetch("hkp://boards/", { signal: AbortSignal.timeout(500) })
    .then(() => true)
    .catch(() => false);
}

/**
 * Returns true when the hkp:// custom scheme is reachable — i.e. the page is
 * running inside the Meander desktop app (either served via hkp:/saucer: in
 * production, or via a dev server while the webview integration is active).
 *
 * Returns false in a regular browser where hkp:// is not registered.
 *
 * The result is cached after the first call so only one probe is ever issued.
 */
export function isMeanderApp(): Promise<boolean> {
  const { protocol } = window.location;
  if (protocol === "hkp:" || protocol === "saucer:") {
    return Promise.resolve(true);
  }
  if (!probePromise) {
    probePromise = probe();
  }
  return probePromise;
}
