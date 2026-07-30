import {
  BoardArt,
  BoardNode,
  BoardSort,
  BoardState,
  FolderNode,
  PersistedFolder,
  PersistedNode,
  SavedBoardEntry,
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

/** One folder of the persisted tree, flattened for list rendering. */
export interface FolderOption {
  /** Folder names from the tree root down to this folder. */
  path: string[];
  name: string;
  /** Nesting level; 0 for top-level folders. */
  depth: number;
}

/** Stable key for a folder path (names may contain any character). */
export function folderKey(path: string[]): string {
  return path.join("\u0000");
}

/** All folders of the persisted tree, depth-first in tree order. */
export function listFolders(tree: StartPageTree): FolderOption[] {
  const options: FolderOption[] = [];
  const walk = (nodes: PersistedNode[], path: string[]) => {
    for (const node of nodes) {
      if (node.type !== "folder") {
        continue;
      }
      const here = [...path, node.name];
      options.push({ path: here, name: node.name, depth: path.length });
      walk(node.children, here);
    }
  };
  walk(tree.items, []);
  return options;
}

/** Paths of every folder the board is filed in. */
export function boardFolderPaths(
  tree: StartPageTree,
  boardName: string,
): string[][] {
  const paths: string[][] = [];
  const walk = (nodes: PersistedNode[], path: string[]) => {
    for (const node of nodes) {
      if (node.type === "board") {
        if (node.name === boardName && path.length > 0) {
          paths.push(path);
        }
        continue;
      }
      walk(node.children, [...path, node.name]);
    }
  };
  walk(tree.items, []);
  return paths;
}

/** Files (or unfiles) a board in the folder at `path`. */
export function setBoardFiled(
  tree: StartPageTree,
  path: string[],
  boardName: string,
  filed: boolean,
): StartPageTree {
  return filed
    ? addBoardRef(tree, path, boardName)
    : removeNode(tree, path, { type: "board", name: boardName });
}

// ── View tree construction ────────────────────────────────────────────────────

/** Virtual folder inside "My Boards" holding every saved board. */
export const ALL_BOARDS_FOLDER = "All Boards";

/**
 * Build the "My Boards" view folder: the virtual "All Boards" folder listing
 * every saved board (filed or not), followed by the persisted hierarchy
 * hydrated against the actual saved boards — so the top level stays a list of
 * folders. Board refs whose board no longer exists are dropped from the view
 * (the persisted tree is left untouched).
 */
export function buildMyBoardsFolder(
  tree: StartPageTree,
  savedBoards: SavedBoardEntry[],
  boardStates: Record<string, BoardState> = {},
  extraFolders: FolderNode[] = [],
): FolderNode {
  const saved = new Map(savedBoards.map((board) => [board.name, board]));
  const stateFor = (name: string): BoardState => boardStates[name] ?? "saved";
  const customArtFor = (name: string): string | undefined => {
    const art = tree.boardArt?.[name];
    return art ? artCss(art) : undefined;
  };

  const hydrate = (nodes: PersistedNode[], path: string[]): TreeNode[] =>
    nodes.flatMap<TreeNode>((node) => {
      if (node.type === "board") {
        const entry = saved.get(node.name);
        if (!entry) {
          return [];
        }
        return [
          {
            type: "board",
            name: node.name,
            state: stateFor(node.name),
            action: { kind: "saved", name: node.name },
            art: customArtFor(node.name),
            modified: entry.modified,
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

  const allBoards: FolderNode = {
    type: "folder",
    name: ALL_BOARDS_FOLDER,
    emptyHint: "No boards saved yet",
    children: savedBoards.map<BoardNode>(({ name, modified }) => ({
      type: "board",
      name,
      state: stateFor(name),
      action: { kind: "saved", name },
      art: customArtFor(name),
      modified,
    })),
  };

  return {
    type: "folder",
    name: "My Boards",
    userPath: [],
    // The flat "All Boards" view first, then the user's own hierarchy, then
    // the host's virtual folders (e.g. its cloud "Uploaded" view).
    children: [allBoards, ...hydrate(tree.items, []), ...extraFolders],
  };
}

// ── Ordering ──────────────────────────────────────────────────────────────────

/**
 * Order the rows of one column: folders keep their position (the user's own
 * arrangement), boards are sorted among themselves. Boards without a timestamp
 * sort last in "recent" mode and fall back to the name order.
 */
export function sortNodes(nodes: TreeNode[], sort: BoardSort): TreeNode[] {
  const byName = (a: TreeNode, b: TreeNode) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const timeOf = (node: TreeNode): number => {
    const raw = node.type === "board" ? node.modified : undefined;
    const time = raw ? new Date(raw).getTime() : NaN;
    return isNaN(time) ? -Infinity : time;
  };

  const boards = nodes
    .filter((node) => node.type === "board")
    .sort((a, b) =>
      sort === "recent" ? timeOf(b) - timeOf(a) || byName(a, b) : byName(a, b),
    );

  // Splice the sorted boards back into the slots the boards occupied, so any
  // folders (and runtime rows) stay where the source put them.
  let next = 0;
  return nodes.map((node) => (node.type === "board" ? boards[next++] : node));
}

/** A board's last-write time for the details panel; undefined when unknown. */
export function formatModified(iso: string | undefined): string | undefined {
  const date = parseDate(iso);
  return date?.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The same time compressed to a row subtitle: the year is dropped for dates
 *  in the current year, the clock time for older ones. */
export function formatModifiedShort(iso: string | undefined): string | undefined {
  const date = parseDate(iso);
  if (!date) {
    return undefined;
  }
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString(
    undefined,
    thisYear
      ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" },
  );
}

function parseDate(iso: string | undefined): Date | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  return isNaN(date.getTime()) ? undefined : date;
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
  if (node.type === "runtime") {
    return 0;
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
      if (node.type === "runtime") {
        // Live runtimes aren't part of board search (phase 1).
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
