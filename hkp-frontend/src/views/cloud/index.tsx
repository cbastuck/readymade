import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBlockSwipeNavigation } from "../../runtime/useBlockSwipeNavigation";
import useSWR from "swr";
import {
  ArrowRight,
  ChevronDown,
  Cloud,
  CloudOff,
  Plus,
  ScrollText,
} from "lucide-react";

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
  LogLevel,
  RuntimeClass,
  isRuntimeBrowserClassType,
} from "../../types";
import {
  CoordinatorBoardInfo,
  listCoordinatorBoards,
  registerCoordinatorBoard,
  setCoordinatorBoardLogging,
  stopCoordinatorBoard,
} from "./coordinatorClient";
import { toast } from "sonner";
import CoordinatorsMenu from "./CoordinatorsMenu";
import CloudBoard from "./Board";
import NestedNavProvider from "../../runtime/ui/NestedNavigation";
import Sidebar from "../playground/Sidebar";
import { useCoordinatorBridge } from "./useCoordinatorBridge";
import { CoordinatorSnapshotStore } from "./coordinatorSnapshot";
import {
  CoordinatorBridgeAccess,
  createBridgeRuntimeApi,
} from "./bridgeRuntimeApi";
import { createBoardCoordinator } from "hkp-frontend/src/core/coordinator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import ManageCoordinatorsDialog from "./ManageCoordinatorsDialog";
import NewBoardDialog from "./NewBoardDialog";
import CloudLoginGate from "./CloudLoginGate";
import { useCloudLogin } from "../../auth/useCloudLogin";
import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type AllCoordinatorBoards = {
  coordinator: CoordinatorDescriptor;
  boards: CoordinatorBoardInfo[];
  error: boolean;
};

/**
 * How much of a run a board keeps, least severe first.
 *
 * A level is the floor, not a category: choosing one keeps it and everything
 * above it. `debug` is therefore everything there is — the flow itself (every
 * service call and return) as well as what runs report about themselves — which
 * is what the name says.
 */
const LOG_LEVEL_CHOICES: Array<{ value: LogLevel; label: string }> = [
  { value: "debug", label: "All" },
  { value: "info", label: "Events" },
  { value: "warn", label: "Warnings" },
  { value: "error", label: "Errors" },
];

/** Picks how much of a run the deployed board keeps, from the header. */
function LogLevelMenu({
  level,
  onPick,
}: {
  level: LogLevel;
  onPick: (level: LogLevel) => void;
}) {
  const theme = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="What to keep. All records every service call and return — the most useful for debugging, and by far the most of it."
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 2,
            border: "none",
            background: "none",
            padding: "2px 4px",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--hkp-accent, #3b5bff)",
            cursor: "pointer",
          }}
        >
          {LOG_LEVEL_CHOICES.find((choice) => choice.value === level)?.label}
          <ChevronDown size={12} strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="font-menu"
        // The primitive leaves corners square; the menus already in this bar
        // are rounded, and the theme is what says by how much.
        style={{ borderRadius: theme.borderRadius }}
      >
        <DropdownMenuRadioGroup
          value={level}
          onValueChange={(value) => onPick(value as LogLevel)}
        >
          {LOG_LEVEL_CHOICES.map((choice) => (
            <DropdownMenuRadioItem key={choice.value} value={choice.value}>
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
      const config =
        bridgeAccess.snapshot.getConfig() as BoardDescriptor | null;
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
  // The board that is open. Kept mounted (hidden) rather than unmounted when
  // there is nothing to show, so notification targets and the WebSocket stay
  // registered. Cleared only when the coordinator is removed.
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

  const { data: allCoordinatorBoards = [], isLoading: isLoadingAllBoards } =
    useSWR(
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
    // Selecting the board that is already open? Skip re-hydration — calling
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
    // Selecting the board that is already open? Don't re-hydrate it, which
    // would re-register the board with the coordinator and restart remote
    // runtimes (e.g. an hkp-node timer).
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

  const location = useLocation();
  const navigate = useNavigate();

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
    const coordinator = coordinators.find(
      (c) => c.url === target.coordinatorUrl,
    );
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

  /**
   * Runs a stopped board again.
   *
   * Stopping keeps the board and its config on the coordinator, so starting it
   * is registering that same config — the coordinator provisions the runtimes
   * again. No trip through the playground: this board is already deployed, and
   * nothing about it is being changed.
   */
  const onStartBoard = async () => {
    const board = openBoard;
    const coordinator = selectedCoordinator;
    if (!board?.config || !coordinator || !user) {
      return;
    }
    try {
      const info = await registerCoordinatorBoard(
        coordinator.url,
        user.userId,
        user.idToken,
        { ...board.config, boardName: board.boardName },
      );
      setSelectedBoard(info);
      setMountedBoard(info);
      if (info.status === "error" && info.errors?.length) {
        toast.error("A cloud runtime failed to start", {
          description: info.errors.join("\n"),
        });
      }
      await reloadBoards();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start the board",
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

  // The open board as last listed: the freshly-listed entry, falling back to the
  // locally-tracked selection. Carries the errors a failed provisioning reported.
  const openBoard =
    boards.find((b) => b.boardName === mountedBoard?.boardName) ??
    selectedBoard;

  // Whether it is running comes from the coordinator, not from that listing.
  // The listing is only as fresh as the last time something re-fetched it, so a
  // board stopped from another tab — or by anyone else watching it — would go
  // on being shown as running here. The coordinator tells every bridge, so this
  // browser already knows; it just has to read it.
  const liveStatus = useSyncExternalStore(
    (onChange) => bridgeAccess.snapshot.subscribe(onChange),
    () => bridgeAccess.snapshot.getStatus(),
  );
  const boardStatus = liveStatus ?? openBoard?.status;

  /**
   * Whether this board is recording what its services log.
   *
   * Read from the board's own config rather than kept only here, so that what
   * the toggle shows is what the coordinator will actually do — including after
   * a reload, and for a board somebody else switched on.
   */
  const loggingOn = (openBoard?.config?.runtimes ?? []).some(
    (runtime: { state?: Record<string, unknown> }) =>
      runtime.state?.logging === true,
  );

  /**
   * How much this board records — the least severe level it keeps.
   *
   * `debug` is what keeps the flow itself (every service call and return), and
   * so what makes the log answer "where did this stop"; anything above keeps
   * only what a run reported about itself.
   */
  const logLevel =
    ((openBoard?.config?.runtimes ?? []).find(
      (runtime: { state?: Record<string, unknown> }) => runtime.state?.logLevel,
    )?.state?.logLevel as LogLevel | undefined) ?? "info";

  /**
   * Turn logging on or off for the deployed board.
   *
   * Applied to the runtimes that are already running, so it takes effect
   * without restarting anything — which is the point: it is a setting you reach
   * for while looking into something, not one worth rebuilding a board over.
   */
  const applyLogging = async (enabled: boolean, level: LogLevel) => {
    const board = selectedBoard;
    const coordinator = selectedCoordinator;
    if (!board || !coordinator || !user) {
      return;
    }
    try {
      const result = await setCoordinatorBoardLogging(
        coordinator.url,
        user.userId,
        user.idToken,
        board.boardName,
        enabled,
        level,
      );
      if (result.unreachable.length > 0) {
        // Partly applied is worth saying out loud: the rest of the board took
        // it, and those runtimes did not.
        toast.error(`Not applied to: ${result.unreachable.join(", ")}`);
      }
      await reloadBoards();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change logging",
      );
    }
  };

  // Shown whenever there are any, not only for a board that failed to start:
  // stopping reports the runtimes it could not release, and those are still
  // running somewhere with nothing tracking them.
  const openBoardErrors = openBoard?.errors ?? [];

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

  const isStopped = boardStatus === "stopped";
  const coordinatorName = selectedCoordinator?.name ?? "a coordinator";
  const boardIsOpen = !!(mountedBoard && selectedCoordinator && selectedBoard);
  const statusSlot = boardIsOpen ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        title={
          isStopped
            ? "Its runtimes are released; Start provisions them again"
            : "It keeps running when you close this"
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          fontSize: 12.5,
          color: "var(--text-dim, #6b7280)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {isStopped ? (
          <CloudOff size={14} strokeWidth={1.75} />
        ) : (
          <Cloud size={14} strokeWidth={1.75} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {isStopped ? "Stopped on" : "Deployed to"} {coordinatorName}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void (isStopped ? onStartBoard() : onStopBoard())}
        style={{
          flexShrink: 0,
          border: "none",
          background: "none",
          padding: "2px 4px",
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--hkp-accent, #3b5bff)",
          cursor: "pointer",
        }}
      >
        {isStopped ? "Start" : "Stop"}
      </button>
      <button
        type="button"
        onClick={() => void applyLogging(!loggingOn, logLevel)}
        title={
          loggingOn
            ? "Recording to this coordinator's disk. Entries can carry personal data."
            : "Not recording anything"
        }
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          border: "none",
          background: "none",
          padding: "2px 4px",
          fontSize: 12.5,
          fontWeight: 600,
          color: loggingOn
            ? "var(--hkp-accent, #3b5bff)"
            : "var(--text-dim, #6b7280)",
          cursor: "pointer",
        }}
      >
        <ScrollText size={14} strokeWidth={1.75} />
        {loggingOn ? "Logging on" : "Logging off"}
      </button>
      {loggingOn && (
        // Only while it is on: a level for a log nobody is keeping is a control
        // that does nothing, and one more thing to read past in the header.
        <LogLevelMenu
          level={logLevel}
          onPick={(level) => void applyLogging(true, level)}
        />
      )}
    </div>
  ) : null;

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
        <Toolbar logoSlot={logoSlot} statusSlot={statusSlot}>
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
          {/* A cloud board nests exactly as a playground board does, so a
              pipeline on one is opened the same way. Outside the canvas rather
              than inside it: the levels cover the canvas, and a layer within a
              scroll container would be sized to the content and scroll away
              with it. */}
          <NestedNavProvider rootLabel={mountedBoard?.boardName || "Board"}>
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
                      selectedCoordinator && selectedBoard
                        ? "contents"
                        : "none",
                  }}
                >
                  {openBoardErrors.length > 0 && (
                    <div className="m-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                      <div className="font-semibold">
                        {boardStatus === "stopped"
                          ? "This board stopped, but not everything let go."
                          : "This board didn’t fully start — runtime output won’t flow."}
                      </div>
                      <ul className="mt-1 list-disc pl-5 break-words">
                        {openBoardErrors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
          </NestedNavProvider>
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
