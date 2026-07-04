import {
  BoardArt,
  BoardNode,
  BoardState,
  FolderNode,
  PersistedFolder,
  PersistedNode,
  SearchResult,
  StartPageTree,
  TreeNode,
} from "./types";

// ── Persisted tree ────────────────────────────────────────────────────────────

export const SCRATCHPAD_FOLDER = "Scratchpad";

export function defaultStartPageTree(): StartPageTree {
  return {
    version: 1,
    items: [{ type: "folder", name: SCRATCHPAD_FOLDER, children: [] }],
  };
}

function normalizeBoardArt(raw: unknown): BoardArt | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const art = raw as Record<string, unknown>;
  if (art.kind === "color" && typeof art.color === "string") {
    return { kind: "color", color: art.color };
  }
  if (
    art.kind === "gradient" &&
    typeof art.from === "string" &&
    typeof art.to === "string"
  ) {
    return { kind: "gradient", from: art.from, to: art.to };
  }
  if (art.kind === "image" && typeof art.url === "string") {
    return { kind: "image", url: art.url };
  }
  return null;
}

/** Accept whatever was stored and coerce it into a valid tree. */
export function normalizeStartPageTree(raw: unknown): StartPageTree {
  if (!raw || typeof raw !== "object") {
    return defaultStartPageTree();
  }
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return defaultStartPageTree();
  }

  const boardArt: Record<string, BoardArt> = {};
  const rawArt = (raw as { boardArt?: unknown }).boardArt;
  if (rawArt && typeof rawArt === "object") {
    for (const [name, value] of Object.entries(rawArt)) {
      const art = normalizeBoardArt(value);
      if (art) {
        boardArt[name] = art;
      }
    }
  }

  return {
    version: 1,
    items: items.map(normalizeNode).filter(isPersistedNode),
    ...(Object.keys(boardArt).length > 0 ? { boardArt } : {}),
  };
}

/** Sets (or clears, with null) the artwork of a board. */
export function setBoardArt(
  tree: StartPageTree,
  boardName: string,
  art: BoardArt | null,
): StartPageTree {
  const next = JSON.parse(JSON.stringify(tree)) as StartPageTree;
  const map = { ...(next.boardArt ?? {}) };
  if (art) {
    map[boardName] = art;
  } else {
    delete map[boardName];
  }
  if (Object.keys(map).length > 0) {
    next.boardArt = map;
  } else {
    delete next.boardArt;
  }
  return next;
}

/** CSS background for a BoardArt value. */
export function artCss(art: BoardArt): string {
  switch (art.kind) {
    case "color":
      return art.color;
    case "gradient":
      return gradient(art.from, art.to);
    case "image":
      return `url("${art.url}") center / cover no-repeat`;
  }
}

function normalizeNode(raw: unknown): PersistedNode | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const node = raw as { type?: unknown; name?: unknown; children?: unknown };
  if (typeof node.name !== "string" || node.name.length === 0) {
    return null;
  }
  if (node.type === "board") {
    return { type: "board", name: node.name };
  }
  if (node.type === "folder") {
    const children = Array.isArray(node.children)
      ? node.children.map(normalizeNode).filter(isPersistedNode)
      : [];
    return { type: "folder", name: node.name, children };
  }
  return null;
}

function isPersistedNode(node: PersistedNode | null): node is PersistedNode {
  return node !== null;
}

/** Resolve a folder-name path to its children array; null when it is gone. */
function resolveFolder(tree: StartPageTree, path: string[]): PersistedNode[] | null {
  let children = tree.items;
  for (const name of path) {
    const next = children.find(
      (n): n is PersistedFolder => n.type === "folder" && n.name === name,
    );
    if (!next) {
      return null;
    }
    children = next.children;
  }
  return children;
}

function cloneTree(tree: StartPageTree): StartPageTree {
  return JSON.parse(JSON.stringify(tree)) as StartPageTree;
}

export function addFolder(
  tree: StartPageTree,
  path: string[],
  name: string,
): StartPageTree {
  const next = cloneTree(tree);
  const children = resolveFolder(next, path);
  if (!children || children.some((n) => n.type === "folder" && n.name === name)) {
    return tree;
  }
  children.push({ type: "folder", name, children: [] });
  return next;
}

export function addBoardRef(
  tree: StartPageTree,
  path: string[],
  boardName: string,
): StartPageTree {
  const next = cloneTree(tree);
  const children = resolveFolder(next, path);
  if (!children || children.some((n) => n.type === "board" && n.name === boardName)) {
    return tree;
  }
  children.push({ type: "board", name: boardName });
  return next;
}

/** Remove a node (board ref or folder) from the folder at `path`. */
export function removeNode(
  tree: StartPageTree,
  path: string[],
  node: { type: "board" | "folder"; name: string },
): StartPageTree {
  const next = cloneTree(tree);
  const children = resolveFolder(next, path);
  if (!children) {
    return tree;
  }
  const index = children.findIndex(
    (n) => n.type === node.type && n.name === node.name,
  );
  if (index < 0) {
    return tree;
  }
  children.splice(index, 1);
  return next;
}

/** All board names referenced anywhere in the persisted tree. */
export function referencedBoards(tree: StartPageTree): Set<string> {
  const names = new Set<string>();
  const walk = (nodes: PersistedNode[]) => {
    for (const node of nodes) {
      if (node.type === "board") {
        names.add(node.name);
      } else {
        walk(node.children);
      }
    }
  };
  walk(tree.items);
  return names;
}

// ── View tree construction ────────────────────────────────────────────────────

/**
 * Build the "My Boards" view folder: the persisted hierarchy hydrated against
 * the actual saved boards, followed by all saved boards not filed anywhere.
 * Board refs whose board no longer exists are dropped from the view (the
 * persisted tree is left untouched).
 */
export function buildMyBoardsFolder(
  tree: StartPageTree,
  savedBoards: string[],
  boardStates: Record<string, BoardState> = {},
): FolderNode {
  const saved = new Set(savedBoards);
  const stateFor = (name: string): BoardState => boardStates[name] ?? "saved";
  const customArtFor = (name: string): string | undefined => {
    const art = tree.boardArt?.[name];
    return art ? artCss(art) : undefined;
  };

  const hydrate = (nodes: PersistedNode[], path: string[]): TreeNode[] =>
    nodes.flatMap<TreeNode>((node) => {
      if (node.type === "board") {
        if (!saved.has(node.name)) {
          return [];
        }
        return [
          {
            type: "board",
            name: node.name,
            state: stateFor(node.name),
            action: { kind: "saved", name: node.name },
            art: customArtFor(node.name),
            persisted: true,
          },
        ];
      }
      return [
        {
          type: "folder",
          name: node.name,
          userPath: [...path, node.name],
          children: hydrate(node.children, [...path, node.name]),
        },
      ];
    });

  const filed = referencedBoards(tree);
  const loose = savedBoards
    .filter((name) => !filed.has(name))
    .map<BoardNode>((name) => ({
      type: "board",
      name,
      state: stateFor(name),
      action: { kind: "saved", name },
      art: customArtFor(name),
    }));

  return {
    type: "folder",
    name: "My Boards",
    userPath: [],
    children: [...hydrate(tree.items, []), ...loose],
  };
}

// ── State presentation ────────────────────────────────────────────────────────

/** States that demand attention — these counts bubble up the folder tree. */
const ATTENTION: Partial<Record<BoardState, boolean>> = {
  running: true,
  "needs-input": true,
  unreviewed: true,
};

export function isAttentionState(state: BoardState): boolean {
  return ATTENTION[state] === true;
}

export interface StateMeta {
  dot: string;
  label: string;
}

export function stateMeta(state: BoardState): StateMeta {
  switch (state) {
    case "running":
      return { dot: "#17b877", label: "Running" };
    case "needs-input":
      return { dot: "#f2a417", label: "Needs input" };
    case "unreviewed":
      return { dot: "var(--hkp-accent, #3b5bff)", label: "New output" };
    case "shared":
      return { dot: "#e0355f", label: "Shared" };
    case "demo":
      return { dot: "#b06bff", label: "Demo" };
    case "recent":
      return { dot: "#8b90a0", label: "Recent" };
    case "runtime":
      return { dot: "#8b90a0", label: "Runtime" };
    case "saved":
    default:
      return { dot: "#b9bdc9", label: "Saved" };
  }
}

export function attentionCount(node: TreeNode): number {
  if (node.type === "board") {
    return isAttentionState(node.state) ? 1 : 0;
  }
  return node.children.reduce((sum, child) => sum + attentionCount(child), 0);
}

// ── Artwork ───────────────────────────────────────────────────────────────────

const ART_PALETTE: Array<[string, string]> = [
  ["#3b5bff", "#6a3bff"],
  ["#17b877", "#0a8a72"],
  ["#f2a417", "#c76a00"],
  ["#e0355f", "#a01040"],
  ["#2fb6c9", "#1f7d9a"],
  ["#b06bff", "#6a3bff"],
  ["#8ab020", "#4f6b00"],
  ["#5b5b6b", "#26262e"],
];

export function gradient(a: string, b: string, angle = 135): string {
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
}

/** Deterministic artwork for boards that don't bring their own. */
export function artFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const [a, b] = ART_PALETTE[Math.abs(hash) % ART_PALETTE.length];
  return gradient(a, b);
}

/** Splits a combined build version ("0.9.0.abc1234") into the version and the
 *  trailing hash segment, for the two-part top-bar badge. */
export function splitBuildVersion(combined: string): {
  version: string;
  hash?: string;
} {
  const lastDot = combined.lastIndexOf(".");
  if (lastDot <= 0) {
    return { version: combined };
  }
  return {
    version: combined.slice(0, lastDot),
    hash: combined.slice(lastDot + 1),
  };
}

/** Avatar initials from a username: "jane.doe" → "JD", "cbastuck" → "CB". */
export function initialsOf(username?: string): string | undefined {
  if (!username) {
    return undefined;
  }
  const words = username.split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? words[0].charAt(0) + words[1].charAt(0)
      : username.slice(0, 2);
  return letters.toUpperCase();
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Search all sources by board name, tags, and containing folder names
 * (folders act as tags). Deduplicates boards that live in several folders,
 * keeping the first hit's path.
 */
export function searchBoards(roots: TreeNode[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const walk = (nodes: TreeNode[], path: string[]) => {
    for (const node of nodes) {
      if (node.type === "folder") {
        walk(node.children, [...path, node.name]);
        continue;
      }
      const haystack = [node.name, ...(node.tags ?? []), ...path]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(q)) {
        continue;
      }
      const key = `${node.action?.kind ?? "board"}:${node.name}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push({ board: node, path });
    }
  };

  walk(roots, []);
  return results;
}
