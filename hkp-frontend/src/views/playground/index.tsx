import { Component } from "react";

import { withRouter, WithRouterProps } from "../../common";

import BoardProvider, {
  BoardConsumer,
  BoardContextState,
} from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "@/components/Footer.1";
import BrowserRegistry from "../../runtime/browser/BrowserRegistry";
import SaveBoardPrompt, {
  SaveBoardApi,
} from "../../components/SaveBoardPrompt";
import Board from "./Board";
import BoardSync from "./boardsync";
import { generateRandomName } from "../../core/board";
import { t } from "../../styles";
import { localStoragePrefix, defaultName, availableRuntimes } from "./common";
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
  PeerInputRouting,
  PeerOutputRouting,
  PlaygroundState,
  RuntimeApiMap,
  AcceptedSyncSenders,
  RejectedSyncSenders,
  InstanceId,
} from "../../types";
import { createBoardLink, createBoardSrcLink } from "./BoardLink";
import browserRuntimeApi from "../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../runtime/remote/RemoteRuntimeApi";
import BoardEntryPoint from "./BoardEntryPoint";
import { AppCtx } from "../../AppContext";

const restoredAvailableRuntimes = JSON.parse(
  localStorage.getItem("available-remote-runtimes") || "[]"
);

type Props = WithRouterProps;

type State = {
  boardName: string;
  description: string;
  initialFetched: boolean;

  // BoardSync data
  syncedPeer: string | undefined;
  boardSyncActive: boolean;
  acceptedSyncSenders: AcceptedSyncSenders;
  rejectedSyncSenders: RejectedSyncSenders;

  // Peer routing
  sidechainRouting: SidechainRouting;
  inputRouting: PeerInputRouting;
  outputRouting: PeerOutputRouting;

  enforceLoadPanel?: boolean;
};

class Playground extends Component<Props, State> {
  static contextType = AppCtx;
  declare context: React.ContextType<typeof AppCtx>;

  boardProviderRef: BoardProvider | null = null;

  defaultRegistry: BrowserRegistry | undefined = undefined;
  board: Board | null = null;
  prompt: SaveBoardApi | null = null;
  state: State = {
    boardName:
      (this.props.match &&
        this.props.match.params &&
        this.props.match.params.board) ||
      defaultName,
    description: "",
    initialFetched: false,

    // BoardSync data
    syncedPeer: undefined,
    boardSyncActive: false,
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
      boardSyncActive = false,
      syncedPeer = undefined,
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
      boardSyncActive,
      syncedPeer,
    });

    return {
      boardName,
      runtimes,
      services,
      registry,
    };
  };

  getInitialPlayground = async (): Promise<Partial<PlaygroundState> | null> => {
    const board = this.props.match?.params?.board;
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
        const localBoard = await this.restoreBoardFromLocalStorage(board);
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

  restoreBoardFromLocalStorage = async (name: string) => {
    const storageName = name
      ? `${localStoragePrefix}${name}`
      : "hkp-playground";
    const data = localStorage.getItem(storageName);

    if (data) {
      const board = JSON.parse(data);
      if (board && board.runtimes) {
        return board;
      }
    }
  };

  serializeBoard = async (
    descriptor: BoardDescriptor
  ): Promise<PlaygroundState | null> => {
    const {
      description = "",
      sidechainRouting = {},
      outputRouting = {},
      inputRouting = {},
      boardSyncActive = false,
      syncedPeer = undefined,
      acceptedSyncSenders = [],
      rejectedSyncSenders = [],
    }: State = this.state;

    return {
      ...descriptor,
      sidechainRouting,
      outputRouting: Object.keys(outputRouting).reduce(
        (acc, cur) => ({
          ...acc,
          [cur]: { route: outputRouting[cur]?.route || null },
        }),
        {}
      ),
      inputRouting: Object.keys(inputRouting).reduce(
        (acc, cur) => ({ ...acc, [cur]: inputRouting[cur]?.route || null }),
        {}
      ),
      description,
      boardSyncActive,
      syncedPeer,
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

  saveBoard = async (showDialog = true) => {
    if (this.prompt && showDialog) {
      const suggested =
        (this.props.match &&
          this.props.match.params &&
          this.props.match.params.board) ||
        generateRandomName();

      const userInput =
        (await this.prompt.acceptInput(suggested, this.state.description)) &&
        this.prompt.getValues();

      if (userInput) {
        const { name, description } = userInput;
        const data = await this.boardProviderRef?.state.serializeBoard();
        localStorage.setItem(
          `${localStoragePrefix}${name}`,
          JSON.stringify({ ...data, name, description })
        );
        this.setState(() => ({ description }));
        if (name !== suggested) {
          this.props.navigate(`/playground/${name}`, { replace: true });
        }
        return data;
      }
    } else if (this.state.boardName) {
      const { boardName: name, description } = this.state;
      const data = await this.boardProviderRef?.state.serializeBoard();
      localStorage.setItem(
        `${localStoragePrefix}${name}`,
        JSON.stringify({ ...data, name, description })
      );
      this.context?.pushNotification({
        type: "info",
        message: "Board was saved",
        tag: "save",
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
      case "toggleBoardSync":
        return true;

      default:
        break;
    }
    return true;
  };

  renderBoardSync = (boardContext: BoardContextState) => {
    return (
      <BoardSync
        active={this.state.boardSyncActive}
        syncedPeer={this.state.syncedPeer}
        onSyncedPeerChanged={(syncedPeer: string) =>
          this.setState({ syncedPeer })
        }
        boardContext={boardContext}
        onUpdate={(update: any) => this.setState(update, this.tryFetch)}
        onClose={(closedPeer: string) => {
          if (closedPeer === this.state.syncedPeer) {
            this.setState({ syncedPeer: undefined });
          }
        }}
        defaultBrowserRegistry={this.defaultRegistry}
        acceptedSenders={this.state.acceptedSyncSenders}
        rejectedSenders={this.state.rejectedSyncSenders}
        onChange={({
          acceptedSenders: acceptedSyncSenders = this.state.acceptedSyncSenders,
          rejectedSenders: rejectedSyncSenders = this.state.rejectedSyncSenders,
        }) => this.setState({ acceptedSyncSenders, rejectedSyncSenders })}
      />
    );
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
        message: `Copied to clipboard: ${url}`,
      });
    }

    return true;
  };

  render() {
    const appContext = this.context;
    const runtimeApis: RuntimeApiMap = {
      browser: browserRuntimeApi,
      remote: remoteRuntimeApi,
    };

    const user = (appContext && appContext?.user) || this.user;
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
          if (action.type === "toggleBoardSync") {
            this.setState({ boardSyncActive: !this.state.boardSyncActive });
            return true;
          } else if (action.type === "createBoardLink") {
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
        availableRuntimes={availableRuntimes.concat(restoredAvailableRuntimes)}
      >
        <BoardConsumer>
          {(boardContext) =>
            boardContext && (
              <div style={t.fill}>
                <Toolbar
                  showRuntimeMenu={true}
                  onUpdateAvailableRuntimes={(runtimes) =>
                    localStorage.setItem(
                      "available-remote-runtimes",
                      JSON.stringify(
                        runtimes.filter((rt) => rt.type === "remote")
                      )
                    )
                  }
                  isCompact={boardContext.appContext?.appViewMode !== "wide"}
                />

                <SaveBoardPrompt onRef={(prompt) => (this.prompt = prompt)} />
                {this.state.boardSyncActive &&
                  this.renderBoardSync(boardContext)}

                <BoardEntryPoint
                  isLoading={
                    !this.state.initialFetched || !!boardContext.awaitUserLogin
                  }
                  showLoginRequired={!!boardContext.awaitUserLogin}
                  boardContext={boardContext}
                  boardName={this.state.boardName}
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
                  onChangeInputRouting={(runtime, value) =>
                    this.setState({
                      inputRouting: {
                        ...this.state.inputRouting,
                        [runtime.id]: value,
                      },
                    })
                  }
                  onChangeOutputRouting={(runtime, routing) => {
                    const { hostDescriptor, route } = routing;
                    const { peer, flow } = route;
                    this.setState({
                      outputRouting: {
                        ...this.state.outputRouting,
                        [runtime.id]: {
                          hostDescriptor: hostDescriptor || null,
                          route: {
                            peer:
                              peer ||
                              this.state.outputRouting[runtime.id]?.route
                                ?.peer ||
                              null,
                            flow,
                          },
                        },
                      },
                    });
                  }}
                />

                <Footer />
              </div>
            )
          }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}

export default withRouter(Playground);
