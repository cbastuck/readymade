import { FacadePanel } from "./types";

/**
 * A facade's master/detail relations, resolved once for both hosts.
 *
 * Like the tab arithmetic beside it, the decisions are kept here rather than in
 * either layout, because the desktop renderer and the mobile one have to agree
 * on which panels are details from the same board:
 *
 * - **A detail needs a master to come back to.** `detailOf` naming a panel the
 *   facade does not have, or naming itself, is ignored, and the panel is shown
 *   like any other.
 * - **A chain has to end somewhere.** Panels that are each other's detail have
 *   no master to open over, so none of them is a detail — otherwise a mis-typed
 *   pair would hide both panels for good.
 */

/**
 * The details a panel is reached through, outermost first and ending with the
 * panel itself: the panels a reader steps back through to its root master.
 * Empty for a panel that is not a detail.
 */
export function detailChain(panels: FacadePanel[], id: string): string[] {
  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current?.detailOf && byId.has(current.detailOf)) {
    if (seen.has(current.id)) {
      return [];
    }
    seen.add(current.id);
    chain.unshift(current.id);
    current = byId.get(current.detailOf);
  }
  return chain;
}

/** Whether a panel opens over its master rather than sitting beside it. */
export function isDetail(panels: FacadePanel[], id: string): boolean {
  return detailChain(panels, id).length > 0;
}

/** The panel at the bottom of a detail's chain — the one it was opened from. */
export function rootMasterOf(panels: FacadePanel[], id: string): string {
  const chain = detailChain(panels, id);
  if (!chain.length) {
    return id;
  }
  return panels.find((panel) => panel.id === chain[0])?.detailOf ?? id;
}
