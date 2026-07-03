/**
 * Start page types.
 *
 * Two layers:
 *  - the persisted tree (StartPageTree) — the user's folder hierarchy, stored
 *    as JSON. Folders act like hierarchical tags: the same board name may be
 *    referenced from any number of folders.
 *  - the view tree (TreeNode) — what the column browser renders. It merges the
 *    persisted tree with live data (saved boards, demos, cloud boards,
 *    runtimes) that is computed per render and never stored.
 */

// ── Persisted model ───────────────────────────────────────────────────────────

export type PersistedBoardRef = { type: "board"; name: string };

export type PersistedFolder = {
  type: "folder";
  name: string;
  children: PersistedNode[];
};

export type PersistedNode = PersistedBoardRef | PersistedFolder;

export type StartPageTree = {
  version: 1;
  items: PersistedNode[];
};

// ── View model ────────────────────────────────────────────────────────────────

export type BoardState =
  | "running"
  | "needs-input"
  | "unreviewed"
  | "shared"
  | "saved"
  | "demo"
  | "recent"
  | "runtime";

/** What opening a board row means — resolved by the host via onOpen. */
export type BoardAction =
  | { kind: "saved"; name: string }
  | { kind: "demo"; slug: string }
  | { kind: "cloud"; coordinatorUrl: string; boardName: string }
  | { kind: "runtime"; name: string };

export interface BoardNode {
  type: "board";
  name: string;
  state: BoardState;
  action?: BoardAction;
  /** CSS background for the artwork tile; derived from the name when absent. */
  art?: string;
  /** Owner / origin shown in the subtitle (shared boards, runtime name, …). */
  by?: string;
  /** Explicit subtitle override; defaults to the state label. */
  sub?: string;
  /** Longer text for the details column; saved boards resolve it lazily via
   *  the host's describeBoard. */
  description?: string;
  /** Extra searchable terms (demo tags etc.). */
  tags?: string[];
  /** True when the row is a reference stored in the user's persisted tree
   *  (as opposed to a loose saved board or a virtual entry) — only those can
   *  be removed from their folder. */
  persisted?: boolean;
}

export interface FolderNode {
  type: "folder";
  name: string;
  children: TreeNode[];
  /** CSS background for the artwork tile; a neutral tile when absent. */
  art?: string;
  /** True for top-level connected sources (Runtimes, Cloud, …). */
  source?: boolean;
  /** Path (folder names) into the persisted user tree. Present only on
   *  user-managed folders — it is what makes a folder editable. */
  userPath?: string[];
  /** Message shown when the folder is empty (e.g. "Login required"). */
  emptyHint?: string;
}

export type TreeNode = BoardNode | FolderNode;

// ── News banner ───────────────────────────────────────────────────────────────

export interface NewsItem {
  tag: string;
  title: string;
  body: string;
  cta?: string;
  /** CSS background of the banner. */
  bg: string;
  onAction?: () => void;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  board: BoardNode;
  /** Folder names from root to the containing folder. */
  path: string[];
}
