import { useState, useEffect, useRef, useContext, useCallback } from "react";

import { withRouter, WithRouterProps } from "../../common";

import BoardProvider, {
  useBoardContext,
  BoardContextState,
  BoardProviderHandle,
} from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";
import SaveBoardDialog from "../../components/SaveBoardDialog";

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
  isRuntimeRestClassType,
  isRuntimeGraphQLClassType,
  BoardDescriptor,
  ExternalInput,
  RuntimeDescriptor,
  SidechainRoute,
  SidechainRouting,
  PlaygroundState,
  RuntimeApiMap,
  AcceptedSyncSenders,
  RejectedSyncSenders,
  InstanceId,
  RuntimeInputRoutings,
  RuntimeOutputRoutings,
  RuntimeClass,
  BoardMenuItemFactory,
} from "../../types";
import { createBoardLink, createBoardSrcLink } from "./BoardLink";
import browserRuntimeApi from "../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../runtime/graphql/RuntimeGraphQLApi";
import runtimeRestApi from "../../runtime/rest/RuntimeRestApi";
import BoardEntryPoint from "./BoardEntryPoint";
import { AppCtx } from "../../AppContext";
import BoardFetchError from "./BoardFetchError";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";

const restoredAvailableRuntimeEngines = JSON.parse(
  localStorage.getItem("available-remote-runtimes") || "[]",
);

export const runtimeApis: RuntimeApiMap = {
  browser: browserRuntimeApi,
  remote: remoteRuntimeApi,
  graphql: remoteRuntimeApi,
  realtime: runtimeRestApi,
  rest: runtimeRestApi,
};

type Props = WithRouterProps & {
  boardName?: string;
  compact?: boolean;
  availableRuntimeEngines?: Array<RuntimeClass>;
  onUpdateAvailableRuntimeEngines?: (
    runtimeClasses: Array<RuntimeClass>,
  ) => void | Promise<void>;
  boardDescriptor?: BoardDescriptor;
  children?: React.ReactNode;
  hideNavigation?: boolean;
  menuItemFactory?: BoardMenuItemFactory;
  onChangeBoardname?: (newName: string) => void;
  onSaveBoard?: (name: string, payload: BoardDescriptor) => void;
  onUpdateBoardState?: (newBoard: BoardDescriptor) => void;
  onNewBoard?: (ctx?: BoardContextState) => void;
};

type PlaygroundInnerProps = {
  boardName: string;
  description: string;
  compact?: boolean;
  hideNavigation?: boolean;
  menuItemFactory?: BoardMenuItemFactory;
  showShareBoardQRCodeURL: string | null;
  setShowShareBoardQRCodeURL: (url: string | null) => void;
  isSaveDialogVisible: boolean;
  suggestedName: string;
  onSaveDialog: (
    name: string,
    desc: string,
    isSuggestedName: boolean,
  ) => Promise<any>;
  setIsSaveDialogVisible: (v: boolean) => void;
  sidechainRouting: SidechainRouting;
  outputRouting: RuntimeOutputRoutings;
  inputRouting: RuntimeInputRoutings;
  setSidechainRouting: React.Dispatch<React.SetStateAction<SidechainRouting>>;
  setInputRouting: React.Dispatch<React.SetStateAction<RuntimeInputRoutings>>;
  setOutputRouting: React.Dispatch<React.SetStateAction<RuntimeOutputRoutings>>;
  onChangeBoardname: (newName: string) => void;
  onUpdateAvailableRuntimeEngines?: (
    runtimeClasses: Array<RuntimeClass>,
  ) => void | Promise<void>;
  propBoardName?: string;
  children?: React.ReactNode;
};

function PlaygroundInner(props: PlaygroundInnerProps) {
  const boardContext = useBoardContext();
  if (!boardContext) return null;
  return (
    <div
      className="w-full h-full bg-neutral-50 flex flex-col"
      style={{ width: "100%" }}
    >
      <Toolbar
        showRuntimeMenu={true}
        onUpdateAvailableRuntimeEngines={(engines) => {
          const filteredEngines = engines.filter(
            (rt) =>
              isRuntimeGraphQLClassType(rt.type) ||
              isRuntimeRestClassType(rt.type),
          );
          if (props.onUpdateAvailableRuntimeEngines) {
            props.onUpdateAvailableRuntimeEngines(filteredEngines);
            return;
          }

          localStorage.setItem(
            "available-remote-runtimes",
            JSON.stringify(filteredEngines),
          );
        }}
        isCompact={props.compact}
        menuItemFactory={props.menuItemFactory}
        hideNavigation={props.hideNavigation}
        includeNavigationLinks={!props.hideNavigation}
      />

      <ShareQRCodeDialog
        isOpen={props.showShareBoardQRCodeURL !== null}
        url={props.showShareBoardQRCodeURL}
        onClose={() => props.setShowShareBoardQRCodeURL(null)}
      />
      <SaveBoardDialog
        isOpen={props.isSaveDialogVisible}
        suggestedName={props.suggestedName}
        suggestedDescription={props.description}
        onSave={props.onSaveDialog}
        onCancel={() => props.setIsSaveDialogVisible(false)}
      />
      {boardContext.errorOnFetch ? (
        <BoardFetchError
          boardName={props.boardName}
          error={boardContext.errorOnFetch}
        />
      ) : (
        <BoardEntryPoint
          className="pt-2"
          isLoading={boardContext.isFetching || !!boardContext.awaitUserLogin}
          showLoginRequired={!!boardContext.awaitUserLogin}
          boardContext={boardContext}
          boardName={props.propBoardName || props.boardName}
          description={props.description}
          sidechainRouting={props.sidechainRouting}
          outputRouting={props.outputRouting}
          inputRouting={props.inputRouting}
          onChangeSidechainRouting={(
            runtime: RuntimeDescriptor,
            routing: Array<SidechainRoute>,
          ) =>
            props.setSidechainRouting((prev) => ({
              ...prev,
              [runtime.id]: routing,
            }))
          }
          onChangeInputRouting={(runtime, value) => {
            props.setInputRouting((prev) => ({
              ...prev,
              [runtime.id]: value,
            }));
          }}
          onChangeOutputRouting={(runtime, routing) => {
            props.setOutputRouting((prev) => ({
              ...prev,
              [runtime.id]: routing,
            }));
          }}
          onChangeBoardname={props.onChangeBoardname}
        />
      )}
      <Footer />
      {props.children || null}
    </div>
  );
}

function Playground(props: Props) {
  const appContext = useContext(AppCtx);

  const boardProviderRef = useRef<BoardProviderHandle | null>(null);
  const externalInputs = useRef<{ [runtimeId: string]: ExternalInput }>({});
  const user = useRef(null);

  const [isSaveDialogVisible, setIsSaveDialogVisible] = useState(false);
  const [showShareBoardQRCodeURL, setShowShareBoardQRCodeURL] = useState<
    string | null
  >(null);
  const [boardName, setBoardName] = useState<string>(
    (props.match && props.match.params && props.match.params.board) ||
      defaultName,
  );
  const [description, setDescription] = useState("");
  const [initialFetched, setInitialFetched] = useState(false);
  const [acceptedSyncSenders, setAcceptedSyncSenders] =
    useState<AcceptedSyncSenders>([]);
  const [rejectedSyncSenders, setRejectedSyncSenders] =
    useState<RejectedSyncSenders>([]);
  const [sidechainRouting, setSidechainRouting] = useState<SidechainRouting>(
    {},
  );
  const [inputRouting, setInputRouting] = useState<RuntimeInputRoutings>({});
  const [outputRouting, setOutputRouting] = useState<RuntimeOutputRoutings>({});

  // Keep refs for values used inside stable callbacks
  const boardNameRef = useRef(boardName);
  const descriptionRef = useRef(description);
  const initialFetchedRef = useRef(initialFetched);
  const acceptedSyncSendersRef = useRef(acceptedSyncSenders);
  const rejectedSyncSendersRef = useRef(rejectedSyncSenders);
  const sidechainRoutingRef = useRef(sidechainRouting);
  const inputRoutingRef = useRef(inputRouting);
  const outputRoutingRef = useRef(outputRouting);

  useEffect(() => {
    boardNameRef.current = boardName;
  }, [boardName]);
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
  useEffect(() => {
    sidechainRoutingRef.current = sidechainRouting;
  }, [sidechainRouting]);
  useEffect(() => {
    inputRoutingRef.current = inputRouting;
  }, [inputRouting]);
  useEffect(() => {
    outputRoutingRef.current = outputRouting;
  }, [outputRouting]);

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
      } else if (boardNameRef.current) {
        const name = boardNameRef.current;
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
    tryFetch();
    return () => {
      document.removeEventListener("keydown", onKey);
      boardProviderRef.current?.clearBoard();
    };
  }, []);

  // componentDidUpdate: board param changed
  const prevMatchBoardRef = useRef(props.match?.params?.board);
  const prevBoardNamePropRef = useRef(props.boardName);
  const prevBoardDescriptorRef = useRef(props.boardDescriptor);

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
      setBoardName(props.boardName);
    }
    prevBoardNamePropRef.current = props.boardName;
  });

  useEffect(() => {
    if (
      prevBoardDescriptorRef.current !== props.boardDescriptor &&
      props.boardDescriptor
    ) {
      boardProviderRef.current?.setBoardState(props.boardDescriptor);
    }
    prevBoardDescriptorRef.current = props.boardDescriptor;
  });

  const onBoardChanged = async (newBoard: string) => {
    await boardProviderRef.current?.clearBoard();
    setBoardName(newBoard);
    setInitialFetched(false);
    // tryFetch will be called via the initialFetched state change effect
    boardNameRef.current = newBoard;
    initialFetchedRef.current = false;
    await tryFetch();
  };

  const getInitialPlayground =
    async (): Promise<Partial<PlaygroundState> | null> => {
      const brd = props.match?.params?.board || props.boardName;
      if (brd) {
        const params = Object.fromEntries(
          new URLSearchParams(document.location.search),
        );

        if (params.template) {
          return createBoardFromTemplate(params.template, params);
        } else if (params.src) {
          return importBoard(params.src);
        } else if (params.fromLink) {
          return importFromLink(params.fromLink);
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
      console.error("Playground.getInitialPlayground() - no noard name");
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

    const {
      boardName: bName = boardNameRef.current || defaultName,
      description: desc = "",
      sidechainRouting: scRouting = {},
      outputRouting: outRouting = {},
      inputRouting: inRouting = {},

      // playground specific board data
      acceptedSyncSenders: accepted = [],
      rejectedSyncSenders: rejected = [],
      runtimes = [],
      services = {},
      registry = {},
    } = initialBord;

    setSidechainRouting(scRouting);
    setOutputRouting(outRouting);
    setInputRouting(inRouting);
    setAcceptedSyncSenders(accepted);
    setRejectedSyncSenders(rejected);
    setInitialFetched(true);
    setDescription(desc);

    // Keep refs in sync immediately for same-tick usage
    sidechainRoutingRef.current = scRouting;
    outputRoutingRef.current = outRouting;
    inputRoutingRef.current = inRouting;
    acceptedSyncSendersRef.current = accepted;
    rejectedSyncSendersRef.current = rejected;
    initialFetchedRef.current = true;
    descriptionRef.current = desc;

    return {
      boardName: bName,
      runtimes,
      services,
      registry,
    };
  };

  const serializeBoard = async (
    descriptor: BoardDescriptor,
  ): Promise<PlaygroundState | null> => {
    const desc = descriptionRef.current;
    const scRouting = sidechainRoutingRef.current;
    const outRouting = outputRoutingRef.current;
    const inRouting = inputRoutingRef.current;
    const accepted = acceptedSyncSendersRef.current;
    const rejected = rejectedSyncSendersRef.current;

    return {
      ...descriptor,
      sidechainRouting: scRouting,
      outputRouting: Object.keys(outRouting).reduce(
        (acc, cur) => ({
          ...acc,
          [cur]: { ...outRouting[cur] },
        }),
        {},
      ),
      inputRouting: Object.keys(inRouting).reduce(
        (acc, cur) => ({ ...acc, [cur]: inRouting[cur]?.route || null }),
        {},
      ),
      description: desc,
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

  const onRemoveService = (
    instance: InstanceId,
    _runtime: RuntimeDescriptor,
  ) => {
    const updatedRoutings = Object.keys(sidechainRoutingRef.current).reduce(
      (all, rtId) => {
        const routings = sidechainRoutingRef.current[rtId];
        return {
          ...all,
          [rtId]: routings.filter(
            (routing) => routing.serviceUuid !== instance.uuid,
          ),
        };
      },
      {},
    );
    setSidechainRouting(updatedRoutings);
    sidechainRoutingRef.current = updatedRoutings;
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

  return (
    <BoardProvider
      ref={boardProviderRef}
      user={currentUser}
      boardName={boardName}
      fetchBoard={fetchBoard}
      isRuntimeInScope={() => true}
      runtimeApis={runtimeApis}
      onRemoveRuntime={onRemoveRuntime}
      newBoard={newBoard}
      onClearBoard={onClearPlayground}
      saveBoard={saveBoard}
      isActionAvailable={isActionAvailable}
      serializeBoard={serializeBoard}
      onUpdateBoardState={onUpdateBoardState}
      onAction={(action: Action) => {
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
      }}
      onRemoveService={onRemoveService}
      availableRuntimeEngines={playgroundRuntimeEngines}
    >
      <PlaygroundInner
        boardName={boardName}
        description={description}
        compact={props.compact}
        hideNavigation={props.hideNavigation}
        menuItemFactory={props.menuItemFactory}
        showShareBoardQRCodeURL={showShareBoardQRCodeURL}
        setShowShareBoardQRCodeURL={setShowShareBoardQRCodeURL}
        isSaveDialogVisible={isSaveDialogVisible}
        suggestedName={
          (props.match && props.match.params && props.match.params.board) ||
          props.boardName ||
          generateRandomName()
        }
        onSaveDialog={onSaveDialog}
        setIsSaveDialogVisible={setIsSaveDialogVisible}
        sidechainRouting={sidechainRouting}
        outputRouting={outputRouting}
        inputRouting={inputRouting}
        setSidechainRouting={setSidechainRouting}
        setInputRouting={setInputRouting}
        setOutputRouting={setOutputRouting}
        onChangeBoardname={onChangeBoardname}
        onUpdateAvailableRuntimeEngines={props.onUpdateAvailableRuntimeEngines}
        propBoardName={props.boardName}
      >
        {props.children}
      </PlaygroundInner>
    </BoardProvider>
  );
}

const PlaygroundWithRouter = withRouter(Playground);
export default PlaygroundWithRouter;
