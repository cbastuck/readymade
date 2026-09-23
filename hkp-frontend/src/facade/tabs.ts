import { FacadeDescriptor, FacadePanel, FacadeTab } from "./types";

/**
 * A facade's panels, arranged into the faces its tabs describe.
 *
 * The arithmetic is deliberately small and in one place, because both hosts —
 * the desktop renderer and the mobile one — have to arrive at the same answer
 * from the same board, and because the interesting decisions are here rather
 * than in either layout:
 *
 * - **A facade without tabs is unchanged.** Every panel is on screen, as one
 *   face that is never switched away from, so nothing about a board that has
 *   never heard of tabs goes through a different path.
 * - **A panel no tab claims is shared, not lost.** It sits above the tab bar and
 *   stays there whichever tab is chosen. A board that mis-spells a panel id
 *   therefore shows too much rather than silently dropping a panel, and a board
 *   that means to keep something always on screen has a way to say so.
 */

export type FacadeFace = { tab: FacadeTab; panels: FacadePanel[] };

export type FacadeFaces = {
  /** Panels on screen whatever is chosen. All of them, when there are no tabs. */
  shared: FacadePanel[];
  /** One entry per tab, in declared order. Empty when there are no tabs. */
  faces: FacadeFace[];
};

export function resolveFaces(facade: FacadeDescriptor): FacadeFaces {
  const tabs = facade.tabs ?? [];
  if (!tabs.length) {
    return { shared: facade.panels, faces: [] };
  }
  const byId = new Map(facade.panels.map((panel) => [panel.id, panel]));
  const claimed = new Set(tabs.flatMap((tab) => tab.panels));
  return {
    shared: facade.panels.filter((panel) => !claimed.has(panel.id)),
    faces: tabs.map((tab) => ({
      tab,
      // A tab naming a panel the facade no longer has is a board edited since;
      // it keeps whatever it does name rather than refusing to render.
      panels: tab.panels
        .map((id) => byId.get(id))
        .filter((panel): panel is FacadePanel => !!panel),
    })),
  };
}

/** The tab a board opens on: the one it names, else the first it declares. */
export function defaultFaceId(facade: FacadeDescriptor): string | null {
  const faces = facade.tabs ?? [];
  if (!faces.length) {
    return null;
  }
  const named = faces.find((tab) => tab.id === facade.defaultTab);
  return (named ?? faces[0]).id;
}

/** The face on screen, with a chosen tab that no longer exists falling back. */
export function currentFace(
  faces: FacadeFace[],
  chosen: string | null,
): FacadeFace | null {
  return faces.find((face) => face.tab.id === chosen) ?? faces[0] ?? null;
}
