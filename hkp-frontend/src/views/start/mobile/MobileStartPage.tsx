import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { M } from "../../playground/mobile/tokens";
import MobileIcon from "../../playground/mobile/MobileIcon";
import BottomSheet from "../../playground/mobile/BottomSheet";
import {
  addBoardRef,
  addFolder,
  artFor,
  removeNode,
  searchBoards,
} from "../model";
import { DEFAULT_NEWS } from "../news";
import { useStartPageModel } from "../useStartPageModel";
import type { StartPageProps } from "../StartPage";
import { BoardNode, FolderNode, NewsItem } from "../types";
import { BoardRow, FolderRow } from "./MobileRows";
import MobileBoardDetails from "./MobileBoardDetails";
import ManageRemotesSheet from "./ManageRemotesSheet";
import NameSheet from "./NameSheet";

// ── Page transition (subtle slide-in on push/pop) ─────────────────────────────

function Slide({ id, children }: { id: string; children: ReactNode }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [id]);

  return (
    <div
      style={{
        transform: entered ? "none" : "translateX(16px)",
        opacity: entered ? 1 : 0,
        transition: "transform 0.22s ease, opacity 0.22s ease",
      }}
    >
      {children}
    </div>
  );
}

// ── News strip ────────────────────────────────────────────────────────────────

function NewsStrip({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollSnapType: "x mandatory",
        padding: "0 16px",
        // Hide the scrollbar-induced jump on iOS; cards keep their shadow room.
        paddingBottom: 4,
      }}
    >
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          onClick={item.onAction}
          style={{
            flex: "0 0 auto",
            width: "78%",
            maxWidth: 340,
            scrollSnapAlign: "start",
            borderRadius: 16,
            background: item.bg,
            color: "#fff",
            padding: "14px 16px",
            boxSizing: "border-box",
            cursor: item.onAction ? "pointer" : "default",
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "rgba(255,255,255,0.22)",
              borderRadius: 6,
              padding: "3px 7px",
            }}
          >
            {item.tag}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>
            {item.title}
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              marginTop: 4,
              opacity: 0.9,
            }}
          >
            {item.body}
          </div>
          {item.cta && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginTop: 10,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {item.cta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: M.textMuted,
        padding: "0 4px 8px",
      }}
    >
      {title}
    </div>
  );
}

// ── Navigation resolution ─────────────────────────────────────────────────────

interface ResolvedNav {
  /** Folder chain from root; pages[0] is the (virtual) root. */
  pages: Array<{ folder: FolderNode | null }>;
  /** Set when the path ends on a board — the pushed details page. */
  detail: { board: BoardNode; parentPath?: string[] } | null;
  /** The path with any unresolvable tail dropped. */
  resolvedPath: string[];
}

/**
 * The mobile start page: the desktop column browser translated into a
 * drill-down navigation (sources → folders → board details as pushed pages),
 * styled with the mobile playground's design tokens.
 *
 * Accepts the same props as the desktop StartPage; the artwork-editing props
 * (uploadBoardArt, pickBoardArtImage) are not surfaced on mobile.
 */
export default function MobileStartPage(props: StartPageProps) {
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
    uploadBoardToCloud,
    onRevokeShare,
    onLeaveShare,
    runtimes,
    manageRemotes,
    withCloud,
    extraSources,
    myBoardsExtraFolders,
    excludeDemoTags,
    news,
    title = "Boards",
    badge,
    badgeDetail,
    initials,
    onAvatarClick,
    avatarTitle,
    menuSlot,
  } = props;

  const { tree, updateTree, roots, savedBoards, refreshSavedBoards } =
    useStartPageModel({
      store,
      listSavedBoards,
      boardStates,
      runtimes,
      withCloud,
      extraSources,
      myBoardsExtraFolders,
      excludeDemoTags,
    });

  const [path, setPath] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [remotesSheetOpen, setRemotesSheetOpen] = useState(false);
  const [nameSheet, setNameSheet] = useState<null | "folder" | "board">(null);

  const nav = useMemo<ResolvedNav>(() => {
    const pages: ResolvedNav["pages"] = [{ folder: null }];
    const resolvedPath: string[] = [];
    let items = roots;
    let parent: FolderNode | null = null;
    let detail: ResolvedNav["detail"] = null;

    for (const name of path) {
      const node = items.find((n) => n.name === name);
      if (!node) {
        break;
      }
      resolvedPath.push(name);
      if (node.type === "folder") {
        parent = node;
        items = node.children;
        pages.push({ folder: node });
      } else if (node.type === "board") {
        detail = {
          board: node,
          parentPath: node.persisted ? parent?.userPath : undefined,
        };
        break;
      } else {
        // Runtime nodes aren't navigable on mobile yet (desktop-only source).
        break;
      }
    }
    return { pages, detail, resolvedPath };
  }, [roots, path]);

  const currentFolder = nav.pages[nav.pages.length - 1].folder;
  // Folders inside the persisted user tree carry a userPath — only those can
  // gain new children (mirrors the desktop columns' editablePath).
  const editablePath = currentFolder?.userPath;

  const push = (name: string) => {
    setPath([...nav.resolvedPath, name]);
  };
  const pop = () => {
    setPath(nav.resolvedPath.slice(0, -1));
  };

  // ── Details page wiring ─────────────────────────────────────────────────────

  const detail = nav.detail;
  const [detailDescription, setDetailDescription] = useState<
    string | undefined
  >();

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

  const detailIsSaved = detail?.board.action?.kind === "saved";

  // ── Search ──────────────────────────────────────────────────────────────────

  const searchResults = useMemo(
    () => searchBoards(roots, searchQuery),
    [roots, searchQuery],
  );

  // ── Header ──────────────────────────────────────────────────────────────────

  const atRoot = nav.pages.length === 1 && !detail;
  const headerTitle = detail
    ? detail.board.name
    : currentFolder
      ? currentFolder.name
      : title;
  const backLabel = detail
    ? (currentFolder?.name ?? title)
    : nav.pages.length > 2
      ? nav.pages[nav.pages.length - 2].folder!.name
      : title;

  const iconButtonStyle: CSSProperties = {
    width: 34,
    height: 34,
    border: "none",
    background: "rgba(0,0,0,0.06)",
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: M.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: M.textPrimary,
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          background: "rgba(242,237,232,0.92)",
          backdropFilter: "blur(12px)",
          paddingTop: "max(10px, env(safe-area-inset-top))",
          paddingBottom: 10,
          paddingLeft: 16,
          paddingRight: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${M.border}`,
          flexShrink: 0,
          minHeight: 44,
          boxSizing: "content-box",
        }}
      >
        {atRoot ? (
          <>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </span>
              {badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: M.textMuted,
                    background: "rgba(0,0,0,0.06)",
                    borderRadius: 6,
                    padding: "2px 6px",
                    flexShrink: 0,
                  }}
                >
                  {badge}
                  {badgeDetail && (
                    <span style={{ fontWeight: 500, opacity: 0.7 }}>
                      {" "}
                      {badgeDetail}
                    </span>
                  )}
                </span>
              )}
            </div>
            {manageRemotes && (
              <button
                title="Manage remotes"
                aria-label="Manage remotes"
                onClick={() => {
                  manageRemotes.refresh?.();
                  setRemotesSheetOpen(true);
                }}
                style={iconButtonStyle}
              >
                <MobileIcon name="server" size={16} color={M.textSecondary} />
              </button>
            )}
            {(initials || onAvatarClick) && (
              <button
                title={avatarTitle}
                aria-label={avatarTitle ?? "Account"}
                onClick={onAvatarClick}
                style={{
                  ...iconButtonStyle,
                  borderRadius: "50%",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                {initials ?? <MobileIcon name="user" size={15} color="#fff" />}
              </button>
            )}
            {menuSlot}
          </>
        ) : (
          <>
            <button
              onClick={pop}
              aria-label="Back"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                border: "none",
                background: "none",
                padding: "4px 4px 4px 0",
                cursor: "pointer",
                color: M.teal,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "inherit",
                flexShrink: 0,
                maxWidth: "40%",
              }}
            >
              <MobileIcon name="chevronLeft" size={18} color={M.teal} />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {backLabel}
              </span>
            </button>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "center",
                fontSize: 15,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {headerTitle}
            </div>
            {editablePath && !detail ? (
              <button
                onClick={() => setAddSheetOpen(true)}
                aria-label="Add"
                style={iconButtonStyle}
              >
                <MobileIcon name="plus" size={16} color={M.textSecondary} />
              </button>
            ) : (
              // Keeps the title centered against the back button.
              <div style={{ width: 34, flexShrink: 0 }} />
            )}
          </>
        )}
      </div>

      {/* ── Content ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {detail ? (
          <Slide id={`detail-${detail.board.name}`}>
            <MobileBoardDetails
              key={detail.board.name}
              board={detail.board}
              description={detailDescription}
              onOpen={
                detail.board.action
                  ? () => onOpen(detail.board.action!)
                  : undefined
              }
              onUploadToCloud={
                detailIsSaved && uploadBoardToCloud
                  ? () => uploadBoardToCloud(detail.board.name)
                  : undefined
              }
              onRemoveFromFolder={
                detail.parentPath && tree
                  ? () => {
                      updateTree(
                        removeNode(tree, detail.parentPath!, {
                          type: "board",
                          name: detail.board.name,
                        }),
                      );
                      pop();
                    }
                  : undefined
              }
              onDelete={
                detail.board.action?.kind === "saved" && onDeleteBoard
                  ? () => {
                      void Promise.resolve(
                        onDeleteBoard(
                          (detail.board.action as { name: string }).name,
                        ),
                      ).then(() => {
                        refreshSavedBoards();
                        pop();
                      });
                    }
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
            />
          </Slide>
        ) : atRoot ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              padding: "16px 0 calc(24px + env(safe-area-inset-bottom))",
            }}
          >
            {/* Quick actions */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "0 16px",
              }}
            >
              {recentBoardName && onContinueRecent && (
                <button
                  onClick={onContinueRecent}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: M.card,
                    border: `1px solid ${M.border}`,
                    borderRadius: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: artFor(recentBoardName),
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: M.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {recentBoardName}
                    </div>
                    <div
                      style={{ fontSize: 11, color: M.textMuted, marginTop: 1 }}
                    >
                      Continue where you left off
                    </div>
                  </div>
                  <MobileIcon
                    name="chevronRight"
                    size={14}
                    color={M.textMuted}
                  />
                </button>
              )}
              <NewsStrip items={news ?? DEFAULT_NEWS} />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={onCreateBoard}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "14px",
                    background: M.teal,
                    border: "none",
                    borderRadius: 12,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <MobileIcon
                    name="plus"
                    size={15}
                    color="#fff"
                    strokeWidth={2.2}
                  />
                  New board
                </button>
                {onLoadBoard && (
                  <button
                    onClick={onLoadBoard}
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      background: M.card,
                      border: `1px solid ${M.border}`,
                      borderRadius: 12,
                      color: M.textPrimary,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Load board
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: "0 16px" }}>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 12,
                    top: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <MobileIcon name="search" size={15} color={M.textMuted} />
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search boards"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px 11px 36px",
                    borderRadius: 12,
                    border: `1px solid ${M.border}`,
                    background: M.card,
                    color: M.textPrimary,
                    // >= 16px so iOS Safari does not auto-zoom into the field.
                    fontSize: 16,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {searchQuery.trim() ? (
              <div style={{ padding: "0 16px" }}>
                <SectionHeader
                  title={
                    searchResults.length === 0
                      ? "No results"
                      : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}`
                  }
                />
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {searchResults.map((result, index) => (
                    <BoardRow
                      key={`search-${result.board.name}-${index}`}
                      board={result.board}
                      subOverride={result.path.join(" › ") || undefined}
                      onTap={() => {
                        if (result.board.action) {
                          onOpen(result.board.action);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Sources */}
                <div style={{ padding: "0 16px" }}>
                  <SectionHeader title="Sources" />
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {roots.map((node, index) =>
                      node.type === "folder" ? (
                        <FolderRow
                          key={`root-${node.name}-${index}`}
                          folder={node}
                          onTap={() => push(node.name)}
                        />
                      ) : node.type === "board" ? (
                        <BoardRow
                          key={`root-${node.name}-${index}`}
                          board={node}
                          onTap={() => push(node.name)}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Slide id={`folder-${nav.resolvedPath.join("/")}`}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "16px 16px calc(24px + env(safe-area-inset-bottom))",
              }}
            >
              {currentFolder!.children.length === 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: M.textMuted,
                    fontStyle: "italic",
                    padding: "8px 4px",
                    lineHeight: 1.5,
                  }}
                >
                  {currentFolder!.emptyHint ?? "Empty"}
                </div>
              )}
              {currentFolder!.children.map((node, index) =>
                node.type === "folder" ? (
                  <FolderRow
                    key={`${node.name}-${index}`}
                    folder={node}
                    onTap={() => push(node.name)}
                    onRemove={
                      node.userPath && node.userPath.length > 0 && tree
                        ? () =>
                            updateTree(
                              removeNode(tree, node.userPath!.slice(0, -1), {
                                type: "folder",
                                name: node.name,
                              }),
                            )
                        : undefined
                    }
                  />
                ) : node.type === "board" ? (
                  <BoardRow
                    key={`${node.name}-${index}`}
                    board={node}
                    onTap={() => push(node.name)}
                    onRemove={
                      node.persisted && editablePath && tree
                        ? () =>
                            updateTree(
                              removeNode(tree, editablePath, {
                                type: "board",
                                name: node.name,
                              }),
                            )
                        : undefined
                    }
                  />
                ) : null,
              )}
            </div>
          </Slide>
        )}
      </div>

      {/* ── Add to folder (chooser + name input) ── */}
      <BottomSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        title={`Add to “${currentFolder?.name ?? ""}”`}
        height="auto"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingBottom: 8,
          }}
        >
          <button
            onClick={() => {
              setAddSheetOpen(false);
              setNameSheet("folder");
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              borderRadius: 12,
              border: `1px solid ${M.border}`,
              background: M.bg,
              color: M.textPrimary,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            New folder
          </button>
          {onCreateNamedBoard && (
            <button
              onClick={() => {
                setAddSheetOpen(false);
                setNameSheet("board");
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                borderRadius: 12,
                border: `1px solid ${M.border}`,
                background: M.bg,
                color: M.textPrimary,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              New board
            </button>
          )}
        </div>
      </BottomSheet>

      {manageRemotes && (
        <ManageRemotesSheet
          open={remotesSheetOpen}
          onClose={() => setRemotesSheetOpen(false)}
          remotes={manageRemotes}
        />
      )}

      <NameSheet
        open={nameSheet === "folder"}
        title="New folder"
        placeholder="Folder name"
        confirmLabel="Create folder"
        onClose={() => setNameSheet(null)}
        onConfirm={(name) => {
          setNameSheet(null);
          if (editablePath && tree) {
            updateTree(addFolder(tree, editablePath, name));
          }
        }}
      />
      <NameSheet
        open={nameSheet === "board"}
        title="New board"
        placeholder="Board name"
        confirmLabel="Create board"
        onClose={() => setNameSheet(null)}
        onConfirm={(name) => {
          setNameSheet(null);
          if (!editablePath || !tree || !onCreateNamedBoard) {
            return;
          }
          updateTree(addBoardRef(tree, editablePath, name));
          // A board of that name may already exist — file and open it
          // instead of overwriting.
          if (savedBoards.includes(name)) {
            onOpen({ kind: "saved", name });
          } else {
            onCreateNamedBoard(name);
          }
        }}
      />
    </div>
  );
}
