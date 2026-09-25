import type { Surface } from "hkp-frontend/src/components/Licenses/data";

/**
 * Which distribution surface this frontend is running inside, in the terms the
 * generated licence index uses.
 *
 * The index carries every surface at once, and the surfaces do not ship the
 * same components — the mobile builds leave out the local speech and language
 * models, so they link fewer libraries than the desktop ones. Attribution is
 * owed for what the reader actually received, so the host has to name itself
 * rather than have the whole index listed at it.
 *
 * The two mobile hosts set a flag on `window`; the three desktop hosts set
 * nothing, and are told apart by the webview's user agent. Outside a native
 * host — a dev server opened in a browser — the user agent names the same
 * operating system the desktop build for that machine would be built for.
 */
export function currentSurface(): Surface {
  const host = window as unknown as {
    __MEANDER_IOS__?: boolean;
    __MEANDER_ANDROID__?: boolean;
  };
  if (host.__MEANDER_IOS__ === true) {
    return "ios";
  }
  if (host.__MEANDER_ANDROID__ === true) {
    return "android";
  }
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) {
    return "windows";
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return "macos";
  }
  return "linux";
}
