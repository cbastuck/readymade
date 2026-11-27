import type { BindingSite } from "../bindings";
import {
  FacadeDescriptor,
  LayoutContainer,
  LayoutItem,
  RepeatWidget,
} from "../types";

// Path into the facade layout tree.
// path[0] = panel index; path[1..] = successive indices into .items (or 0 for repeat.template) at each level.
// e.g. [] = nothing selected; [0] = root layout of panel 0; [0, 1, 2] = panel 0 → items[1] → items[2]
export type EditorPath = number[];

function hasItems(item: LayoutItem): item is LayoutContainer {
  return (
    "items" in item &&
    Array.isArray((item as any).items) &&
    (!("type" in item) || (item as any).type !== "repeat")
  );
}

function isRepeat(item: LayoutItem): item is RepeatWidget {
  return (
    "type" in item &&
    item.type === "repeat" &&
    "template" in item &&
    Boolean((item as RepeatWidget).template)
  );
}

export function getAtPath(
  facade: FacadeDescriptor,
  path: EditorPath,
): LayoutItem | null {
  if (path.length === 0) {
    return null;
  }
  const panel = facade.panels[path[0]];
  if (!panel) {
    return null;
  }
  let current: LayoutItem = panel.layout;
  for (let i = 1; i < path.length; i++) {
    if (hasItems(current)) {
      const next = current.items[path[i]];
      if (!next) {
        return null;
      }
      current = next;
    } else if (isRepeat(current) && path[i] === 0) {
      current = current.template;
    } else {
      return null;
    }
  }
  return current;
}

// Returns the human-readable label shown in the tree for a node.
export function nodeLabel(item: LayoutItem): string {
  if (hasItems(item)) {
    const type = (item as any).type === "layout" ? "layout" : "container";
    return `${type}  ${(item as any).direction ?? ""}`;
  }
  const w = item as any;
  const extra =
    w.label ??
    w.placeholder ??
    w.action?.serviceUuid ??
    w.source?.serviceUuid ??
    w.serviceId ??
    "";
  return extra ? `${w.type}  ·  ${extra}` : String(w.type);
}

// Returns true if a node has child layout nodes in the tree.
export function nodeIsContainer(item: LayoutItem): boolean {
  return hasItems(item) || isRepeat(item);
}

// Returns the children of a container/repeat node, or [] for leaves.
export function nodeChildren(item: LayoutItem): LayoutItem[] {
  if (hasItems(item)) {
    return item.items;
  }
  if (isRepeat(item)) {
    return [item.template];
  }
  return [];
}

// Immutably replaces the node at the given path with updatedNode.
export function setAtPath(
  facade: FacadeDescriptor,
  path: EditorPath,
  updatedNode: LayoutItem,
): FacadeDescriptor {
  if (path.length === 0) {
    return facade;
  }

  const panelIdx = path[0];
  const itemIndices = path.slice(1);

  const replaceAt = (item: LayoutItem, indices: number[]): LayoutItem => {
    if (indices.length === 0) {
      return updatedNode;
    }
    if (hasItems(item)) {
      return {
        ...item,
        items: item.items.map((child, i) =>
          i === indices[0] ? replaceAt(child, indices.slice(1)) : child,
        ),
      };
    }
    if (isRepeat(item) && indices[0] === 0) {
      return {
        ...item,
        template: replaceAt(item.template, indices.slice(1)),
      };
    }
    return item;
  };

  return {
    ...facade,
    panels: facade.panels.map((panel, i) =>
      i !== panelIdx
        ? panel
        : { ...panel, layout: replaceAt(panel.layout, itemIndices) },
    ),
  };
}

/**
 * The binding site of the node at an editor path: its panel's id and its
 * position in the layout, with a repeat's template as "template" — the address
 * the facade's bindings and its rendered widgets use.
 */
export function siteOfPath(
  facade: FacadeDescriptor,
  path: EditorPath,
): Extract<BindingSite, { kind: "widget" }> | null {
  const panel = facade.panels[path[0]];
  const node = getAtPath(facade, path);
  if (!panel || !node) {
    return null;
  }
  const sitePath: (number | "template")[] = [];
  let current: LayoutItem = panel.layout;
  for (const step of path.slice(1)) {
    if (isRepeat(current)) {
      sitePath.push("template");
      current = current.template;
    } else if (hasItems(current)) {
      sitePath.push(step);
      current = current.items[step];
    }
  }
  const w = node as { type?: string; label?: unknown };
  return {
    kind: "widget",
    panel: panel.id,
    path: sitePath,
    type: w.type,
    label: typeof w.label === "string" ? w.label : undefined,
  };
}

/** The editor path of a binding site, or null where the facade has no such node. */
export function pathOfSite(
  facade: FacadeDescriptor,
  site: BindingSite,
): EditorPath | null {
  if (site.kind !== "widget") {
    return null;
  }
  const panelIndex = facade.panels.findIndex((p) => p.id === site.panel);
  if (panelIndex === -1) {
    return null;
  }
  const path: EditorPath = [panelIndex];
  for (const step of site.path) {
    path.push(step === "template" ? 0 : step);
  }
  return getAtPath(facade, path) ? path : null;
}

/**
 * What the editor has selected: one of the tree's root items, a panel, or a
 * node of a panel's layout.
 */
export type EditorSelection =
  | { kind: "panels" }
  | { kind: "state" }
  | { kind: "actions" }
  | { kind: "panel"; index: number }
  | { kind: "node"; path: EditorPath };

/** A key that is the same for the same selection, for effects and React keys. */
export function selectionKey(selection: EditorSelection): string {
  switch (selection.kind) {
    case "panel":
      return `panel:${selection.index}`;
    case "node":
      return `node:${selection.path.join(".")}`;
    default:
      return selection.kind;
  }
}
