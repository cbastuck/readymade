import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { FacadeDescriptor } from "../../facade/types";

import { BoardProviderHandle } from "../../BoardContext";

import { generateRandomName } from "../../core/board";

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
import { AppCtx } from "../../AppContext";
import { PlaygroundProps } from "./Playground.types";

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
      } else if (requestedBoardNameRef.current) {
        const name = requestedBoardNameRef.current;
        const desc = descriptionRef.current;
        const saveName = props.boardName || name;
        const data = await boardProviderRef.current?.state.serializeBoard();

        if (props.onSaveBoard && data) {
          props.onSaveBoard(saveName, {
            ...data,
            description: desc,
          });
        } else {
          storeBoardToLocalStorage(
            name,
            JSON.stringify({ ...data, name, description: desc }),
            desc,
          );
          appContext?.pushNotification({
            type: "success",
            message: `The Board '${saveName}' was saved.`,
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
      const brd =
        props.match?.params?.board ||
        props.boardName ||
        requestedBoardNameRef.current;
      if (brd) {
        const params = Object.fromEntries(
          new URLSearchParams(document.location.search),
        );

        if (params.template) {
          return createBoardFromTemplate(params.template, params);
        } else if (params.src) {
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

    const initialBord = await getInitialPlayground();
    if (!initialBord) {
      return boardProviderRef.current!.state;
    }

    if (props.boardDescriptor) {
      return props.boardDescriptor;
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
    } = initialBord;

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
    };
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
    const data = await boardProviderRef.current?.state.serializeBoard();
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

  const playgroundRuntimeEngines = props.availableRuntimeEngines
    ? props.availableRuntimeEngines
    : availableRuntimeEngines.concat(restoredAvailableRuntimeEngines);

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
  };
}
