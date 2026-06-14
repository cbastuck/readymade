import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import BoardProvider, {
  BoardProviderHandle,
  useBoardContext,
} from "../../../BoardContext";
import { useAppContext } from "../../../AppContext";
import { useCloudLogin } from "../../../auth/useCloudLogin";
import {
  CoordinatorDescriptor,
  restoreCoordinators,
  storeCoordinators,
  restoreAvailableRuntimeEngines,
  storeAvailableRuntimeEngines,
} from "../../../common";
import {
  BoardDescriptor,
  RuntimeClass,
  isRuntimeBrowserClassType,
} from "../../../types";
import { runtimeApis } from "../../playground";
import { M } from "../../playground/mobile/tokens";
import MobileIcon from "../../playground/mobile/MobileIcon";

import {
  CoordinatorBoardInfo,
  listCoordinatorBoards,
  registerCoordinatorBoard,
} from "../coordinatorClient";
import { useCoordinatorBridge } from "../useCoordinatorBridge";
import CloudBoard from "../Board";
import CloudLoginGate from "../CloudLoginGate";
import ManageCoordinatorsDialog from "../ManageCoordinatorsDialog";
import NewBoardDialog from "../NewBoardDialog";

// ── Types ──────────────────────────────────────────────────────────────────────

type AllCoordinatorBoards = {
  coordinator: CoordinatorDescriptor;
  boards: CoordinatorBoardInfo[];
  error: boolean;
};

// Derive the bridge WebSocket URL from a coordinator's REST URL.
function bridgeWsUrlFor(coordinator: CoordinatorDescriptor): string {
  return (
    coordinator.url
      .replace(/^http(s?):\/\//, "ws$1://")
      .replace(/\/coordinator\/?$/, "") + "/coordinator/bridge"
  );
}

// ── Overview: section header per coordinator ────────────────────────────────────

function SectionHeader({
  title,
  onNewBoard,
}: {
  title: string;
  onNewBoard: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 4px 8px",
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: M.textMuted,
        }}
      >
        {title}
      </span>
      <button
        onClick={onNewBoard}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 9px",
          border: `1px solid ${M.border}`,
          borderRadius: 8,
          background: M.card,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: M.tealDark,
          fontFamily: "inherit",
        }}
      >
        <MobileIcon name="plus" size={12} color={M.tealDark} />
        New
      </button>
    </div>
  );
}

// ── Overview: a single board row ────────────────────────────────────────────────

function BoardRow({
  board,
  onOpen,
}: {
  board: CoordinatorBoardInfo;
  onOpen: () => void;
}) {
  const date = new Date(board.createdAt);
  const dateLabel = isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  const running = board.status === "running";

  return (
    <button
      onClick={onOpen}
      style={{
        width: "100%",
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
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: running ? M.green : M.danger,
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
          {board.boardName}
        </div>
        {dateLabel && (
          <div style={{ fontSize: 11, color: M.textMuted, marginTop: 1 }}>
            {dateLabel}
          </div>
        )}
      </div>
      <MobileIcon name="chevronRight" size={14} color={M.textMuted} />
    </button>
  );
}

// ── Overview screen ─────────────────────────────────────────────────────────────

function CloudOverview({
  coordinators,
  allCoordinatorBoards,
  isLoading,
  onOpenBoard,
  onNewBoard,
  onManageCoordinators,
}: {
  coordinators: CoordinatorDescriptor[];
  allCoordinatorBoards: AllCoordinatorBoards[];
  isLoading: boolean;
  onOpenBoard: (
    coordinator: CoordinatorDescriptor,
    board: CoordinatorBoardInfo,
  ) => void;
  onNewBoard: (coordinator: CoordinatorDescriptor) => void;
  onManageCoordinators: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: 16,
      }}
    >
      {coordinators.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            padding: "48px 16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, color: M.textMuted }}>
            Add a coordinator to get started
          </div>
          <button
            onClick={onManageCoordinators}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              border: `1.5px dashed ${M.teal}`,
              borderRadius: 12,
              background: M.tealLight,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: M.tealDark,
              fontFamily: "inherit",
            }}
          >
            <MobileIcon name="plus" size={15} color={M.tealDark} />
            Add coordinator
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {allCoordinatorBoards.map((group) => (
            <div key={group.coordinator.url}>
              <SectionHeader
                title={group.coordinator.name}
                onNewBoard={() => onNewBoard(group.coordinator)}
              />
              {isLoading ? (
                <div style={{ fontSize: 13, color: M.textMuted, padding: "8px 4px" }}>
                  Loading…
                </div>
              ) : group.error ? (
                <div style={{ fontSize: 13, color: M.danger, padding: "8px 4px" }}>
                  Failed to load boards from this coordinator.
                </div>
              ) : group.boards.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: M.textMuted,
                    fontStyle: "italic",
                    padding: "8px 4px",
                  }}
                >
                  No boards yet — tap New to create one.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.boards.map((board) => (
                    <BoardRow
                      key={board.boardName}
                      board={board}
                      onOpen={() => onOpenBoard(group.coordinator, board)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={onManageCoordinators}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 13,
              border: `1.5px dashed ${M.borderStrong}`,
              borderRadius: 14,
              background: "rgba(255,255,255,0.5)",
              color: M.textSecondary,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <MobileIcon name="settings" size={15} color={M.textSecondary} />
            Manage coordinators
          </button>
        </div>
      )}
    </div>
  );
}

// ── Opened-board view (runs inside BoardProvider) ───────────────────────────────

function MobileCloudBoardCanvas({
  board,
  coordinator,
  userId,
  idToken,
  errors,
}: {
  board: CoordinatorBoardInfo;
  coordinator: CoordinatorDescriptor;
  userId: string | null;
  idToken: string | null;
  errors: string[];
}) {
  const boardContext = useBoardContext();
  const { ws: bridgeWs } = useCoordinatorBridge(
    bridgeWsUrlFor(coordinator),
    userId,
    board.boardName,
    boardContext,
    idToken,
  );
  if (!boardContext) {
    return null;
  }
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: 12,
      }}
    >
      {errors.length > 0 && (
        <div
          style={{
            margin: "0 0 12px",
            borderRadius: 12,
            border: `1px solid ${M.danger}`,
            background: "#fef2f2",
            padding: "10px 12px",
            fontSize: 13,
            color: "#991b1b",
          }}
        >
          <div style={{ fontWeight: 600 }}>
            This board didn’t fully start — runtime output won’t flow.
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <CloudBoard
        boardContext={boardContext}
        boardName={board.boardName}
        bridgeWs={bridgeWs}
      />
    </div>
  );
}

// ── Top bar ─────────────────────────────────────────────────────────────────────

function CloudTopBar({
  title,
  onBack,
  onRefresh,
}: {
  title: string;
  onBack?: () => void;
  onRefresh?: () => void;
}) {
  return (
    <div
      style={{
        background: "rgba(242,237,232,0.95)",
        backdropFilter: "blur(12px)",
        paddingTop: "max(10px, env(safe-area-inset-top))",
        paddingBottom: 10,
        paddingLeft: onBack ? 4 : 16,
        paddingRight: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderBottom: `1px solid ${M.border}`,
        flexShrink: 0,
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            border: "none",
            background: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <MobileIcon name="chevronLeft" size={22} color={M.teal} strokeWidth={2} />
        </button>
      )}
      <span
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: 700,
          color: M.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Refresh"
          style={{
            width: 34,
            height: 34,
            border: "none",
            background: "rgba(0,0,0,0.06)",
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <MobileIcon name="refresh" size={16} color={M.textSecondary} />
        </button>
      )}
    </div>
  );
}

// ── Root ────────────────────────────────────────────────────────────────────────

export default function MobileCloudBoards() {
  const appContext = useAppContext();
  const user = appContext?.user ?? null;
  const login = useCloudLogin();

  const boardProviderRef = useRef<BoardProviderHandle>(null);

  const [initialRuntimeEngines] = useState<RuntimeClass[]>(() => [
    { name: "Browser Runtime", type: "browser" },
    ...restoreAvailableRuntimeEngines(),
  ]);

  const [coordinators, setCoordinators] = useState<CoordinatorDescriptor[]>(() =>
    restoreCoordinators(),
  );
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newBoardCoordinator, setNewBoardCoordinator] = useState<
    CoordinatorDescriptor | undefined
  >();

  // The board currently open (and kept mounted so its bridge stays connected).
  const [selectedCoordinator, setSelectedCoordinator] = useState<
    CoordinatorDescriptor | undefined
  >();
  const [selectedBoard, setSelectedBoard] = useState<
    CoordinatorBoardInfo | undefined
  >();
  // View toggle: when true show the overview even though a board is still mounted.
  const [showOverview, setShowOverview] = useState(true);

  // ── Coordinator management ────────────────────────────────────────────────────

  const onAddCoordinator = (coordinator: CoordinatorDescriptor) => {
    const updated = [...coordinators, coordinator];
    setCoordinators(updated);
    storeCoordinators(updated);

    const baseUrl = coordinator.url.replace(/\/coordinator\/?$/, "");
    const rtClass: RuntimeClass = {
      type: "rest",
      name: coordinator.name,
      url: baseUrl,
    };
    const updatedEngines =
      boardProviderRef.current?.addAvailableRuntime(rtClass, false) ?? [];
    storeAvailableRuntimeEngines(updatedEngines);
  };

  const onRemoveCoordinator = (coordinator: CoordinatorDescriptor) => {
    const updated = coordinators.filter((c) => c.url !== coordinator.url);
    setCoordinators(updated);
    storeCoordinators(updated);
    if (selectedCoordinator?.url === coordinator.url) {
      setSelectedCoordinator(undefined);
      setSelectedBoard(undefined);
      setShowOverview(true);
    }
  };

  // ── Board listing across all coordinators ─────────────────────────────────────

  const allBoardsFetcher = useCallback(async (): Promise<
    AllCoordinatorBoards[]
  > => {
    if (!user || coordinators.length === 0) {
      return [];
    }
    const results = await Promise.allSettled(
      coordinators.map(async (c) => ({
        coordinator: c,
        boards: await listCoordinatorBoards(c.url, user.userId, user.idToken),
        error: false,
      })),
    );
    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { coordinator: coordinators[i], boards: [], error: true },
    );
  }, [coordinators, user]);

  const {
    data: allCoordinatorBoards = [],
    isLoading: isLoadingAllBoards,
    mutate: reloadAllBoards,
  } = useSWR(
    user
      ? `mobile-all-boards:${user.userId}:${coordinators.map((c) => c.url).join(",")}`
      : null,
    allBoardsFetcher,
    { revalidateOnFocus: false },
  );

  // ── Board open / close ────────────────────────────────────────────────────────

  const onOpenBoard = (
    coordinator: CoordinatorDescriptor,
    board: CoordinatorBoardInfo,
  ) => {
    setShowOverview(false);
    // Re-revealing the already-open board? Don't re-hydrate it, which would
    // re-register the board with the coordinator and restart remote runtimes.
    if (
      selectedCoordinator?.url === coordinator.url &&
      selectedBoard?.boardName === board.boardName
    ) {
      return;
    }
    setSelectedCoordinator(coordinator);
    setSelectedBoard(board);
    boardProviderRef.current?.setBoardState(board.config);
  };

  const onBackToOverview = () => {
    setShowOverview(true);
  };

  // ── New board ─────────────────────────────────────────────────────────────────

  const onNewBoard = (coordinator: CoordinatorDescriptor) => {
    if (!user) {
      toast.warning("Sign in before creating a board.");
      return;
    }
    setNewBoardCoordinator(coordinator);
  };

  const createBoard = async (boardName: string) => {
    const coordinator = newBoardCoordinator;
    if (!coordinator || !user) {
      return;
    }
    setNewBoardCoordinator(undefined);
    const emptyConfig: BoardDescriptor = {
      boardName,
      runtimes: [],
      services: {},
    };
    try {
      await registerCoordinatorBoard(
        coordinator.url,
        user.userId,
        user.idToken,
        emptyConfig,
      );
      await reloadAllBoards();
      const refreshed = await listCoordinatorBoards(
        coordinator.url,
        user.userId,
        user.idToken,
      );
      const created = refreshed.find((b) => b.boardName === boardName);
      if (created) {
        onOpenBoard(coordinator, created);
      }
    } catch (err) {
      console.error("[cloud-mobile] Failed to create board:", err);
      toast.error("Failed to create board");
    }
  };

  // ── Auto-sync to coordinator on infrastructure change ─────────────────────────
  // Mirrors the desktop view: when the user adds/removes runtimes or services in
  // the open board, re-register it so the coordinator can provision them.

  const onBoardInfrastructureChange = useCallback(
    async (newDescriptor: BoardDescriptor) => {
      if (!selectedCoordinator || !selectedBoard || !user) {
        return;
      }

      const runtimeKey = (rts: typeof newDescriptor.runtimes) =>
        rts
          .map((r) => `${r.id}:${r.type}`)
          .sort()
          .join("|");
      const serviceKey = (svcs: typeof newDescriptor.services) =>
        Object.entries(svcs ?? {})
          .map(
            ([rid, s]) =>
              `${rid}:${s
                .map((x) => x.uuid)
                .sort()
                .join(",")}`,
          )
          .sort()
          .join("|");

      const coordConfig = selectedBoard.config;
      if (
        runtimeKey(newDescriptor.runtimes) ===
          runtimeKey(coordConfig?.runtimes ?? []) &&
        serviceKey(newDescriptor.services) ===
          serviceKey(coordConfig?.services ?? {})
      ) {
        return;
      }

      try {
        const info = await registerCoordinatorBoard(
          selectedCoordinator.url,
          user.userId,
          user.idToken,
          { ...newDescriptor, boardName: selectedBoard.boardName },
        );
        setSelectedBoard((prev) =>
          prev
            ? {
                ...prev,
                config: { ...newDescriptor, boardName: prev.boardName },
                status: info.status,
                errors: info.errors,
              }
            : prev,
        );
        if (info.status === "error" && info.errors?.length) {
          toast.error("A cloud runtime failed to start", {
            description: info.errors.join("\n"),
          });
        }
        await reloadAllBoards();
      } catch (err) {
        console.error("[cloud-mobile] Failed to sync board to coordinator:", err);
      }
    },
    [selectedCoordinator, selectedBoard, user, reloadAllBoards],
  );

  // Live status for the open board: prefer the freshly-listed entry.
  const openBoardLive =
    allCoordinatorBoards
      .find((g) => g.coordinator.url === selectedCoordinator?.url)
      ?.boards.find((b) => b.boardName === selectedBoard?.boardName) ??
    selectedBoard;
  const openBoardErrors =
    openBoardLive?.status === "error" ? (openBoardLive.errors ?? []) : [];

  // ── Render ────────────────────────────────────────────────────────────────────

  // Cloud boards require an authenticated session — gate the entire view.
  if (!user) {
    return <CloudLoginGate onLogin={login} />;
  }

  const boardIsOpen = !showOverview && !!selectedCoordinator && !!selectedBoard;

  return (
    <BoardProvider
      ref={boardProviderRef}
      user={user}
      runtimeApis={runtimeApis}
      availableRuntimeEngines={initialRuntimeEngines}
      onRemoveRuntime={async () => {}}
      onUnmountRuntime={(runtime, scope, defaultHandler) => {
        if (isRuntimeBrowserClassType(runtime.type)) {
          defaultHandler();
        } else {
          scope.close?.();
        }
      }}
      onBoardInfrastructureChange={onBoardInfrastructureChange}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: M.bg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <CloudTopBar
          title={boardIsOpen ? (selectedBoard?.boardName ?? "Board") : "Cloud Boards"}
          onBack={boardIsOpen ? onBackToOverview : undefined}
          onRefresh={boardIsOpen ? undefined : () => reloadAllBoards()}
        />

        {/* Keep the board mounted in the background while browsing the overview
            so its bridge WebSocket and notification targets stay registered. */}
        {selectedCoordinator && selectedBoard && (
          <div
            style={{
              display: boardIsOpen ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            <MobileCloudBoardCanvas
              board={selectedBoard}
              coordinator={selectedCoordinator}
              userId={user.userId}
              idToken={user.idToken}
              errors={openBoardErrors}
            />
          </div>
        )}

        {!boardIsOpen && (
          <CloudOverview
            coordinators={coordinators}
            allCoordinatorBoards={allCoordinatorBoards}
            isLoading={isLoadingAllBoards}
            onOpenBoard={onOpenBoard}
            onNewBoard={onNewBoard}
            onManageCoordinators={() => setIsManageOpen(true)}
          />
        )}
      </div>

      <ManageCoordinatorsDialog
        isOpen={isManageOpen}
        coordinators={coordinators}
        onAdd={onAddCoordinator}
        onRemove={onRemoveCoordinator}
        onClose={() => setIsManageOpen(false)}
      />

      <NewBoardDialog
        isOpen={!!newBoardCoordinator}
        coordinatorName={newBoardCoordinator?.name}
        existingBoardNames={
          allCoordinatorBoards
            .find((g) => g.coordinator.url === newBoardCoordinator?.url)
            ?.boards.map((b) => b.boardName) ?? []
        }
        onCreate={createBoard}
        onClose={() => setNewBoardCoordinator(undefined)}
      />
    </BoardProvider>
  );
}
