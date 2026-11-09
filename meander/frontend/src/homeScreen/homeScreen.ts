// Web-side of pinning a board to the Home Screen. The native shells keep the
// pinned list and turn it into what their platform launches from: quick
// actions, a widget and a Shortcuts action on iOS, launcher shortcuts on
// Android. Everything here goes through hkp://home-screen/, which both shells
// serve (iOS through its scheme handler, Android through the fetch shim).
//
// A launch runs the other way: the shell keeps the board it was asked to open
// and calls window.__readymadeOnLaunch; the app then takes it from
// hkp://home-screen/launch. Taking rather than being handed the board is what
// makes a cold start work — the shell can be asked before the page exists,
// and the page asks once it does.

import type { PinnableAction } from "hkp-frontend/src/views/start";

/** A pinned board as the shells store it: `id` is a saved board's name or a
 *  demo's slug. */
export type Pin = {
  kind: PinnableAction["kind"];
  id: string;
  title: string;
};

/**
 * What pinning did to the Home Screen. `requested`: the platform asked the
 * person to place the icon (Android). `manual`: the board can be launched from
 * the app's quick actions, widget and shortcuts, and the person places it on
 * the Home Screen themselves (iOS has no way for an app to do it).
 */
export type HomeScreenPlacement = "requested" | "manual";

/**
 * Raised with the new list whenever this page changes the pins, so a list
 * shown elsewhere (usePins) follows a change it did not make — a board
 * deleted from the playground's Hub is unpinned there.
 */
export const PINS_CHANGED = "readymade:pins-changed";

/** Raised when a pin starts or stops opening as an app (opensAsApp). */
export const PINS_AS_APP_CHANGED = "readymade:pins-as-app-changed";

// A pin opens as an app unless the person said otherwise: what is kept is the
// pins that open with the board. How this person launches a board is kept
// beside the pins on this device rather than in the board. The shells' lists
// are not where it lives: nothing native reads it, and a change of it must not
// move the pin to the front of the list, as pinning again does.
const WITH_BOARD_KEY = "readymade:pins-with-board";

const keyOf = (pin: Pick<Pin, "kind" | "id">) => `${pin.kind}:${pin.id}`;

function readWithBoard(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(WITH_BOARD_KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
}

function writeWithBoard(keys: string[]) {
  try {
    localStorage.setItem(WITH_BOARD_KEY, JSON.stringify(keys));
  } catch {
    // Not kept: the pin goes on opening as an app.
  }
  window.dispatchEvent(new Event(PINS_AS_APP_CHANGED));
}

/** Whether launching the pinned board shows it as an app (app mode), which
 *  it does unless the person chose the board around it. A board without a
 *  facade has no app to show and opens with the board either way. */
export function opensAsApp(pin: Pick<Pin, "kind" | "id">): boolean {
  return !readWithBoard().includes(keyOf(pin));
}

export function setOpensAsApp(pin: Pick<Pin, "kind" | "id">, asApp: boolean) {
  const others = readWithBoard().filter((key) => key !== keyOf(pin));
  writeWithBoard(asApp ? others : [...others, keyOf(pin)]);
}

function announced(pins: Pin[]): Pin[] {
  window.dispatchEvent(new CustomEvent<Pin[]>(PINS_CHANGED, { detail: pins }));
  return pins;
}

declare global {
  interface Window {
    /** Set by the app; the shell calls it after it was asked to open a board. */
    __readymadeOnLaunch?: () => void;
  }
}

export function pinOf(action: PinnableAction, title: string): Pin {
  return action.kind === "saved"
    ? { kind: "saved", id: action.name, title }
    : { kind: "demo", id: action.slug, title };
}

export function actionOf(pin: Pick<Pin, "kind" | "id">): PinnableAction {
  return pin.kind === "saved"
    ? { kind: "saved", name: pin.id }
    : { kind: "demo", slug: pin.id };
}

export function samePin(a: Pick<Pin, "kind" | "id">, b: Pick<Pin, "kind" | "id">) {
  return a.kind === b.kind && a.id === b.id;
}

async function readPins(response: Response): Promise<Pin[]> {
  if (!response.ok) {
    throw new Error(await errorOf(response));
  }
  const body = (await response.json()) as { pins?: Pin[] };
  return body.pins ?? [];
}

async function errorOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) {
      return body.error;
    }
  } catch {
    // Not JSON: say what the status says.
  }
  return `The app could not change its pinned boards (${response.status})`;
}

export async function listPins(): Promise<Pin[]> {
  return readPins(await fetch("hkp://home-screen/pins"));
}

export async function addPin(
  pin: Pin,
): Promise<{ pins: Pin[]; placement: HomeScreenPlacement }> {
  const response = await fetch("hkp://home-screen/pins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pin),
  });
  if (!response.ok) {
    throw new Error(await errorOf(response));
  }
  const body = (await response.json()) as {
    pins?: Pin[];
    homeScreen?: HomeScreenPlacement;
  };
  return {
    pins: announced(body.pins ?? []),
    placement: body.homeScreen ?? "manual",
  };
}

export async function removePin(pin: Pick<Pin, "kind" | "id">): Promise<Pin[]> {
  const pins = await readPins(
    await fetch(
      `hkp://home-screen/pins/${pin.kind}/${encodeURIComponent(pin.id)}`,
      { method: "DELETE" },
    ),
  );
  // Pinned again later, it starts out opening as an app.
  if (!opensAsApp(pin)) {
    setOpensAsApp(pin, true);
  }
  return announced(pins);
}

/** The board the shell was last asked to open, once: taking it clears it. */
export async function takeLaunch(): Promise<Pick<Pin, "kind" | "id"> | null> {
  try {
    const response = await fetch("hkp://home-screen/launch", { method: "POST" });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      target?: Pick<Pin, "kind" | "id"> | null;
    };
    const target = body.target;
    return target && (target.kind === "saved" || target.kind === "demo")
      ? target
      : null;
  } catch {
    return null;
  }
}

/** Opens the Shortcuts app, where a pinned board becomes a Home Screen icon.
 *  iOS only; resolves false where the shell has no such route. */
export async function openShortcutsApp(): Promise<boolean> {
  try {
    const response = await fetch("hkp://home-screen/shortcuts", {
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}
