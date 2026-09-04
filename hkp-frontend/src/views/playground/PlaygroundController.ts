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
import { UnitOrigin, urlUnitOrigin } from "../../core/linkUnits";
import {
  UnitBoard,
  unitBaseName,
} from "../../runtime/board/units";

import {
  defaultName,
  availableRuntimeEngines,
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
  const [requestedBoardName, setRequestedBoardName] = useState<string>(
    (props.match && props.match.params && props.match.params.board) ||
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
          saveUnitDocuments(documents);
        } else {
          storeBoardToLocalStorage(
            name,
            JSON.stringify({ ...data, name, description: desc }),
            desc,
          );
          const units = saveUnitDocuments(documents);
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
    [appContext, props.boardName, props.onSaveBoard],
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
    };
  };

  const unitOrigin = () =>
    boardSourceUrlRef.current
      ? urlUnitOrigin(boardSourceUrlRef.current)
      : undefined;

  const serializeBoard = async (
    descriptor: BoardDescriptor,
  ): Promise<PlaygroundState | null> => {
    const desc = descriptionRef.current;
    const accepted = acceptedSyncSendersRef.current;
    const rejected = rejectedSyncSendersRef.current;

    return {
      ...descriptor,
      description: desc,
      facade: facadeRef.current,
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
    saveUnitDocuments(documents);
    const data = documents?.composition;
    if (props.onSaveBoard && data) {
      props.onSaveBoard(name, { ...data, description: desc });
    } else {
      storeBoardToLocalStorage(
        name,
        JSON.stringify({ ...data, name, description: desc }),
        desc,
      );

      if (!isSuggestedName) {
        setTimeout(
          () => props.navigate(`/playground/${name}`, { replace: true }),
          0,
        );
      }
    }

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
function saveUnitDocuments(documents: BoardDocuments | null | undefined): number {
  if (!documents?.units.length) {
    return 0;
  }
  let written = 0;
  for (const unit of documents.units) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(unit.uri)) {
      console.warn(
        `Unit "${unit.name}" came from ${unit.uri} and cannot be saved back there.`,
      );
      continue;
    }
    const name = unitBaseName(unit.uri);
    storeBoardToLocalStorage(
      name,
      JSON.stringify({ ...unit.board, name }, null, 2),
      unit.board.description,
    );
    written += 1;
  }
  return written;
}
