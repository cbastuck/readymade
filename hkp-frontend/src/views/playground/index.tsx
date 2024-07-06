import { Component } from "react";

import { withRouter, WithRouterProps } from "../../common";

import BoardProvider, { BoardConsumer } from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "@/components/Footer";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import SaveBoardDialog from "../../components/SaveBoardDialog";
import Board from "./Board";

import { generateRandomName } from "../../core/board";
import { t } from "../../styles";
import {
  localStoragePrefix,
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
} from "../../types";
import { createBoardLink, createBoardSrcLink } from "./BoardLink";
import browserRuntimeApi from "../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../runtime/remote/RemoteRuntimeApi";
import BoardEntryPoint from "./BoardEntryPoint";
import { AppCtx } from "../../AppContext";
import BoardFetchError from "./BoardFetchError";
import ShareQRCodeDialog from "@/components/ShareQRCodeDialog";

const restoredAvailableRuntimeEngines = JSON.parse(
  localStorage.getItem("available-remote-runtimes") || "[]"
);

type Props = WithRouterProps & {
  boardName?: string;
  compact?: boolean;
  availableRuntimeEngines?: Array<RuntimeClass>;
  onChangeBoardname?: (newName: string) => void;
  onSaveBoard?: (name: string, payload: BoardDescriptor) => void;
};

type State = {
  boardName: string;
  description: string;
  initialFetched: boolean;

  acceptedSyncSenders: AcceptedSyncSenders;
  rejectedSyncSenders: RejectedSyncSenders;

  // Peer routing
  sidechainRouting: SidechainRouting;
  inputRouting: RuntimeInputRoutings;
  outputRouting: RuntimeOutputRoutings;

  enforceLoadPanel?: boolean;
  isSaveDialogVisible: boolean;
  showShareBoardQRCodeURL: string | null;
};

class Playground extends Component<Props, State> {
  static contextType = AppCtx;
  declare context: React.ContextType<typeof AppCtx>;

  boardProviderRef: BoardProvider | null = null;

  defaultRegistry: BrowserRegistry | undefined = undefined;
  board: Board | null = null;

  state: State = {
    isSaveDialogVisible: false,
    showShareBoardQRCodeURL: null,
    boardName:
      (this.props.match &&
        this.props.match.params &&
        this.props.match.params.board) ||
      defaultName,
    description: "",
    initialFetched: false,

    acceptedSyncSenders: [],
    rejectedSyncSenders: [],

    sidechainRouting: {},
    inputRouting: {},
    outputRouting: {},
  };

  user = null;

  externalInputs: { [runtimeId: string]: ExternalInput } = {};

  onKey = (e: KeyboardEvent) => {
    if (
      (window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) &&
      e.keyCode === 83
    ) {
      e.preventDefault();
      this.saveBoard(false);
    }
  };

  componentDidMount() {
    document.addEventListener("keydown", this.onKey, false);
    this.tryFetch();
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKey);
    this.boardProviderRef?.clearBoard();
  }

  componentDidUpdate(prevProps: Props) {
    const board = this.props.match?.params?.board;
    const prevBoard = prevProps.match?.params?.board;
    if (board !== prevBoard && board) {
      this.onBoardChanged(board);
    }

    if (prevProps.boardName !== this.props.boardName && this.props.boardName) {
      this.setState({ boardName: this.props.boardName });
    }
  }

  tryFetch = async () => {
    try {
      await this.boardProviderRef?.fetchBoard();
    } catch (err: any) {
      this.context?.pushNotification({
        type: "error",
        message: err.message ? err.message : `Fetch failed`,
        timeout: 5000,
        error: err,
      });
    }
  };

  onBoardChanged = async (board: string) => {
    await this.boardProviderRef?.clearBoard();
    this.setState(
      {
        boardName: board,
        initialFetched: false,
      },
      this.tryFetch
    );
  };

  fetchBoard = async (): Promise<BoardDescriptor> => {
    if (this.state.initialFetched) {
      return this.boardProviderRef!.state;
    }

    const initialBord = await this.getInitialPlayground();
    if (!initialBord) {
      return this.boardProviderRef!.state;
    }

    const {
      boardName = this.state.boardName || defaultName,
      description = "",
      sidechainRouting = {},
      outputRouting = {},
      inputRouting = {},

      // playground specific board data
      acceptedSyncSenders = [],
      rejectedSyncSenders = [],
      runtimes = [],
      services = {},
      registry = {},
    } = initialBord;
    const data = {
      sidechainRouting,
      outputRouting,
      inputRouting,
      acceptedSyncSenders,
      rejectedSyncSenders,
    };

    this.setState({
      ...data,
      initialFetched: true,
      description,
    });

    return {
      boardName,
      runtimes,
      services,
      registry,
    };
  };

  getInitialPlayground = async (): Promise<Partial<PlaygroundState> | null> => {
    const board = this.props.match?.params?.board || this.props.boardName;
    if (board) {
      const params = Object.fromEntries(
        new URLSearchParams(document.location.search)
      );

      if (params.template) {
        return createBoardFromTemplate(params.template, params);
      } else if (params.src) {
        return importBoard(params.src);
      } else if (params.fromLink) {
        return importFromLink(params.fromLink);
      } else {
        const localBoard = restoreBoardFromLocalStorage(board);
        if (localBoard) {
          return localBoard;
        }
      }
      return {
        runtimes: [],
        services: {},
        boardName: board,
      };
    }
    console.error("Playground.getInitialPlayground() - no noard name");
    return null;
  };

  serializeBoard = async (
    descriptor: BoardDescriptor
  ): Promise<PlaygroundState | null> => {
    const {
      description = "",
      sidechainRouting = {},
      outputRouting = {},
      inputRouting = {},
      acceptedSyncSenders = [],
      rejectedSyncSenders = [],
    }: State = this.state;

    return {
      ...descriptor,
      sidechainRouting,
      outputRouting: Object.keys(outputRouting).reduce(
        (acc, cur) => ({
          ...acc,
          [cur]: { ...outputRouting[cur] },
        }),
        {}
      ),
      inputRouting: Object.keys(inputRouting).reduce(
        (acc, cur) => ({ ...acc, [cur]: inputRouting[cur]?.route || null }),
        {}
      ),
      description,
      acceptedSyncSenders,
      rejectedSyncSenders,
    };
  };

  onUpdateBoardState = (newState: BoardDescriptor) => {
    this.setState((state) => ({ ...state, ...newState }));
  };

  newBoard = async (searchParams = "") => {
    await this.boardProviderRef?.clearBoard();
    const name = generateRandomName();
    this.props.navigate(`/playground/${name}${searchParams}`, {
      replace: true,
    });
  };

  destroyRuntime = async (runtime: RuntimeDescriptor) => {
    const externalInput = this.externalInputs[runtime.id];
    if (externalInput) {
      externalInput.close();
      delete this.externalInputs[runtime.id];
    }

    /*
    const rt = this.board && this.board.getRuntimeById(runtime.id);
    if (!rt) {
      return;
    }

    return rt.destroyRuntime();
    */
  };

  removeRuntime = async (runtime: RuntimeDescriptor) => {
    return this.destroyRuntime(runtime);
  };

  clearPlayground = async (board: BoardDescriptor) => {
    const { runtimes = [] } = board;
    for (const runtime of runtimes) {
      await this.destroyRuntime(runtime);
    }

    for (const ext of Object.keys(this.externalInputs)) {
      this.externalInputs[ext].close();
    }
    this.externalInputs = {};
  };

  // save current board with shortcut Cmd+s -> see onSaveDialog
  saveBoard = async (showDialog = true) => {
    if (showDialog) {
      this.setState({ isSaveDialogVisible: true });
    } else if (this.state.boardName) {
      const { boardName: name, description } = this.state;
      const saveName = this.props.boardName || name;
      const data = await this.boardProviderRef?.state.serializeBoard();
      if (this.props.onSaveBoard && data) {
        this.props.onSaveBoard(saveName, {
          ...data,
          description,
        });
      } else {
        localStorage.setItem(
          `${localStoragePrefix}${name}`,
          JSON.stringify({ ...data, name, description })
        );
      }

      this.context?.pushNotification({
        type: "success",
        message: `The Board '${saveName}' was saved.`,
      });
    } else {
      this.context?.pushNotification({
        type: "error",
        message: "Saving board failed",
      });
    }
  };

  isActionAvailable = (action: Action) => {
    switch (action.type) {
      case "shareBoard":
        return false;
      case "saveBoard":
      case "clearBoard":
      case "createBoardLink":
      case "showBoardSource":
        return true; //(this.boardProviderRef?.state?.runtimes || []).length > 0;

      default:
        break;
    }
    return true;
  };

  onRemoveService = (instance: InstanceId, _runtime: RuntimeDescriptor) => {
    const updatedRoutings = Object.keys(this.state.sidechainRouting).reduce(
      (all, rtId) => {
        const routings = this.state.sidechainRouting[rtId];
        return {
          ...all,
          [rtId]: routings.filter(
            (routing) => routing.serviceUuid !== instance.uuid
          ),
        };
      },
      {}
    );
    this.setState({ sidechainRouting: updatedRoutings });
  };

  onCreateBoardLink = async () => {
    const data = await this.boardProviderRef?.state.serializeBoard();
    if (data) {
      const url = createBoardLink(
        JSON.stringify({
          runtimes: data.runtimes,
          services: data.services,
        })
      );
      navigator.clipboard.writeText(url);
      this.context?.pushNotification({
        type: "info",
        message: "Board URL copied to clipboard",
        action: {
          label: "QR Code",
          callback: () => {
            this.setState({ showShareBoardQRCodeURL: url });
          },
        },
      });
    }

    return true;
  };

  onSaveDialog = async (
    name: string,
    description: string,
    isSuggestedName: boolean
  ) => {
    const data = await this.boardProviderRef?.state.serializeBoard();
    if (this.props.onSaveBoard && data) {
      this.props.onSaveBoard(name, { ...data, description });
    } else {
      storeBoardToLocalStorage(
        name,
        JSON.stringify({ ...data, name, description })
      );

      if (!isSuggestedName) {
        setTimeout(
          () => this.props.navigate(`/playground/${name}`, { replace: true }),
          0
        );
      }
    }

    this.setState(() => ({ description, isSaveDialogVisible: false }));
    return data;
  };

  onChangeBoardname = (newName: string) => {
    if (!this.props.onChangeBoardname) {
      this.props.navigate(`/playground/${newName}`);
      return;
    }
    this.props.onChangeBoardname(newName);
  };

  render() {
    const appContext = this.context;
    const runtimeApis: RuntimeApiMap = {
      browser: browserRuntimeApi,
      remote: remoteRuntimeApi,
    };

    const user = (appContext && appContext?.user) || this.user;

    const playgroundRuntimeEngines = this.props.availableRuntimeEngines
      ? this.props.availableRuntimeEngines
      : availableRuntimeEngines.concat(restoredAvailableRuntimeEngines);

    return (
      <BoardProvider
        ref={(ref) => (this.boardProviderRef = ref)}
        user={user}
        boardName={this.state.boardName}
        fetchBoard={this.fetchBoard}
        isRuntimeInScope={() => true}
        runtimeApis={runtimeApis}
        removeRuntime={this.removeRuntime}
        newBoard={this.newBoard}
        clearBoard={this.clearPlayground}
        saveBoard={this.saveBoard}
        isActionAvailable={this.isActionAvailable}
        serializeBoard={this.serializeBoard}
        onUpdateBoardState={this.onUpdateBoardState}
        onAction={(action: Action) => {
          if (action.type === "createBoardLink") {
            this.onCreateBoardLink();
            return true;
          } else if (action.type === "showBoardSource") {
            this.boardProviderRef?.state.serializeBoard().then((data) => {
              data &&
                createBoardSrcLink(
                  JSON.stringify({
                    runtimes: data.runtimes,
                    services: data.services,
                  })
                );
            });
            return true;
          }
          return false;
        }}
        onRemoveService={this.onRemoveService}
        availableRuntimeEngines={playgroundRuntimeEngines}
      >
        <BoardConsumer>
          {(boardContext) =>
            boardContext && (
              <div style={t.fill}>
                <Toolbar
                  showRuntimeMenu={true}
                  onUpdateAvailableRuntimeEngines={(engines) =>
                    localStorage.setItem(
                      "available-remote-runtimes",
                      JSON.stringify(
                        engines.filter((rt) => rt.type === "remote")
                      )
                    )
                  }
                  isCompact={this.props.compact}
                />

                <ShareQRCodeDialog
                  isOpen={this.state.showShareBoardQRCodeURL !== null}
                  url={this.state.showShareBoardQRCodeURL}
                  onClose={() =>
                    this.setState({ showShareBoardQRCodeURL: null })
                  }
                />

                <SaveBoardDialog
                  isOpen={this.state.isSaveDialogVisible}
                  suggestedName={
                    (this.props.match &&
                      this.props.match.params &&
                      this.props.match.params.board) ||
                    this.props.boardName ||
                    generateRandomName()
                  }
                  suggestedDescription={this.state.description}
                  onSave={this.onSaveDialog}
                  onCancel={() => this.setState({ isSaveDialogVisible: false })}
                />
                {boardContext.errorOnFetch ? (
                  <BoardFetchError
                    boardName={this.state.boardName}
                    error={boardContext.errorOnFetch}
                  />
                ) : (
                  <BoardEntryPoint
                    isLoading={
                      boardContext.isFetching || !!boardContext.awaitUserLogin
                    }
                    showLoginRequired={!!boardContext.awaitUserLogin}
                    boardContext={boardContext}
                    boardName={this.props.boardName || this.state.boardName}
                    description={this.state.description}
                    sidechainRouting={this.state.sidechainRouting}
                    outputRouting={this.state.outputRouting}
                    inputRouting={this.state.inputRouting}
                    onChangeSidechainRouting={(
                      runtime: RuntimeDescriptor,
                      routing: Array<SidechainRoute>
                    ) =>
                      this.setState({
                        sidechainRouting: {
                          ...this.state.sidechainRouting,
                          [runtime.id]: routing,
                        },
                      })
                    }
                    onChangeInputRouting={(runtime, value) => {
                      this.setState({
                        inputRouting: {
                          ...this.state.inputRouting,
                          [runtime.id]: value,
                        },
                      });
                    }}
                    onChangeOutputRouting={(runtime, routing) => {
                      this.setState({
                        outputRouting: {
                          ...this.state.outputRouting,
                          [runtime.id]: routing,
                        },
                      });
                    }}
                    onChangeBoardname={this.onChangeBoardname}
                  />
                )}

                <Footer isCompact={this.props.compact} />
              </div>
            )
          }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}

export default withRouter(Playground);
