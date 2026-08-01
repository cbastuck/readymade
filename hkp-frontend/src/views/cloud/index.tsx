import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  stopCoordinatorBoard,
} from "./coordinatorClient";
import { toast } from "sonner";
import CoordinatorsMenu from "./CoordinatorsMenu";
import CloudBoard from "./Board";
import Sidebar from "../playground/Sidebar";
import { useCoordinatorBridge } from "./useCoordinatorBridge";
import { CoordinatorSnapshotStore } from "./coordinatorSnapshot";
import {
  CoordinatorBridgeAccess,
  createBridgeRuntimeApi,
} from "./bridgeRuntimeApi";
import { createBoardCoordinator } from "hkp-frontend/src/core/coordinator";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import ManageCoordinatorsDialog from "./ManageCoordinatorsDialog";
import NewBoardDialog from "./NewBoardDialog";
import CloudLoginGate from "./CloudLoginGate";
import { useCloudLogin } from "../../auth/useCloudLogin";

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
  const errorText =
    board.status === "error" ? (board.errors ?? []).join("\n") : "";
  return (
    <button
      onClick={onClick}
      title={errorText || undefined}
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
  bridgeAccess: CoordinatorBridgeAccess;
  onHydrate: (config: BoardDescriptor) => void;
};

function CloudBoardInner({
  board,
  bridgeWsUrl,
  userId,
  idToken,
  bridgeAccess,
  onHydrate,
}: InnerProps) {
  const boardContext = useBoardContext();
  const { ws: bridgeWs, configureRemoteService } = useCoordinatorBridge(
    bridgeWsUrl,
    userId,
    board.boardName,
    boardContext,
    idToken,
    bridgeAccess.snapshot,
  );

  // The host built the attached-mode api around this object before the socket
  // existed; give it the way to send now that it does.
  bridgeAccess.configureRemoteService = configureRemoteService;

  // The board is hydrated from what the coordinator says it is — which only
  // arrives once it has said it. Hydrating from the saved config first would
  // render services with no live state and, worse, with no addresses for the
  // mounts they point at.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    const hydrate = () => {
      const config = bridgeAccess.snapshot.getConfig() as
        | BoardDescriptor
        | null;
      if (!config || hydratedRef.current === board.boardName) {
        return;
      }
      hydratedRef.current = board.boardName;
      onHydrate(config);
    };
    hydrate();
    return bridgeAccess.snapshot.subscribe(hydrate);
  }, [bridgeAccess, board.boardName, onHydrate]);
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
  /** Top-left logo. Hosts pass a control that navigates home; without one the
   *  Toolbar renders a decorative mark that looks clickable but is not. */
  logoSlot?: ReactNode;
};

export default function CloudBoards({
  initialCoordinatorName,
  initialBoardName,
  onNavigate,
  logoSlot,
}: CloudBoardsProps = {}) {
  const appContext = useAppContext();
  const user = appContext?.user ?? null;
  const login = useCloudLogin();

  const boardProviderRef = useRef<BoardProviderHandle>(null);

  // This view attaches; it never owns. A board here belongs to the coordinator
  // that provisions it, and boards are built in the playground and deployed —
  // so there is no second owner to switch to.

  // Created here rather than inside the bridge hook: the attached-mode runtime
  // api and the board coordinator are built from it, and both are props of the
  // provider that hosts the hook.
  const bridgeAccessRef = useRef<CoordinatorBridgeAccess | null>(null);
  if (!bridgeAccessRef.current) {
    bridgeAccessRef.current = {
      snapshot: new CoordinatorSnapshotStore(),
      configureRemoteService: async () => {
        throw new Error("Not attached to a coordinator");
      },
    };
  }
  const bridgeAccess = bridgeAccessRef.current;

  const [initialRuntimeEngines] = useState<RuntimeClass[]>(() => [
    { name: "Browser Runtime", type: "browser" },
    ...restoreAvailableRuntimeEngines(),
  ]);

  const [coordinators, setCoordinators] = useState<CoordinatorDescriptor[]>(
    () => restoreCoordinators(),
  );
  const [isManageCoordinatorsOpen, setIsManageCoordinatorsOpen] =
    useState(false);
  // Coordinator the New Board dialog is creating a board on; undefined = closed.
  const [newBoardCoordinator, setNewBoardCoordinator] = useState<
    CoordinatorDescriptor | undefined
  >();
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
  // Pure view toggle: when true, show the coordinators overview even though a
  // board is still selected/mounted. This lets the user return to the overview
  // (via the toolbar Cloud button) WITHOUT clearing selection or re-hydrating
  // the board — re-hydration would re-register the board with the coordinator
  // and restart remote runtimes (e.g. an hkp-node timer).
  const [showOverview, setShowOverview] = useState(false);

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
    setShowOverview(false);
    // Re-revealing the board that's already mounted? Skip re-hydration — calling
    // setBoardState again would re-register the board and restart remote runtimes.
    if (selectedBoard?.boardName === board.boardName) {
      return;
    }
    setSelectedBoard(board);
    setMountedBoard(board);
    // Hydration waits for the coordinator's snapshot: only it knows the live
    // state, including the addresses of the mounts services point at.
    if (selectedCoordinator) {
      onNavigate?.(selectedCoordinator.name, board.boardName);
    }
  };

  const onSelectBoardFromLanding = (
    coordinator: CoordinatorDescriptor,
    board: CoordinatorBoardInfo,
  ) => {
    setShowOverview(false);
    // Re-revealing the already-open board? Just leave the overview — don't
    // re-hydrate it, which would re-register the board with the coordinator and
    // restart remote runtimes (e.g. an hkp-node timer).
    if (
      selectedCoordinator?.url === coordinator.url &&
      selectedBoard?.boardName === board.boardName
    ) {
      return;
    }
    setSelectedCoordinator(coordinator);
    setSelectedBoard(board);
    setMountedBoard(board);
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

  // Return to the coordinators overview when the toolbar's Cloud button is
  // pressed while already on the cloud view. This only flips the view flag — the
  // selected/mounted board stays fully intact and running so its remote runtimes
  // (and the bridge WebSocket) are untouched.
  const location = useLocation();
  const navigate = useNavigate();
  const showOverviewSignal = (location.state as { showOverview?: number } | null)
    ?.showOverview;
  useEffect(() => {
    if (showOverviewSignal) {
      setShowOverview(true);
    }
  }, [showOverviewSignal]);

  // Open a specific board on arrival — the start page's "Cloud Boards" source
  // navigates here with this signal instead of driving the internal state
  // itself. The `at` nonce re-triggers it on repeat navigations; the pending
  // ref is consumed once fulfilled so a later board-list revalidation can't
  // yank the user back to it.
  const openBoardSignal = (
    location.state as {
      openBoard?: { coordinatorUrl: string; boardName: string; at: number };
    } | null
  )?.openBoard;
  const pendingOpenBoard = useRef<{
    coordinatorUrl: string;
    boardName: string;
  } | null>(null);
  useEffect(() => {
    if (openBoardSignal) {
      pendingOpenBoard.current = {
        coordinatorUrl: openBoardSignal.coordinatorUrl,
        boardName: openBoardSignal.boardName,
      };
    }
    // Only the nonce should re-arm the pending open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBoardSignal?.at]);
  useEffect(() => {
    const target = pendingOpenBoard.current;
    if (!target) {
      return;
    }
    const coordinator = coordinators.find((c) => c.url === target.coordinatorUrl);
    if (!coordinator) {
      return;
    }
    const group = allCoordinatorBoards.find(
      (g) => g.coordinator.url === target.coordinatorUrl,
    );
    const board = group?.boards.find((b) => b.boardName === target.boardName);
    if (!board) {
      // Boards for this coordinator haven't loaded yet — wait for the next
      // render (this effect re-runs when allCoordinatorBoards updates).
      return;
    }
    pendingOpenBoard.current = null;
    onSelectBoardFromLanding(coordinator, board);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinators, allCoordinatorBoards]);

  // ── New board ───────────────────────────────────────────────────────────────

  /**
   * Stops the board without giving it up.
   *
   * The coordinator releases the runtimes and keeps the board — its config
   * included, since a coordinator's boards live only in its memory. Deploying
   * the board again is what starts it back up.
   */
  const onStopBoard = async () => {
    const board = selectedBoard;
    const coordinator = selectedCoordinator;
    if (!board || !coordinator || !user) {
      return;
    }
    try {
      const info = await stopCoordinatorBoard(
        coordinator.url,
        user.userId,
        user.idToken,
        board.boardName,
      );
      setSelectedBoard(info);
      setMountedBoard(info);
      await reloadBoards();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop the board",
      );
    }
  };

  const onNewBoard = (coordinatorOverride?: CoordinatorDescriptor) => {
    const coordinator = coordinatorOverride ?? selectedCoordinator;
    if (!coordinator || !user) {
      toast.warning(
        "Select a coordinator and sign in before creating a board.",
      );
      return;
    }
    // Open a styled dialog instead of window.prompt, which doesn't render in
    // the Readymade webview and is visually inconsistent across targets.
    setNewBoardCoordinator(coordinator);
  };

  /**
   * Starts a new board where boards are built: the playground.
   *
   * Nothing is created on the coordinator here — a board arrives on one by
   * being deployed, and an empty record would be a board this view cannot fill.
   */
  const createBoard = (boardName: string) => {
    setNewBoardCoordinator(undefined);
    navigate(`/playground/${encodeURIComponent(boardName)}`);
  };

  const showCoordinatorInToolbar = false;
  const boardCanvasRef = useBlockSwipeNavigation<HTMLDivElement>();

  // Live status for the open board: prefer the freshly-listed entry, fall back to
  // the locally-tracked selection. Drives the in-board error banner.
  const openBoard =
    boards.find((b) => b.boardName === mountedBoard?.boardName) ??
    selectedBoard;
  const openBoardErrors =
    openBoard?.status === "error" ? (openBoard.errors ?? []) : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  // Cloud boards require an authenticated session — gate the entire view.
  if (!user) {
    return <CloudLoginGate onLogin={login} />;
  }

  // A "rest" runtime is reached through the coordinator here rather than
  // dialled: same runtime type, same board, different way in.
  const attachedRuntimeApis = {
    ...runtimeApis,
    rest: createBridgeRuntimeApi(bridgeAccess),
    realtime: createBridgeRuntimeApi(bridgeAccess),
  };
  const boardCoordinator = createBoardCoordinator(() =>
    bridgeAccess.snapshot.asCoordinatorState(),
  );

  return (
    <BoardProvider
      ref={boardProviderRef}
      user={user}
      coordinator={boardCoordinator}
      runtimeApis={attachedRuntimeApis}
      availableRuntimeEngines={initialRuntimeEngines}
      onRemoveRuntime={async () => {}}
      onUnmountRuntime={(runtime, scope, defaultHandler) => {
        if (isRuntimeBrowserClassType(runtime.type)) {
          defaultHandler();
        } else {
          scope.close?.();
        }
      }}
    >
      <div
        className="w-full h-full flex flex-col"
        style={{ background: "var(--bg-app, #fafafa)" }}
      >
        <Toolbar logoSlot={logoSlot}>
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
                    !showOverview && selectedCoordinator && selectedBoard
                      ? "contents"
                      : "none",
                }}
              >
                {openBoardErrors.length > 0 && (
                  <div className="m-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <div className="font-semibold">
                      This board didn’t fully start — runtime output won’t flow.
                    </div>
                    <ul className="mt-1 list-disc pl-5 break-words">
                      {openBoardErrors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="text-gray-500">
                    {openBoard?.status === "stopped"
                      ? `Stopped — deploy it again from the playground to run it on ${selectedCoordinator?.name ?? "this coordinator"}`
                      : `Deployed to ${selectedCoordinator?.name ?? "a coordinator"} — it keeps running when you close this`}
                  </span>
                  <div className="flex-1" />
                  {openBoard?.status !== "stopped" && (
                    <Button onClick={() => void onStopBoard()}>Stop</Button>
                  )}
                </div>
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
                  userId={user?.userId ?? null}
                  idToken={user?.idToken ?? null}
                  bridgeAccess={bridgeAccess}
                  onHydrate={(config) =>
                    boardProviderRef.current?.setBoardState(config)
                  }
                />
              </div>
            )}
            {(showOverview || !(selectedCoordinator && selectedBoard)) && (
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
