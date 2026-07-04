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

/** User-chosen artwork for a board; boards without an entry get the
 *  deterministic name-derived gradient. */
export type BoardArt =
  | { kind: "color"; color: string }
  | { kind: "gradient"; from: string; to: string }
  | { kind: "image"; url: string };

export type StartPageTree = {
  version: 1;
  items: PersistedNode[];
  /** Artwork per board name — board-level, not per folder reference. */
  boardArt?: Record<string, BoardArt>;
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
  | { kind: "cloud-stored"; id: string; name: string }
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
  /** Cloud storage id, set on boards from the cloud board storage (the
   *  Shared source); enables the share management details. */
  cloudId?: string;
  /** The user's relation to the cloud-stored board. */
  cloudRole?: "owner" | "viewer";
  /** Share recipients (owner side); shown in the details column with a
   *  Revoke action per entry when the host provides onRevokeShare. */
  sharedWith?: string[];
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

// ── Board history ─────────────────────────────────────────────────────────────

/** One saved version of a board, shown in the details column's history list.
 *  `open` loads that version into the editor. */
export interface BoardHistoryItem {
  /** ISO 8601 */
  timestamp: string;
  /** e.g. "auto" | "manual" */
  label?: string;
  open: () => void;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  board: BoardNode;
  /** Folder names from root to the containing folder. */
  path: string[];
}
