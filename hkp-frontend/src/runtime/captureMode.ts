import { useSyncExternalStore } from "react";

/**
 * Capture mode: whether a board's call reports carry the values going into
 * and out of each service — what the flow inspector shows of a call.
 *
 * What passes between the services of a run is private; only what a board
 * outputs is public. So the values are sent only while someone building the
 * board asks to see them, and otherwise a report says only that a call
 * happened (`outgoingPayload` in `callReport.ts`). A builder's switch, not a
 * property of the board: held here, for this window, and never written into
 * a board document, so a board always opens with it off
 * (`plans/TODO-CAPTURE-MODE.md`).
 *
 * The browser runtime reads it as it reports (`serviceState.ts`); each remote
 * runtime is told by its scope (`RuntimeRestScope`), which follows it.
 */
let capturing = false;
const listeners = new Set<(on: boolean) => void>();

export function isCapturing(): boolean {
  return capturing;
}

export function setCapturing(on: boolean): void {
  if (on === capturing) {
    return;
  }
  capturing = on;
  for (const listener of [...listeners]) {
    listener(on);
  }
}

/** Calls `listener` whenever Capture mode changes; returns how to stop. */
export function onCaptureChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Capture mode, kept current in a component. */
export function useCapturing(): boolean {
  return useSyncExternalStore(onCaptureChange, isCapturing, isCapturing);
}
