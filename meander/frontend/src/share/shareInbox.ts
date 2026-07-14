// Web-side of the iOS share feature. The native shell (BoardListView's injected
// bridge + ShareRouter) delivers captured shares by pushing envelopes onto
// window.__READYMADE_SHARES__ and calling window.__readymadeOnShare. This module
// owns the shape of that envelope and the drain helper the app uses to pull the
// next unconsumed share.

/** A share captured by the iOS share extension, normalized for the pipeline. */
export type SharePayload = {
  id: string;
  /** Seconds since the Unix epoch. */
  receivedAt: number;
  url?: string;
  title?: string;
  text?: string;
  /**
   * Board chosen in the share extension's native picker. When present (and the
   * board still exists) the app skips its own picker and runs this board
   * directly; when absent the in-app picker asks.
   */
  boardName?: string;
};

declare global {
  interface Window {
    /** Envelopes delivered by native but not yet consumed by the app. */
    __READYMADE_SHARES__?: SharePayload[];
    /** Set by the app; native calls it after pushing a new envelope. */
    __readymadeOnShare?: (env: SharePayload) => void;
  }
}

/**
 * Remove and return the oldest queued share the native bridge delivered, or
 * null if the queue is empty. Draining (rather than peeking) guarantees a share
 * is handed to the picker exactly once even though native both pushes to the
 * array and fires the callback.
 */
export function drainNextShare(): SharePayload | null {
  const queue = window.__READYMADE_SHARES__;
  if (queue && queue.length > 0) {
    return queue.shift() ?? null;
  }
  return null;
}

/**
 * Mirror the current board names to the native shell (hkpShareBoards handler),
 * which persists them in the App Group so the share extension can offer a
 * native board picker. No-op outside the iOS shell.
 */
export function mirrorBoardsToNative(names: string[]): void {
  try {
    const webkit = (window as unknown as Record<string, any>).webkit;
    webkit?.messageHandlers?.hkpShareBoards?.postMessage({ boards: names });
  } catch {
    // Not running in the iOS shell — nothing to mirror.
  }
}
