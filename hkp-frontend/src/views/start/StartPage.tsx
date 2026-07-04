import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import "./start.css";

import {
  addBoardRef,
  addFolder,
  artFor,
  attentionCount,
  buildMyBoardsFolder,
  defaultStartPageTree,
  isAttentionState,
  removeNode,
  searchBoards,
  setBoardArt,
  stateMeta,
} from "./model";
import { downscaleImage } from "./imageUpload";
import { buildDemosFolder } from "./demosSource";
import { useCloudFolder } from "./useCloudSource";
import { DEFAULT_NEWS } from "./news";
import { StartPageStore } from "./store";
import {
  BoardAction,
  BoardHistoryItem,
  BoardNode,
  BoardState,
  FolderNode,
  NewsItem,
  StartPageTree,
  TreeNode,
} from "./types";
import TopBar from "./TopBar";
import NewsCarousel from "./NewsCarousel";
import ColumnBrowser from "./ColumnBrowser";
import { ColumnVM } from "./Column";
import { RowVM } from "./Row";
import BoardDetails from "./BoardDetails";

export interface RuntimeEntry {
  name: string;
  url?: string;
}

export interface StartPageProps {
  /** Persistence for the user's folder tree. */
  store: StartPageStore;
  /** Saved board names for "My Boards"; omit when the host has no storage. */
  listSavedBoards?: () => Promise<string[]>;
  /** Live board states keyed by board name (running / needs-input / …). */
  boardStates?: Record<string, BoardState>;
  /** Opens a board (saved / demo / cloud / runtime) — resolved by the host. */
  onOpen: (action: BoardAction) => void;
  /** Creates a new empty board. */
  onCreateBoard: () => void;
  /** Creates, persists, and opens a new empty board with the given name.
   *  Enables the "New board" control inside user folders — the module files
   *  the reference into the folder before calling this. */
  onCreateNamedBoard?: (name: string) => void;
  /** Name of the most recent board; shows "Continue recent" when set. */
  recentBoardName?: string | null;
  onContinueRecent?: () => void;
  /** Opens the host's load-board dialog / file picker. */
  onLoadBoard?: () => void;
  /** Resolves the description of a saved board for the details column. */
  describeBoard?: (name: string) => Promise<string | undefined>;
  /** Lists the saved versions of a board (with an open action each); enables
   *  the History section in the details column. */
  listBoardHistory?: (name: string) => Promise<BoardHistoryItem[]>;
  /** Deletes a saved board entirely; enables "Delete board" in the details
   *  column. The board list is refreshed afterwards. */
  onDeleteBoard?: (name: string) => void | Promise<void>;
  /** Uploads a (already downscaled) board artwork image and returns its URL;
   *  enables "Upload image…" in the details column's artwork editor. */
  uploadBoardArt?: (boardName: string, image: Blob) => Promise<string>;
  /** Uploads a saved board to the user's cloud storage; enables the
   *  "Upload to cloud" action in the details column. Hosts pass it for
   *  logged-in users only. */
  uploadBoardToCloud?: (boardName: string) => Promise<void>;
  /** Revokes a share recipient's access to one of the user's cloud-stored
   *  boards; applies to boards with cloudRole "owner" and a sharedWith list
   *  (the Shared → From me source). */
  onRevokeShare?: (board: BoardNode, email: string) => Promise<void>;
  /** Removes the user from a board shared with them; applies to boards with
   *  cloudRole "viewer" (the Shared → With me source). */
  onLeaveShare?: (board: BoardNode) => Promise<void>;
  /** Native image picker replacing the <input type="file"> flow — required in
   *  webviews without file-input support (Meander desktop). */
  pickBoardArtImage?: () => Promise<Blob | null>;
  /** Runtimes surfaced as a source folder (external instances). */
  runtimes?: RuntimeEntry[];
  /** Show the Cloud source (requires AppContext + coordinators). */
  withCloud?: boolean;
  /** Additional host-provided sources appended after the built-in ones. */
  extraSources?: FolderNode[];
  /** Demo entries with any of these tags are hidden (e.g. "iOS only"). */
  excludeDemoTags?: string[];
  news?: NewsItem[];
  title?: string;
  badge?: string;
  /** Secondary, smaller part of the badge chip (e.g. the build hash). */
  badgeDetail?: string;
  logo?: ReactNode;
  initials?: string;
  /** Avatar click action: log in while logged out, log out while logged in. */
  onAvatarClick?: () => void;
  avatarTitle?: string;
  /** Rightmost slot in the top bar (host app menu etc.). */
  menuSlot?: ReactNode;
}

const COLUMN_WIDTH_ROOT = "236px";
const COLUMN_WIDTH = "300px";

// Where the user last browsed to, as a path of node names. Names (not indices)
// survive the tree changing between visits; unresolvable tails are dropped
// during rendering.
const SELECTION_STORAGE_KEY = "hkp-startpage-selection";

function restoreSelection(): string[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SELECTION_STORAGE_KEY) ?? "",
    ) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((name) => typeof name === "string")
    ) {
      return parsed;
    }
  } catch {
    // fall through to the default
  }
  return ["Demos"];
}

export default function StartPage(props: StartPageProps) {
  const {
    store,
    listSavedBoards,
    boardStates,
    onOpen,
    onCreateBoard,
    onCreateNamedBoard,
    recentBoardName,
    onContinueRecent,
    onLoadBoard,
    describeBoard,
    listBoardHistory,
    onDeleteBoard,
    uploadBoardArt,
    uploadBoardToCloud,
    onRevokeShare,
    onLeaveShare,
    pickBoardArtImage,
    runtimes,
    withCloud,
    extraSources,
    excludeDemoTags,
    news,
    title = "Boards",
    badge,
    badgeDetail,
    logo,
    initials,
    onAvatarClick,
    avatarTitle,
    menuSlot,
  } = props;

  const [tree, setTree] = useState<StartPageTree | null>(null);
  const [savedBoards, setSavedBoards] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>(restoreSelection);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    void store.load().then((loaded) => setTree(loaded ?? defaultStartPageTree()));
  }, [store]);

  const refreshSavedBoards = useCallback(() => {
    if (listSavedBoards) {
      void listSavedBoards().then(setSavedBoards).catch(() => setSavedBoards([]));
    }
  }, [listSavedBoards]);

  useEffect(refreshSavedBoards, [refreshSavedBoards]);

  const selectAt = useCallback((level: number, name: string) => {
    setSelectedNames((prev) => {
      const next = prev.slice(0, level);
      next[level] = name;
      localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateTree = useCallback(
    (next: StartPageTree) => {
      setTree(next);
      void store.save(next);
    },
    [store],
  );

  // ── Sources (root folders) ──────────────────────────────────────────────────

  const cloudFolder = useCloudFolder(withCloud === true);

  const roots = useMemo<TreeNode[]>(() => {
    const list: TreeNode[] = [];
    list.push(buildDemosFolder({ excludeTags: excludeDemoTags }));
    list.push(
      buildMyBoardsFolder(tree ?? defaultStartPageTree(), savedBoards, boardStates),
    );
    if (withCloud) {
      list.push(cloudFolder);
    }
    if (runtimes && runtimes.length > 0) {
      list.push({
        type: "folder",
        name: "Runtimes",
        source: true,
        children: runtimes.map<BoardNode>((rt) => ({
          type: "board",
          name: rt.name,
          state: "runtime",
          sub: rt.url ?? "Runtime",
          action: { kind: "runtime", name: rt.name },
        })),
      });
    }
    for (const source of extraSources ?? []) {
      list.push(source);
    }
    return list;
  }, [
    tree,
    savedBoards,
    boardStates,
    excludeDemoTags,
    withCloud,
    cloudFolder,
    runtimes,
    extraSources,
  ]);

  // ── Row / column view models ────────────────────────────────────────────────

  const rowVM = useCallback(
    (
      node: TreeNode,
      opts: {
        key: string;
        selected: boolean;
        onClick: () => void;
        parentPath?: string[];
        subOverride?: string;
      },
    ): RowVM => {
      if (node.type === "board") {
        const meta = stateMeta(node.state);
        const attention = isAttentionState(node.state);
        const sub =
          opts.subOverride ??
          node.sub ??
          (node.by ? `${meta.label} · ${node.by}` : meta.label);
        return {
          key: opts.key,
          name: node.name,
          art: node.art ?? artFor(node.name),
          glyph: "",
          isBoard: true,
          dot: attention,
          dotColor: meta.dot,
          sub,
          subColor: attention ? meta.dot : "#9a9fae",
          badge: "",
          selected: opts.selected,
          onClick: opts.onClick,
          onOpen: node.action
            ? (e) => {
                e.stopPropagation();
                onOpen(node.action!);
              }
            : undefined,
          onRemove:
            opts.parentPath && tree
              ? (e) => {
                  e.stopPropagation();
                  updateTree(
                    removeNode(tree, opts.parentPath!, {
                      type: "board",
                      name: node.name,
                    }),
                  );
                }
              : undefined,
        };
      }

      const count = node.children.length;
      const badgeCount = attentionCount(node);
      return {
        key: opts.key,
        name: node.name,
        art:
          node.art ??
          (node.source
            ? "linear-gradient(160deg, #3a3d4a, #14161c)"
            : "linear-gradient(160deg, #eef0f4, #dfe2ea)"),
        glyph: node.name.charAt(0).toUpperCase(),
        isBoard: false,
        dot: false,
        dotColor: "#fff",
        sub:
          opts.subOverride ??
          (count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`),
        subColor: "#9a9fae",
        badge: badgeCount ? String(badgeCount) : "",
        selected: opts.selected,
        onClick: opts.onClick,
        onRemove:
          node.userPath && node.userPath.length > 0 && tree
            ? (e) => {
                e.stopPropagation();
                updateTree(
                  removeNode(tree, node.userPath!.slice(0, -1), {
                    type: "folder",
                    name: node.name,
                  }),
                );
              }
            : undefined,
      };
    },
    [tree, updateTree, onOpen],
  );

  const { columns, breadcrumb, detail } = useMemo(() => {
    const cols: ColumnVM[] = [];
    const crumbs: string[] = [];
    let items = roots;
    let parent: FolderNode | null = null;
    let level = 0;
    let detailBoard: { board: BoardNode; parentPath?: string[] } | null = null;

    while (true) {
      const selectedName = selectedNames[level];
      const sel =
        selectedName != null
          ? items.findIndex((node) => node.name === selectedName)
          : -1;
      const capturedLevel = level;
      const editablePath = level === 0 ? undefined : parent?.userPath;

      cols.push({
        key: `col${level}-${parent ? parent.name : "root"}`,
        title: level === 0 ? "Sources" : parent?.name ?? "Folder",
        width: level === 0 ? COLUMN_WIDTH_ROOT : COLUMN_WIDTH,
        emptyHint: parent?.emptyHint,
        items: items.map((node, index) =>
          rowVM(node, {
            key: `${node.type}-${node.name}-${index}`,
            selected: sel === index,
            onClick: () => selectAt(capturedLevel, node.name),
            // Only board refs stored in the persisted tree can be unfiled;
            // folder rows carry their own userPath-based removal.
            parentPath:
              node.type === "board" && node.persisted ? editablePath : undefined,
          }),
        ),
        onNewFolder:
          editablePath && tree
            ? (name) => updateTree(addFolder(tree, editablePath, name))
            : undefined,
        onNewBoard:
          editablePath && tree && onCreateNamedBoard
            ? (name) => {
                updateTree(addBoardRef(tree, editablePath, name));
                // A board of that name may already exist — file and open it
                // instead of overwriting.
                if (savedBoards.includes(name)) {
                  onOpen({ kind: "saved", name });
                } else {
                  onCreateNamedBoard(name);
                }
              }
            : undefined,
      });

      const selected = sel >= 0 ? items[sel] : null;
      if (selected && selected.type === "folder") {
        crumbs.push(selected.name);
        parent = selected;
        items = selected.children;
        level++;
      } else {
        if (selected && selected.type === "board") {
          detailBoard = {
            board: selected,
            parentPath: selected.persisted ? editablePath : undefined,
          };
        }
        break;
      }
    }

    return {
      columns: cols,
      breadcrumb: crumbs.length ? crumbs.join("  ›  ") : "Sources",
      detail: detailBoard,
    };
  }, [
    roots,
    selectedNames,
    selectAt,
    rowVM,
    tree,
    updateTree,
    savedBoards,
    onCreateNamedBoard,
    onOpen,
  ]);

  const searchResults = useMemo<RowVM[]>(() => {
    return searchBoards(roots, searchQuery).map((result, index) =>
      rowVM(result.board, {
        key: `search-${result.board.name}-${index}`,
        selected: false,
        onClick: () => {
          if (result.board.action) {
            onOpen(result.board.action);
          }
        },
        subOverride: result.path.join(" › ") || undefined,
      }),
    );
  }, [roots, searchQuery, rowVM, onOpen]);

  // ── Details column ──────────────────────────────────────────────────────────

  const [detailDescription, setDetailDescription] = useState<string | undefined>();

  useEffect(() => {
    const board = detail?.board;
    setDetailDescription(board?.description);
    if (
      !board ||
      board.description ||
      board.action?.kind !== "saved" ||
      !describeBoard
    ) {
      return;
    }
    let cancelled = false;
    void describeBoard(board.action.name)
      .then((desc) => {
        if (!cancelled) {
          setDetailDescription(desc);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Keyed by the board identity, not the (per-render) detail object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.board.name, detail?.board.action?.kind, describeBoard]);

  // The artwork editor applies to the user's own (saved) boards only.
  const detailIsSaved = detail?.board.action?.kind === "saved";

  const detailNode = detail ? (
    <BoardDetails
      key={detail.board.name}
      board={detail.board}
      description={detailDescription}
      art={detailIsSaved ? tree?.boardArt?.[detail.board.name] : undefined}
      onChangeArt={
        detailIsSaved && tree
          ? (art) => updateTree(setBoardArt(tree, detail.board.name, art))
          : undefined
      }
      onUploadImage={
        detailIsSaved && tree && uploadBoardArt
          ? async (file) => {
              const image = await downscaleImage(file);
              const url = await uploadBoardArt(detail.board.name, image);
              updateTree(
                setBoardArt(tree, detail.board.name, { kind: "image", url }),
              );
            }
          : undefined
      }
      pickImage={pickBoardArtImage}
      onOpen={
        detail.board.action ? () => onOpen(detail.board.action!) : undefined
      }
      onUploadToCloud={
        detailIsSaved && uploadBoardToCloud
          ? () => uploadBoardToCloud(detail.board.name)
          : undefined
      }
      onRevokeShare={
        detail.board.cloudRole === "owner" && onRevokeShare
          ? (email) => onRevokeShare(detail.board, email)
          : undefined
      }
      onLeaveShare={
        detail.board.cloudRole === "viewer" && onLeaveShare
          ? () => onLeaveShare(detail.board)
          : undefined
      }
      loadHistory={
        detailIsSaved && listBoardHistory
          ? () => listBoardHistory(detail.board.name)
          : undefined
      }
      onRemoveFromFolder={
        detail.parentPath && tree
          ? () =>
              updateTree(
                removeNode(tree, detail.parentPath!, {
                  type: "board",
                  name: detail.board.name,
                }),
              )
          : undefined
      }
      onDelete={
        detail.board.action?.kind === "saved" && onDeleteBoard
          ? () => {
              void Promise.resolve(
                onDeleteBoard((detail.board.action as { name: string }).name),
              ).then(refreshSavedBoards);
            }
          : undefined
      }
    />
  ) : undefined;

  // ── Render ──────────────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#f4f5f7",
    color: "#14161c",
    overflow: "hidden",
    fontFamily: "var(--hkp-start-font, 'DM Sans'), system-ui, sans-serif",
  };

  return (
    <div className="hkp-start" style={rootStyle}>
      <TopBar
        title={title}
        badge={badge}
        badgeDetail={badgeDetail}
        logo={logo}
        initials={initials}
        onAvatarClick={onAvatarClick}
        avatarTitle={avatarTitle}
        recentBoardName={recentBoardName}
        onContinueRecent={onContinueRecent}
        onLoadBoard={onLoadBoard}
        onCreateBoard={onCreateBoard}
        menuSlot={menuSlot}
      />
      <NewsCarousel items={news ?? DEFAULT_NEWS} />
      <ColumnBrowser
        columns={columns}
        breadcrumb={breadcrumb}
        searchQuery={searchQuery}
        onSearchQuery={setSearchQuery}
        searchResults={searchResults}
        detail={detailNode}
      />
    </div>
  );
}
