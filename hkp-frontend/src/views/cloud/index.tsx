import { useCallback, useEffect, useRef, useState } from "react";
import { useBlockSwipeNavigation } from "../../runtime/useBlockSwipeNavigation";
import useSWR from "swr";
import { ArrowRight, Plus } from "lucide-react";

import BoardProvider, {
  BoardProviderHandle,
  useBoardContext,
} from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import { runtimeApis } from "../playground";
import {
  CoordinatorDescriptor,
  restoreCoordinators,
  storeCoordinators,
  restoreAvailableRuntimeEngines,
  storeAvailableRuntimeEngines,
} from "../../common";
import { useAppContext } from "../../AppContext";
import {
  BoardDescriptor,
  RuntimeClass,
  isRuntimeBrowserClassType,
} from "../../types";
import {
  CoordinatorBoardInfo,
  listCoordinatorBoards,
  registerCoordinatorBoard,
} from "./coordinatorClient";
import { toast } from "sonner";
import CoordinatorsMenu from "./CoordinatorsMenu";
import CloudBoard from "./Board";
import Sidebar from "../playground/Sidebar";
import { useCoordinatorBridge } from "./useCoordinatorBridge";
import ManageCoordinatorsDialog from "./ManageCoordinatorsDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type AllCoordinatorBoards = {
  coordinator: CoordinatorDescriptor;
  boards: CoordinatorBoardInfo[];
  error: boolean;
};

// ── Landing (shown when no board is open) ─────────────────────────────────────

function BoardLandingCard({
  board,
  onClick,
}: {
  board: CoordinatorBoardInfo;
  onClick: () => void;
}) {
  const date = new Date(board.createdAt);
  const dateLabel = isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-slate-200 bg-white text-left cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      <div className="flex items-center gap-2 w-full">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: board.status === "running" ? "#22c55e" : "#ef4444",
          }}
        />
        <span className="text-[13px] font-semibold text-slate-800 truncate flex-1">
          {board.boardName}
        </span>
        <ArrowRight size={13} className="text-slate-400 shrink-0" />
      </div>
      {dateLabel && (
        <span className="text-[11px] text-slate-400 ml-4">{dateLabel}</span>
      )}
    </button>
  );
}

type LandingProps = {
  user: { username: string; idToken: string } | null;
  coordinators: CoordinatorDescriptor[];
  allCoordinatorBoards: AllCoordinatorBoards[];
  isLoading: boolean;
  onSelectBoard: (
    coordinator: CoordinatorDescriptor,
    board: CoordinatorBoardInfo,
  ) => void;
  onNewBoard: (coordinator: CoordinatorDescriptor) => void;
  onManageCoordinators: () => void;
};

function CloudBoardsLanding({
  user,
  coordinators,
  allCoordinatorBoards,
  isLoading,
  onSelectBoard,
  onNewBoard,
  onManageCoordinators,
}: LandingProps) {
  if (!user) {
    return (
      <div className="flex items-center justify-center w-full h-full text-neutral-400 text-base">
        Login required to use cloud boards
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-8 md:px-10"
      style={{
        fontFamily: "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif",
        color: "#0f172a",
      }}
    >
      <div className="mx-auto max-w-4xl">
        {coordinators.length === 0 ? (
          <div
            className="rounded-3xl border border-slate-200 bg-white/90 shadow-2xl shadow-slate-200/60 px-8 py-10 flex flex-col items-center gap-4"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <p className="text-slate-400 text-sm">
              Add a coordinator to get started
            </p>
            <button
              onClick={onManageCoordinators}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              style={{ fontSize: "0.8rem", fontWeight: 600 }}
            >
              <Plus size={13} />
              Add coordinator
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                onClick={onManageCoordinators}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                style={{ fontSize: "0.75rem", fontWeight: 600 }}
              >
                Manage coordinators
              </button>
            </div>
            <div
              className="rounded-3xl border border-slate-200 bg-white/90 shadow-2xl shadow-slate-200/60"
              style={{ backdropFilter: "blur(8px)" }}
            >
              {allCoordinatorBoards.map((group, idx) => (
                <div
                  key={group.coordinator.url}
                  className={
                    idx < allCoordinatorBoards.length - 1
                      ? "border-b border-slate-200"
                      : ""
                  }
                >
                  <div className="px-8 py-6">
                    <div className="flex items-center justify-between mb-4">
                      <p
                        className="uppercase tracking-[0.2em] text-slate-500"
                        style={{ fontSize: "0.72rem", fontWeight: 600 }}
                      >
                        {group.coordinator.name}
                      </p>
                      <button
                        onClick={() => onNewBoard(group.coordinator)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                        style={{ fontSize: "0.75rem", fontWeight: 600 }}
                      >
                        <Plus size={12} />
                        New board
                      </button>
                    </div>
                    {isLoading ? (
                      <p className="text-slate-400 text-sm py-4">Loading…</p>
                    ) : group.error ? (
                      <p className="text-red-400 text-sm py-4">
                        Failed to load boards from this coordinator.
                      </p>
                    ) : group.boards.length === 0 ? (
                      <p className="text-slate-400 text-sm py-4">
                        No boards yet — create one to get started.
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(200px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {group.boards.map((board) => (
                          <BoardLandingCard
                            key={board.boardName}
                            board={board}
                            onClick={() =>
                              onSelectBoard(group.coordinator, board)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inner component (runs inside BoardProvider) ───────────────────────────────

type InnerProps = {
  board: CoordinatorBoardInfo;
  bridgeWsUrl: string | null;
  userId: string | null;
  idToken: string | null;
};

function CloudBoardInner({ board, bridgeWsUrl, userId, idToken }: InnerProps) {
  const boardContext = useBoardContext();
  const { ws: bridgeWs } = useCoordinatorBridge(
    bridgeWsUrl,
    userId,
    board.boardName,
    boardContext,
    idToken,
  );
  if (!boardContext) {
    return null;
  }
  return (
    <div className="flex-1 overflow-auto">
      <CloudBoard
        boardContext={boardContext}
        boardName={board.boardName}
        bridgeWs={bridgeWs}
      />
    </div>
  );
}

// ── Root view ─────────────────────────────────────────────────────────────────

type CloudBoardsProps = {
  initialCoordinatorName?: string;
  initialBoardName?: string;
  onNavigate?: (coordinatorName: string, boardName: string) => void;
};

export default function CloudBoards({
  initialCoordinatorName,
  initialBoardName,
  onNavigate,
}: CloudBoardsProps = {}) {
  const appContext = useAppContext();
  const user = appContext?.user ?? null;

  const boardProviderRef = useRef<BoardProviderHandle>(null);

  const [initialRuntimeEngines] = useState<RuntimeClass[]>(() => [
    { name: "Browser Runtime", type: "browser" },
    ...restoreAvailableRuntimeEngines(),
  ]);

  const [coordinators, setCoordinators] = useState<CoordinatorDescriptor[]>(
    () => restoreCoordinators(),
  );
  const [isManageCoordinatorsOpen, setIsManageCoordinatorsOpen] =
    useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState<
    CoordinatorDescriptor | undefined
  >();
  const [selectedBoard, setSelectedBoard] = useState<
    CoordinatorBoardInfo | undefined
  >();
  // The last board that was explicitly opened. Kept alive even when the user
  // navigates to the landing so notification targets (and the WebSocket) stay
  // registered throughout. Cleared only when the coordinator is removed.
  const [mountedBoard, setMountedBoard] = useState<
    CoordinatorBoardInfo | undefined
  >();

  // ── Coordinator management ──────────────────────────────────────────────────

  const onAddCoordinator = (coordinator: CoordinatorDescriptor) => {
    const updated = [...coordinators, coordinator];
    setCoordinators(updated);
    storeCoordinators(updated);

    // Register the coordinator's base URL as an available REST runtime engine
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
      setMountedBoard(undefined);
    }
  };

  // ── Board listing ───────────────────────────────────────────────────────────

  const boardsFetcher = useCallback(async () => {
    if (!selectedCoordinator || !user) {
      return [];
    }
    return listCoordinatorBoards(
      selectedCoordinator.url,
      user.userId,
      user.idToken,
    );
  }, [selectedCoordinator, user]);

  const { data: boards = [], mutate: reloadBoards } = useSWR(
    selectedCoordinator && user
      ? `boards:${selectedCoordinator.url}:${user.userId}`
      : null,
    boardsFetcher,
    { revalidateOnFocus: false },
  );

  // Fetch boards from all coordinators for the landing view.
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
      ? `all-boards:${user.userId}:${coordinators.map((c) => c.url).join(",")}`
      : null,
    allBoardsFetcher,
    { revalidateOnFocus: false },
  );

  const onSelectCoordinator = (coordinator: CoordinatorDescriptor) => {
    setSelectedCoordinator(coordinator);
    setSelectedBoard(undefined);
  };

  const onSelectBoard = (board: CoordinatorBoardInfo) => {
    setSelectedBoard(board);
    setMountedBoard(board);
    // Hydrate the BoardProvider with the board's config from the coordinator.
    boardProviderRef.current?.setBoardState(board.config);
    if (selectedCoordinator) {
      onNavigate?.(selectedCoordinator.name, board.boardName);
    }
  };

  const onSelectBoardFromLanding = (
    coordinator: CoordinatorDescriptor,
    board: CoordinatorBoardInfo,
  ) => {
    setSelectedCoordinator(coordinator);
    setSelectedBoard(board);
    setMountedBoard(board);
    boardProviderRef.current?.setBoardState(board.config);
    onNavigate?.(coordinator.name, board.boardName);
  };

  // Capture initial URL params as refs so effects only fire on the data they
  // need (coordinators/boards loading), not whenever the props change.
  const pendingCoordinatorName = useRef(initialCoordinatorName);
  const pendingBoardName = useRef(initialBoardName);

  // Auto-select coordinator from the URL param — runs whenever coordinators
  // list updates (typically just once after mount since it comes from localStorage).
  useEffect(() => {
    const name = pendingCoordinatorName.current;
    if (!name) {
      return;
    }
    const match = coordinators.find((c) => c.name === name);
    if (match) {
      pendingCoordinatorName.current = undefined;
      setSelectedCoordinator(match);
    }
  }, [coordinators]);

  // Auto-select board from the URL param once the board list has loaded.
  // Sets state directly — no onNavigate call since we are already on the right URL.
  useEffect(() => {
    const name = pendingBoardName.current;
    if (!name || boards.length === 0) {
      return;
    }
    const match = boards.find((b) => b.boardName === name);
    if (match) {
      pendingBoardName.current = undefined;
      setSelectedBoard(match);
      setMountedBoard(match);
      boardProviderRef.current?.setBoardState(match.config);
    }
  }, [boards]);

  // ── New board ───────────────────────────────────────────────────────────────

  const onNewBoard = async (coordinatorOverride?: CoordinatorDescriptor) => {
    const coordinator = coordinatorOverride ?? selectedCoordinator;
    if (!coordinator || !user) {
      toast.warning(
        "Select a coordinator and sign in before creating a board.",
      );
      return;
    }
    const boardName = prompt("Board name:");

    if (!boardName) {
      return;
    }
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
      await Promise.all([reloadBoards(), reloadAllBoards()]);
      // Select the newly created board from the refreshed list.
      const refreshed = await listCoordinatorBoards(
        coordinator.url,
        user.userId,
        user.idToken,
      );
      const created = refreshed.find((b) => b.boardName === boardName);
      if (created) {
        setSelectedCoordinator(coordinator);
        onSelectBoard(created);
      }
    } catch (err) {
      console.error("[cloud] Failed to create board:", err);
    }
  };

  // ── Auto-sync to coordinator on infrastructure change ───────────────────────
  // When the user adds/removes runtimes or services in the CloudBoard view,
  // serialize the new board state and re-register it with the coordinator so
  // the coordinator can provision any new runtimes and update its session.

  const onBoardInfrastructureChange = useCallback(
    async (newDescriptor: BoardDescriptor) => {
      if (!selectedCoordinator || !selectedBoard || !user) {
        return;
      }

      // Skip re-registration when nothing the coordinator cares about has changed.
      // This prevents the infra effect from tearing down the bridge WebSocket on
      // every initial board load (object references change even for identical data).
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
        await registerCoordinatorBoard(
          selectedCoordinator.url,
          user.userId,
          user.idToken,
          { ...newDescriptor, boardName: selectedBoard.boardName },
        );
        // Keep selectedBoard.config in sync so future comparisons stay accurate.
        setSelectedBoard((prev) =>
          prev
            ? {
                ...prev,
                config: { ...newDescriptor, boardName: prev.boardName },
              }
            : prev,
        );
        await reloadBoards();
      } catch (err) {
        console.error("[cloud] Failed to sync board to coordinator:", err);
      }
    },
    [selectedCoordinator, selectedBoard, user, reloadBoards],
  );

  const showCoordinatorInToolbar = false;
  const boardCanvasRef = useBlockSwipeNavigation<HTMLDivElement>();

  // ── Render ──────────────────────────────────────────────────────────────────

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
        className="w-full h-full flex flex-col"
        style={{ background: "var(--bg-app, #fafafa)" }}
      >
        <Toolbar>
          {showCoordinatorInToolbar && (
            <CoordinatorsMenu
              coordinators={coordinators}
              selectedCoordinator={selectedCoordinator}
              boards={boards}
              selectedBoard={selectedBoard}
              onSelectCoordinator={onSelectCoordinator}
              onSelectBoard={onSelectBoard}
              onAddCoordinator={onAddCoordinator}
              onRemoveCoordinator={onRemoveCoordinator}
              onNewBoard={() => onNewBoard()}
            />
          )}
        </Toolbar>

        <div
          style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <Sidebar />
          <div
            ref={boardCanvasRef}
            style={{
              flex: 1,
              overflow: "auto",
              overscrollBehaviorX: "none",
              display: "flex",
              flexDirection: "column",
              background:
                "oklch(0.966 0.007 62) radial-gradient(circle, oklch(0.76 0.012 62) 1px, transparent 1px) 0 0 / 22px 22px",
            }}
          >
            {/* Keep the board mounted in background so WebSocket notification
                targets stay registered while the user browses the landing. */}
            {mountedBoard && (
              <div
                style={{
                  display:
                    selectedCoordinator && selectedBoard ? "contents" : "none",
                }}
              >
                <CloudBoardInner
                  board={mountedBoard}
                  bridgeWsUrl={
                    selectedCoordinator
                      ? selectedCoordinator.url
                          .replace(/^http(s?):\/\//, "ws$1://")
                          .replace(/\/coordinator\/?$/, "") +
                        "/coordinator/bridge"
                      : null
                  }
                  userId={user?.username ?? null}
                  idToken={user?.idToken ?? null}
                />
              </div>
            )}
            {!(selectedCoordinator && selectedBoard) && (
              <CloudBoardsLanding
                user={user}
                coordinators={coordinators}
                allCoordinatorBoards={allCoordinatorBoards}
                isLoading={isLoadingAllBoards}
                onSelectBoard={onSelectBoardFromLanding}
                onNewBoard={onNewBoard}
                onManageCoordinators={() => setIsManageCoordinatorsOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      <ManageCoordinatorsDialog
        isOpen={isManageCoordinatorsOpen}
        coordinators={coordinators}
        onAdd={onAddCoordinator}
        onRemove={onRemoveCoordinator}
        onClose={() => setIsManageCoordinatorsOpen(false)}
      />
    </BoardProvider>
  );
}
