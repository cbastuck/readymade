import { FacadeDescriptor, LayoutContainer, LayoutItem } from "../types";

// Path into the facade layout tree.
// path[0] = panel index; path[1..] = successive indices into .items at each level.
// e.g. [] = nothing selected; [0] = root layout of panel 0; [0, 1, 2] = panel 0 → items[1] → items[2]
export type EditorPath = number[];

function hasItems(item: LayoutItem): item is LayoutContainer {
  return "items" in item && Array.isArray((item as any).items);
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
    if (!hasItems(current)) {
      return null;
    }
    const next = current.items[path[i]];
    if (!next) {
      return null;
    }
    current = next;
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
    w.action?.serviceUuid ??
    w.source?.serviceUuid ??
    w.serviceId ??
    "";
  return extra ? `${w.type}  ·  ${extra}` : String(w.type);
}

// Returns true if a node is a container (has children).
export function nodeIsContainer(item: LayoutItem): boolean {
  return hasItems(item);
}

// Returns the children of a container node, or [] for leaves.
export function nodeChildren(item: LayoutItem): LayoutItem[] {
  if (hasItems(item)) {
    return item.items;
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
    if (!hasItems(item)) {
      return item;
    }
    return {
      ...item,
      items: item.items.map((child, i) =>
        i === indices[0] ? replaceAt(child, indices.slice(1)) : child,
      ),
    };
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
