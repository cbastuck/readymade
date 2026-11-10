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
