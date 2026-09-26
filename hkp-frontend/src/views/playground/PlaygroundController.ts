import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FacadeDescriptor } from "../../facade/types";

import { BoardProviderHandle } from "../../BoardContext";

import { generateRandomName } from "../../core/board";
import { BoardDocuments } from "../../core/boardPersistence";
import { BoardSnapshot } from "../../core/boardSnapshots";
import { browserDraftStore } from "../../core/boardDrafts";
import {
  UnitOrigin,
  chainUnitOrigins,
  filesUnitOrigin,
  nativeFileUnitOrigin,
  urlUnitOrigin,
} from "../../core/linkUnits";
import {
  readFileViaPlatform,
  saveSavedBoardViaPlatform,
} from "../../platform/PlatformContext";
import {
  UnitBoard,
  unitBaseName,
} from "../../runtime/board/units";

import {
  defaultName,
  availableRuntimeEngines,
  localBoardSavedAt,
  restoreBoardFromLocalStorage,
  storeBoardToLocalStorage,
} from "./common";
import {
  importBoard,
  createBoardFromTemplate,
  importFromLink,
} from "./BoardActions";
import { findDemoBoard } from "../../demoRegistry";

import {
  Action,
  BoardDescriptor,
  ExternalInput,
  RuntimeDescriptor,
  PlaygroundState,
  AcceptedSyncSenders,
  RejectedSyncSenders,
  RuntimeClass,
} from "../../types";
import { createBoardLink, createBoardSrcLink } from "./BoardLink";
import { restoreCoordinators, withCoordinatorEngines } from "../../common";
import { AppCtx } from "../../AppContext";
import { PlaygroundProps } from "./Playground.types";

/** The two keys that make a board a unit, a composition, or both. */
type UnitDocument = Pick<UnitBoard, "unit" | "units">;

const restoredAvailableRuntimeEngines = JSON.parse(
  localStorage.getItem("available-remote-runtimes") || "[]",
);

export type PlaygroundControllerProps = PlaygroundProps;

export type PlaygroundControllerState = {
  boardProviderRef: React.MutableRefObject<BoardProviderHandle | null>;
  currentUser: any;
  requestedBoardName: string;
  description: string;
  isSaveDialogVisible: boolean;
  setIsSaveDialogVisible: (v: boolean) => void;
  showShareBoardQRCodeURL: string | null;
  setShowShareBoardQRCodeURL: (url: string | null) => void;
  playgroundRuntimeEngines: Array<RuntimeClass>;
  fetchBoard: () => Promise<BoardDescriptor>;
  onRemoveRuntime: (rt: RuntimeDescriptor) => Promise<void>;
  newBoard: (searchParams?: string) => Promise<void>;
  onClearPlayground: () => Promise<void>;
  saveBoard: (showDialog?: boolean) => Promise<void>;
  isActionAvailable: (action: Action) => boolean;
  serializeBoard: (
    descriptor: BoardDescriptor,
  ) => Promise<PlaygroundState | null>;
  onUpdateBoardState: (newState: BoardDescriptor) => void;
  onAction: (action: Action) => boolean;
  onSaveDialog: (
    name: string,
    desc: string,
    isSuggestedName: boolean,
  ) => Promise<BoardDescriptor | null | undefined>;
  onChangeBoardname: (newName: string) => void;
  unitOrigin: () => UnitOrigin | undefined;
  /** What BoardProvider hands its snapshots to: the host's, or the drafts. */
  onBoardSnapshot?: (snapshot: BoardSnapshot) => void;
  snapshotOnLoad?: boolean;
};

export function usePlaygroundController(
  props: PlaygroundControllerProps,
): PlaygroundControllerState {
  const appContext = useContext(AppCtx);

  const boardProviderRef = useRef<BoardProviderHandle | null>(null);
  const externalInputs = useRef<{ [runtimeId: string]: ExternalInput }>({});
  const user = useRef(null);

  const [isSaveDialogVisible, setIsSaveDialogVisible] = useState(false);
  const [showShareBoardQRCodeURL, setShowShareBoardQRCodeURL] = useState<
    string | null
  >(null);
  // The board's name before anything is loaded: the route names it where the
  // host routes by board (the website playground), the prop where the host
  // opens a board itself (Readymade's sessions). Without the prop a board
  // opened by descriptor would fall back to the placeholder name and be saved
  // and uploaded under that.
  const [requestedBoardName, setRequestedBoardName] = useState<string>(
    (props.match && props.match.params && props.match.params.board) ||
      props.boardName ||
      defaultName,
  );
  const [description, setDescription] = useState("");
  // Where the current board was fetched from, when it came from a URL. Its
  // units are relative to that, the same way any relative URL would be.
  const boardSourceUrlRef = useRef<string | null>(null);
  const facadeRef = useRef<FacadeDescriptor | undefined>(undefined);
  const [initialFetched, setInitialFetched] = useState(false);
  const [acceptedSyncSenders, setAcceptedSyncSenders] =
    useState<AcceptedSyncSenders>([]);
  const [rejectedSyncSenders, setRejectedSyncSenders] =
    useState<RejectedSyncSenders>([]);

  // Keep refs for values used inside stable callbacks
  const requestedBoardNameRef = useRef(requestedBoardName);
  const descriptionRef = useRef(description);
  const initialFetchedRef = useRef(initialFetched);
  const acceptedSyncSendersRef = useRef(acceptedSyncSenders);
  const rejectedSyncSendersRef = useRef(rejectedSyncSenders);

  useEffect(() => {
    requestedBoardNameRef.current = requestedBoardName;
  }, [requestedBoardName]);

  // Drafts are this controller's own snapshots, for a host that asked for them
  // and does not take the snapshots itself.
  const draftsEnabled = !!props.keepDrafts && !props.onBoardSnapshot;
  // What a draft is kept under: the address the board is at, since reloading
  // that address is what has to bring it back. The route's name where there is
  // one; the board's own name wins nowhere, as a demo keeps its title under a
  // generated address.
  const routeBoardRef = useRef<string | undefined>(undefined);
  routeBoardRef.current = props.match?.params?.board;
  const draftName = () => routeBoardRef.current || requestedBoardNameRef.current;
  // Units a restored draft was stored with, keyed by `uri`: a composition
  // restored from a draft has nowhere else to link them from.
  const draftUnitsRef = useRef<Record<string, UnitBoard> | undefined>(
    undefined,
  );

  const writeDraft = useCallback((snapshot: BoardSnapshot) => {
    const name = draftName();
    if (name) {
      void browserDraftStore().save(name, snapshot.documents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Settles what was kept of a board that is being saved: what was pending is
   * written first, so nothing lands after the draft is gone, and the draft is
   * then dropped — the save holds the same board.
   */
  const dropDraftsOnSave = useCallback(
    async (...names: Array<string | undefined>) => {
      if (!draftsEnabled) {
        return;
      }
      await boardProviderRef.current?.state.flushSnapshots();
      const drafts = browserDraftStore();
      for (const name of new Set(names)) {
        if (name) {
          await drafts.remove(name);
        }
      }
    },
    [draftsEnabled],
  );
  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);
  useEffect(() => {
    initialFetchedRef.current = initialFetched;
  }, [initialFetched]);
  useEffect(() => {
    acceptedSyncSendersRef.current = acceptedSyncSenders;
  }, [acceptedSyncSenders]);
  useEffect(() => {
    rejectedSyncSendersRef.current = rejectedSyncSenders;
  }, [rejectedSyncSenders]);

  const tryFetch = useCallback(async () => {
    try {
      await boardProviderRef.current?.fetchBoard();
    } catch (err: any) {
      appContext?.pushNotification({
        type: "error",
        message: err.message ? err.message : `Fetch failed`,
        timeout: 5000,
        error: err,
      });
    }
  }, [appContext]);

  const saveBoard = useCallback(
    async (showDialog = true) => {
      if (showDialog) {
        setIsSaveDialogVisible(true);
      } else if (
        boardProviderRef.current?.state.boardName ||
        requestedBoardNameRef.current
      ) {
        const loadedName = boardProviderRef.current?.state.boardName;
        const name = loadedName || requestedBoardNameRef.current;
        const desc = descriptionRef.current;
        const saveName = loadedName || props.boardName || name;
        // A board assembled from units is written back as the documents it was
        // assembled from, never as the one board it happens to be running as —
        // saving the projection would flatten the composition permanently. An
        // ordinary board is a composition of none and takes the same path.
        const documents =
          await boardProviderRef.current?.state.serializeBoardDocuments();
        const data = documents?.composition;

        if (props.onSaveBoard && data) {
          props.onSaveBoard(saveName, {
            ...data,
            description: desc,
          });
          await saveUnitDocuments(documents);
        } else {
          storeBoardToLocalStorage(
            name,
            JSON.stringify({ ...data, name, description: desc }),
            desc,
          );
          await dropDraftsOnSave(name, draftName());
          const units = await saveUnitDocuments(documents);
          appContext?.pushNotification({
            type: "success",
            message: units
              ? `The Board '${saveName}' and ${units} unit${units === 1 ? "" : "s"} were saved.`
              : `The Board '${saveName}' was saved.`,
          });
        }
      } else {
        appContext?.pushNotification({
          type: "error",
          message: "Saving board failed",
        });
      }
    },
    [appContext, props.boardName, props.onSaveBoard, dropDraftsOnSave],
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (
        (window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) &&
        e.keyCode === 83
      ) {
        e.preventDefault();
        saveBoard(false);
      }
    },
    [saveBoard],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKey, false);
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      tryFetch();
    }, 0);
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      document.removeEventListener("keydown", onKey);
      initialFetchedRef.current = false;
      setInitialFetched(false);
      boardProviderRef.current?.clearBoard();
    };
  }, []);

  // componentDidUpdate: board param changed
  const prevMatchBoardRef = useRef(props.match?.params?.board);
  const prevBoardNamePropRef = useRef(props.boardName);

  const onBoardChanged = async (newBoard: string) => {
    await boardProviderRef.current?.clearBoard();
    setRequestedBoardName(newBoard);
    setInitialFetched(false);
    requestedBoardNameRef.current = newBoard;
    initialFetchedRef.current = false;
    await tryFetch();
  };

  useEffect(() => {
    const currentBoard = props.match?.params?.board;
    const prevBoard = prevMatchBoardRef.current;
    if (currentBoard !== prevBoard && currentBoard) {
      onBoardChanged(currentBoard);
    }
    prevMatchBoardRef.current = currentBoard;
  });

  useEffect(() => {
    if (prevBoardNamePropRef.current !== props.boardName && props.boardName) {
      setRequestedBoardName(props.boardName);
    }
    prevBoardNamePropRef.current = props.boardName;
  });

  const getInitialPlayground =
    async (): Promise<Partial<PlaygroundState> | null> => {
      const params = Object.fromEntries(
        new URLSearchParams(document.location.search),
      );

      if (params.demo) {
        const demo = findDemoBoard(params.demo);
        if (demo) {
          return demo;
        }
      }

      boardSourceUrlRef.current = null;
      draftUnitsRef.current = undefined;
      const brd =
        props.match?.params?.board ||
        props.boardName ||
        requestedBoardNameRef.current;
      if (brd) {
        if (params.template) {
          return createBoardFromTemplate(params.template, params);
        } else if (params.src) {
          boardSourceUrlRef.current = params.src;
          return importBoard(params.src);
        } else if (params.fromLink) {
          return importFromLink(params.fromLink, params.vars);
        } else {
          const draft = draftsEnabled
            ? await browserDraftStore().load(brd)
            : undefined;
          const savedAt = localBoardSavedAt(brd);
          // The draft only when it is newer than the save: a draft outlives a
          // save that was made in another tab, and that save is then the board.
          if (
            draft &&
            (savedAt === undefined || Date.parse(draft.updatedAt) > savedAt)
          ) {
            draftUnitsRef.current = draft.documents.units.length
              ? Object.fromEntries(
                  draft.documents.units.map((unit) => [unit.uri, unit.board]),
                )
              : undefined;
            appContext?.pushNotification({
              type: "info",
              message:
                savedAt === undefined
                  ? `Restored the unsaved board '${brd}'.`
                  : `Restored the unsaved changes to '${brd}'.`,
            });
            return {
              ...(draft.documents.composition as Partial<PlaygroundState>),
              boardName: brd,
            };
          }
          const localBoard = restoreBoardFromLocalStorage(brd);
          if (localBoard) {
            return localBoard;
          }
        }
        return {
          runtimes: [],
          services: {},
          boardName: brd,
        };
      }
      console.error("Playground.getInitialPlayground() - no board name");
      return null;
    };

  const fetchBoard = async (): Promise<BoardDescriptor> => {
    if (initialFetchedRef.current) {
      return boardProviderRef.current!.state;
    }

    // A descriptor handed in by the host (a demo opened from the start page, a
    // restored session) is the board to load; only without one is the board
    // derived from the route, the URL parameters or local storage. Either way
    // it goes through the same path below, so its name, description and facade
    // end up in the state the board is saved from.
    const initialBord: Partial<PlaygroundState> | null =
      props.boardDescriptor || (await getInitialPlayground());
    if (!initialBord) {
      return boardProviderRef.current!.state;
    }

    const {
      boardName: bName = requestedBoardNameRef.current || defaultName,
      description: desc = "",
      facade: facadeData,
      acceptedSyncSenders: accepted = [],
      rejectedSyncSenders: rejected = [],
      runtimes = [],
      services = {},
      registry = {},
      unit,
      units,
      blocks,
    } = initialBord as PlaygroundState & UnitDocument;

    setAcceptedSyncSenders(accepted);
    setRejectedSyncSenders(rejected);
    setInitialFetched(true);
    setDescription(desc);

    // Keep refs in sync immediately for same-tick usage
    acceptedSyncSendersRef.current = accepted;
    rejectedSyncSendersRef.current = rejected;
    initialFetchedRef.current = true;
    descriptionRef.current = desc;
    facadeRef.current = facadeData;

    return {
      boardName: bName,
      runtimes,
      services,
      registry,
      facade: facadeData,
      // What the board says about being a unit, and which units it is made of,
      // travel with it: linking happens after this and has nothing else to read
      // them from. Dropping them here is indistinguishable from a board that
      // declares neither — an empty composition, silently.
      unit,
      units,
      // Blocks likewise: a use of one names a definition that only the board
      // holds, and a runtime handed the use unexpanded has no service to make.
      blocks,
    };
  };

  /**
   * Where this board's units are to be found, given how the board arrived.
   *
   * A file and a URL are the same idea — the units are named relative to the
   * composition — and differ only in who can read them: a URL is fetched, a
   * path is read through the host, which is the only one that can.
   */
  const unitOrigin = () => {
    const source = props.boardSource ?? boardSourceUrlRef.current;
    const fromSource = !source
      ? undefined
      : /^https?:\/\//i.test(source) || source.startsWith("/")
        ? urlUnitOrigin(source)
        : nativeFileUnitOrigin(source, async (uri) => {
            const contents = await readFileViaPlatform(uri);
            if (contents === null) {
              throw new Error(`Cannot read ${uri} on this platform`);
            }
            return contents;
          });

    // Documents handed over with the board come first: they are this board's
    // units, not a document that merely answers to the same name. A restored
    // session has nowhere else to look — it is at no URL and the files it was
    // opened from were not kept — so without them a composition comes back as
    // the flat board it was running as, and the faces its units contribute go
    // missing.
    const carried = props.unitDocuments ?? draftUnitsRef.current;
    const fromBoard =
      carried && Object.keys(carried).length
        ? filesUnitOrigin(
            new Map(Object.entries(carried)),
            "the documents this board was restored with",
          )
        : undefined;

    if (fromBoard && fromSource) {
      return chainUnitOrigins(fromBoard, fromSource);
    }
    return fromBoard ?? fromSource;
  };

  const serializeBoard = async (
    descriptor: BoardDescriptor,
  ): Promise<PlaygroundState | null> => {
    const desc = descriptionRef.current;
    const accepted = acceptedSyncSendersRef.current;
    const rejected = rejectedSyncSendersRef.current;

    return {
      ...descriptor,
      description: desc,
      // The board's facade, not the one the board was fetched with: a board
      // that arrived by drop, by applying edited source or over a share link
      // never went through `fetchBoard`, and serialising the fetched one would
      // save it without the facade it is being looked at through.
      facade: boardProviderRef.current?.state.facade ?? facadeRef.current,
      acceptedSyncSenders: accepted,
      rejectedSyncSenders: rejected,
    };
  };

  const onUpdateBoardState = (newState: BoardDescriptor) => {
    if (props.onUpdateBoardState) {
      props.onUpdateBoardState(newState);
    }
  };

  const newBoard = async (searchParams = "") => {
    if (props.onNewBoard) {
      props.onNewBoard(boardProviderRef.current?.state);
    } else {
      await boardProviderRef.current?.clearBoard();
      const name = generateRandomName();
      props.navigate(`/playground/${name}${searchParams}`, {
        replace: true,
      });
    }
  };

  const onRemoveRuntime = async (rt: RuntimeDescriptor) => {
    const externalInput = externalInputs.current[rt.id];
    if (externalInput) {
      externalInput.close();
      delete externalInputs.current[rt.id];
    }
  };

  const onClearPlayground = async () => {
    for (const ext of Object.keys(externalInputs.current)) {
      externalInputs.current[ext].close();
    }
    externalInputs.current = {};
    // The description belongs to the board being cleared, not the next one.
    setDescription("");
    descriptionRef.current = "";
  };

  const isActionAvailable = (action: Action) => {
    switch (action.type) {
      case "shareBoard":
        return false;
      case "saveBoard":
      case "clearBoard":
      case "createBoardLink":
      case "showBoardSource":
        return true;

      default:
        break;
    }
    return true;
  };

  const onCreateBoardLink = async () => {
    const data = await boardProviderRef.current?.state.serializeBoard();
    if (data) {
      const url = createBoardLink(
        JSON.stringify({
          runtimes: data.runtimes,
          services: data.services,
        }),
      );
      try {
        navigator.clipboard.writeText(url);
        appContext?.pushNotification({
          type: "info",
          message: "Board URL copied to clipboard",
          action: {
            label: "QR Code",
            callback: () => {
              setShowShareBoardQRCodeURL(url);
            },
          },
        });
      } catch (_err) {
        appContext?.pushNotification({
          type: "info",
          message: "Could not copy to clipboard",
          action: {
            label: "QR Code",
            callback: () => {
              setShowShareBoardQRCodeURL(url);
            },
          },
        });
      }
    }

    return true;
  };

  const onAction = (action: Action) => {
    if (action.type === "createBoardLink") {
      onCreateBoardLink();
      return true;
    } else if (action.type === "showBoardSource") {
      boardProviderRef.current?.state.serializeBoard().then((data) => {
        if (data) {
          createBoardSrcLink(
            JSON.stringify({
              runtimes: data.runtimes,
              services: data.services,
            }),
          );
        }
      });
      return true;
    }
    return false;
  };

  const onSaveDialog = async (
    name: string,
    desc: string,
    isSuggestedName: boolean,
  ) => {
    // Saving under a new name renames the composition; its units keep their own
    // documents and are written back where they came from.
    const documents =
      await boardProviderRef.current?.state.serializeBoardDocuments();
    await saveUnitDocuments(documents);
    const data = documents?.composition;
    if (props.onSaveBoard && data) {
      props.onSaveBoard(name, { ...data, boardName: name, description: desc });
    } else {
      storeBoardToLocalStorage(
        name,
        // Saving under a name is what the board is called from here on — the
        // document says so too, or opening it again restores the name it had
        // before it was ever saved.
        JSON.stringify({ ...data, boardName: name, description: desc }),
        desc,
      );
      // Under the name it was saved as, and the address it was sketched at:
      // saving under a new name moves the board, and leaves nothing behind.
      await dropDraftsOnSave(name, draftName());

      if (!isSuggestedName) {
        setTimeout(
          () => props.navigate(`/playground/${name}`, { replace: true }),
          0,
        );
      }
    }

    // The board is now called what it was saved as — on every host, not only
    // where a route change happens to carry the new name. Without this the
    // title keeps the name the board had before it was ever saved, and the next
    // save dialog suggests that stale name back.
    boardProviderRef.current?.state.setBoardName(name);
    setRequestedBoardName(name);
    requestedBoardNameRef.current = name;
    props.onChangeBoardname?.(name);

    setDescription(desc);
    descriptionRef.current = desc;
    setIsSaveDialogVisible(false);
    return data;
  };

  const onChangeBoardname = (newName: string) => {
    if (!props.onChangeBoardname) {
      props.navigate(`/playground/${newName}`);
      return;
    }
    props.onChangeBoardname(newName);
  };

  const currentUser = (appContext && appContext?.user) || user.current;

  // Coordinators come last and only when their host isn't already configured
  // as a remote: a board may put runtimes on the server behind a coordinator
  // it knows, without the user registering the same address twice. Read once
  // per mount, like the restored engines above.
  const configuredCoordinators = useMemo(() => restoreCoordinators(), []);
  // Memoized because BoardProvider resets its engine pool whenever this prop
  // changes identity, which would drop engines added while a board is open.
  const playgroundRuntimeEngines = useMemo(
    () =>
      withCoordinatorEngines(
        props.availableRuntimeEngines
          ? props.availableRuntimeEngines
          : availableRuntimeEngines.concat(restoredAvailableRuntimeEngines),
        configuredCoordinators,
      ),
    [props.availableRuntimeEngines, configuredCoordinators],
  );

  return {
    boardProviderRef,
    currentUser,
    requestedBoardName,
    description,
    isSaveDialogVisible,
    setIsSaveDialogVisible,
    showShareBoardQRCodeURL,
    setShowShareBoardQRCodeURL,
    playgroundRuntimeEngines,
    fetchBoard,
    onRemoveRuntime,
    newBoard,
    onClearPlayground,
    saveBoard,
    isActionAvailable,
    serializeBoard,
    onUpdateBoardState,
    onAction,
    onSaveDialog,
    onChangeBoardname,
    unitOrigin,
    onBoardSnapshot: draftsEnabled ? writeDraft : props.onBoardSnapshot,
    snapshotOnLoad: draftsEnabled ? false : undefined,
  };
}

/**
 * Writes each unit of a composition back to the saved board it came from.
 *
 * Addressed the way it was resolved — by the base name of its `uri` — so a save
 * lands where the next load will look. A unit read from a URL has no writable
 * place to go back to and is skipped rather than being copied into local
 * storage under a name nothing references.
 */
async function saveUnitDocuments(
  documents: BoardDocuments | null | undefined,
): Promise<number> {
  if (!documents?.units.length) {
    return 0;
  }
  let written = 0;
  for (const unit of documents.units) {
    // Named by the base name of the reference that found it, so the next load
    // looks it up where this put it. The board keeps its own `boardName`: that
    // is the unit's identity to a server, and the library key is not.
    const name = unitBaseName(unit.uri);
    // The host's library first. Where the host keeps one — the native app keeps
    // it on disk — writing to local storage instead would scatter a composition
    // across two stores and leave the units unfindable on the next load.
    const saved = await saveSavedBoardViaPlatform(name, unit.board);
    if (!saved) {
      storeBoardToLocalStorage(
        name,
        JSON.stringify({ ...unit.board, name }, null, 2),
        unit.board.description,
      );
    }
    written += 1;
  }
  return written;
}
