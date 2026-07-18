// Desktop (macOS) side of the share feature. Unlike iOS — where the native
// shell PUSHES envelopes into the webview — the desktop app PULLS them: the
// share extension drops envelopes into the App Group inbox and the scheme
// handler serves them on hkp://share-inbox. This module drains that route and
// feeds the same window.__READYMADE_SHARES__ queue the shared picker logic
// consumes (see shareInbox.ts).
//
// Drains run on install (mount / cold launch), whenever the window regains
// focus (the extension foregrounds the app via readymade://share), and when
// the native openURLs handler nudges via window.__readymadeCheckShares.

import { SharePayload } from "./shareInbox";

declare global {
  interface Window {
    /** Set here; the native openURLs handler calls it for an immediate drain. */
    __readymadeCheckShares?: () => void;
  }
}

/** Same shell detection as MeanderPlatformProvider: saucer's exposed API. */
function isDesktopShell(): boolean {
  const saucer = (window as unknown as Record<string, any>).saucer;
  return !!(saucer?.exposed?.pickSavePath && saucer?.exposed?.writeFile);
}

/**
 * Acknowledge an envelope so it is delivered at most once. Fire-and-forget:
 * if this never lands the envelope shows up again on the next drain, which
 * beats silently losing a share.
 */
function ackShare(id: string): void {
  void fetch(`hkp://share-inbox/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {
    // Retried implicitly by the duplicate-guard on the next drain.
  });
}

let draining = false;

/**
 * Pull all pending envelopes from the native inbox onto the in-page queue and
 * wake the app's promoteNextShare (window.__readymadeOnShare). Overlapping
 * calls (focus + native nudge firing together) collapse into one drain.
 */
export async function drainDesktopShareInbox(): Promise<void> {
  if (!isDesktopShell() || draining) {
    return;
  }
  draining = true;
  try {
    const response = await fetch("hkp://share-inbox");
    if (!response.ok) {
      return;
    }
    const pending = (await response.json()) as SharePayload[];
    if (!Array.isArray(pending) || pending.length === 0) {
      return;
    }
    const queue = (window.__READYMADE_SHARES__ ??= []);
    const queued = new Set(queue.map((env) => env.id));
    let delivered = false;
    for (const env of pending) {
      if (!env || typeof env.id !== "string" || queued.has(env.id)) {
        continue;
      }
      ackShare(env.id);
      queue.push(env);
      delivered = true;
    }
    if (delivered) {
      console.log(
        "[ReadymadeShare] desktop inbox drained,",
        queue.length,
        "queued",
      );
      window.__readymadeOnShare?.(queue[0]);
    }
  } catch {
    // hkp:// route unavailable (e.g. plain-browser dev) — nothing to drain.
  } finally {
    draining = false;
  }
}

/**
 * Install the drain triggers. Returns an uninstaller (for effect cleanup).
 * No-op outside the desktop shell.
 */
export function installDesktopShareInbox(): () => void {
  if (!isDesktopShell()) {
    return () => {};
  }
  const drain = () => {
    void drainDesktopShareInbox();
  };
  window.addEventListener("focus", drain);
  window.__readymadeCheckShares = drain;
  drain();
  return () => {
    window.removeEventListener("focus", drain);
    if (window.__readymadeCheckShares === drain) {
      delete window.__readymadeCheckShares;
    }
  };
}
