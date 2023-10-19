import { Component } from "react";
import { Loader } from "semantic-ui-react";
import * as uuid from "uuid";

import { withRouter, WithRouterProps } from "../../common";
import { AppContextState, AppCtx } from "../../AppContext";
import BoardProvider, {
  BoardConsumer,
  BoardContextState,
} from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";
import BrowserRegistry from "../../runtime/BrowserRegistry";
import SaveBoardPrompt, {
  SaveBoardApi,
} from "../../components/SaveBoardPrompt";
import VSpacer from "../../components/shared/VSpacer";
import EmptySketch from "./EmptySketch";
import Board from "./Board";
import BoardSync from "./boardsync";
import LoadPanel from "./LoadPanel";
import Login from "../Login";
import { generateRandomName } from "../../core/board";
import { filterPrivateMembers, sleep } from "../../runtime/services/helpers";
import { s, t } from "../../styles";
import { localStoragePrefix, defaultName, availableRuntimes } from "./common";
import {
  importBoard,
  createBoardFromTemplate,
  importFromLink,
} from "./BoardActions";
import {
  addService as addServiceREST,
  setRuntime as setRuntimeREST,
  getRuntimeRegistry as getRuntimeRegistryREST,
} from "../../core/actions";
import { createFreeRuntime } from "../../core/graphqlActions";
import {
  Action,
  AddServiceResult,
  BoardDescriptor,
  ExternalInput,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceClass,
  SidechainRoute,
  SidechainRouting,
  PeerInputRouting,
  PeerOutputRouting,
  PlaygroundState,
  ServiceId,
} from "../../types";
import { createBoardLink, createBoardSrcLink } from "./BoardLink";

const restoredAvailableRuntimes = JSON.parse(
  localStorage.getItem("available-remote-runtimes") || "[]"
);

type Props = WithRouterProps;

type State = {
  boardName: string;
  description: string;
  initialFetched: boolean;
  requireLogin: boolean;

  // BoardSync data
  syncedPeer: string | undefined;
  boardSyncActive: boolean;
  acceptedSyncSenders: Array<any>; // TODO
  rejectedSyncSenders: Array<any>; // TODO

  sidechainRouting: SidechainRouting;
  inputRouting: PeerInputRouting;
  outputRouting: PeerOutputRouting;

  enforceLoadPanel?: boolean;
};

class Playground extends Component<Props, State> {
  static contextType = AppCtx;
  context!: AppContextState;

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
    requireLogin: false,

    // BoardSync data
    syncedPeer: undefined,
    boardSyncActive: false,
    acceptedSyncSenders: [],
    rejectedSyncSenders: [],

    sidechainRouting: {},
    inputRouting: {},
    outputRouting: {},
  };

  user = {
    username: "Anonymous",
    userId: undefined,
  };

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
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKey);
    this.boardProviderRef?.clearBoard();
  }

  componentDidUpdate(prevProps: Props) {
    const board = this.props.match?.params?.board;
    const prevBoard = prevProps.match?.params?.board;
    if (board !== prevBoard && board) {
      this.boardProviderRef?.clearBoard().then(() =>
        this.setState({
          boardName: board,
          initialFetched: false,
        })
      );
    }
  }

  fetchData = async (): Promise<BoardDescriptor> => {
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
        for (const runtime of board.runtimes) {
          switch (runtime.type) {
            case "node": {
              const { id: runtimeId, ...desc } = runtime;
              const services = board.services[runtimeId];
              try {
                await setRuntimeREST(
                  name,
                  {
                    ...desc,
                    runtimeId,
                    params: { name },
                  },
                  services
                );
              } catch (err: any) {
                this.handleRequestError(err);
              }
              const registry = await getRuntimeRegistryREST(name, runtimeId);
              board.registry[runtimeId] = registry;
            }
          }
        }
        return board;
      }
    }
  };

  serializeBoard = async (
    descriptor: BoardDescriptor
  ): Promise<PlaygroundState | null> => {
    const maxRetries = 10;
    for (let i = 0; i < maxRetries && !this.board; ++i) {
      await sleep(10); // retry later
      if (i + 1 === maxRetries) {
        console.error("Could not serialize board within retries");
        return null;
      }
    }

    const board = this.board;
    if (!board) {
      throw new Error("serializeBoard() board is undefined");
    }

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

    const data = {
      runtimes: descriptor.runtimes.map((rt) => ({
        ...rt,
        state: board.getRuntimeById(rt.id)?.serialize() || {},
      })),
      services: Object.keys(descriptor.services).reduce((all, runtimeId) => {
        const rt = board.getRuntimeById(runtimeId);
        return {
          ...all,
          [runtimeId]: descriptor.services[runtimeId].map((s) => ({
            ...s,
            ...filterPrivateMembers(rt ? rt.getServiceById(s.uuid) : {}),
          })),
        };
      }, {}),
      registry: descriptor.registry,
    };
    return {
      ...data,
      sidechainRouting,
      outputRouting: Object.keys(outputRouting).reduce(
        (acc, cur) => ({ ...acc, [cur]: outputRouting[cur]?.route || null }),
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

  newBoard = async (searchParams = "") => {
    await this.boardProviderRef?.clearBoard();
    const name = generateRandomName();
    this.props.navigate(`/playground/${name}${searchParams}`, {
      replace: true,
    });
  };

  addService = (
    service: ServiceClass,
    runtime: RuntimeDescriptor
  ): AddServiceResult => {
    const svc = {
      ...service,
      uuid: uuid.v4(),
    };

    if (runtime?.type === "remote") {
      // TODO: GraphQL
    } else if (runtime?.type === "node") {
      addServiceREST(this.state.boardName, svc, runtime.id).then((created) =>
        console.log("CREATED SERVICE", created, svc)
      );
    } else {
      if (!this.board) {
        throw new Error("addService() board is undefined");
      }

      if (!this.board.getRuntimeById(runtime.id)) {
        console.warn("Could not find runtime for", runtime.id);
        return;
      }
    }

    return svc;
  };

  removeService = async (service: ServiceId, rt: RuntimeDescriptor) => {
    const runtime = this.board && this.board.getRuntimeById(rt.id);
    return runtime?.destroyService(service.uuid);
  };

  addRuntime = async (rtClass: RuntimeClass) => {
    switch (rtClass.type) {
      case "remote": {
        const desc = await createFreeRuntime(rtClass);
        if (!desc) {
          return null;
        }
        desc.type = "remote";
        const { registry, ...runtime } = desc;
        return { runtime, services: [] };
      }
      case "browser": {
        const { name, type, url } = rtClass;
        const runtimeId = uuid.v4();
        const rt: RuntimeDescriptor = {
          id: runtimeId,
          name,
          type,
          url,
        };

        return { runtime: rt, services: [] };
      }
      case "node":
        return null;
      default:
        throw new Error(
          `Playground.addRuntime() runtime type is not supported: ${rtClass.type}`
        );
    }
  };

  destroyRuntime = (runtime: RuntimeDescriptor) => {
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
    await this.destroyRuntime(runtime);
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
      this.context.pushNotification({
        type: "info",
        message: "Board was saved",
        tag: "save",
      });
    } else {
      this.context.pushNotification({
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
        return (this.boardProviderRef?.state?.runtimes || []).length > 0;
      case "toggleBoardSync":
        return true;

      default:
        break;
    }
    return true;
  };

  handleRequestError = (err: Error) => {
    if (err.message === "Unauthorized") {
      this.setState({ requireLogin: true });
    } else {
      console.error("Unkown request error", err);
    }
  };

  renderPlaceholderOrBoard = (boardContext: BoardContextState) => {
    const { boardName, enforceLoadPanel } = this.state;
    const isPlaygroundEmpty =
      boardContext &&
      boardContext.runtimes &&
      boardContext.runtimes.length === 0;
    const content = isPlaygroundEmpty ? (
      <EmptySketch boardName={boardName} />
    ) : (
      this.renderBoard(boardContext)
    );
    const saveReminder = (
      <div style={s(t.fs14, t.mb10, { fontFamily: "Lato" })}>
        Remember to
        <span
          style={{ cursor: "help", color: "#4284C4" }}
          onClick={() => {
            const selector = document.getElementById("board-dropdown");
            if (selector) {
              selector.focus();
              selector.click();
            }
          }}
        >
          {" save this board "}
        </span>
        and continue later by{" "}
        <span
          id="load-pane-view"
          style={{
            color: "#4284c4",
            cursor: "pointer",
          }}
          onClick={() =>
            this.setState(
              (state) => ({ ...state, enforceLoadPanel: true }),
              () =>
                setTimeout(() =>
                  document
                    .getElementById("load-pane-view")
                    ?.scrollIntoView({ behavior: "smooth" })
                )
            )
          }
        >
          restoring a local board
        </span>
      </div>
    );
    return (
      <div style={t.w100}>
        <div
          style={{
            width: "99%",
            margin: "auto",
          }}
        >
          <div style={s(t.fs16, t.ls1, t.tc)}>
            {isPlaygroundEmpty && (
              <h1
                style={s(t.uc, t.fs20, {
                  margin: 0,
                  marginTop: "5%",
                })}
              >
                Welcome to Playground
              </h1>
            )}
            <div>
              {content}
              {!isPlaygroundEmpty ? saveReminder : false}
            </div>
            {(isPlaygroundEmpty || enforceLoadPanel) && (
              <div style={s(t.uc, { width: "90%", margin: "auto" })}>
                <LoadPanel />
              </div>
            )}
          </div>
        </div>
        <VSpacer />
      </div>
    );
  };

  renderBoard = (boardContext: BoardContextState) => {
    const {
      description,
      boardName,
      sidechainRouting,
      outputRouting,
      inputRouting,
    } = this.state;
    return (
      <Board
        ref={(board) => (this.board = board)}
        appContext={this.context}
        boardContext={boardContext}
        description={description}
        boardName={boardName}
        sidechainRouting={sidechainRouting}
        outputRouting={outputRouting}
        onChangeOutputRouting={(runtime, routing) => {
          const { hostDescriptor, route } = routing;
          const { peer, flow } = route;
          this.setState({
            outputRouting: {
              ...outputRouting,
              [runtime.id]: {
                hostDescriptor: hostDescriptor || null,
                route: {
                  peer: peer || outputRouting[runtime.id]?.route.peer || null,
                  flow,
                },
              },
            },
          });
        }}
        inputRouting={inputRouting}
        onChangeInputRouting={(runtime, value) =>
          this.setState({
            inputRouting: {
              ...this.state.inputRouting,
              [runtime.id]: value,
            },
          })
        }
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
      />
    );
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
        onUpdate={(update: any) =>
          this.setState(update, boardContext.fetchData)
        }
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

  renderLoadIndicator = () => {
    return (
      <div
        style={s(t.uc, t.ls1, {
          position: "absolute",
          left: "45%",
          top: "45%",
        })}
      >
        <Loader active inline>
          Loading Playground
        </Loader>
      </div>
    );
  };

  render() {
    const { requireLogin } = this.state;
    const appContext = this.context;
    return (
      <BoardProvider
        ref={(ref) => (this.boardProviderRef = ref)}
        key={`playground-${this.state.boardName}`}
        user={(appContext && appContext.user) || this.user}
        boardName={this.state.boardName}
        fetchData={this.fetchData}
        isRuntimeInScope={() => true}
        addRuntime={this.addRuntime}
        removeRuntime={this.removeRuntime}
        addService={this.addService}
        removeService={this.removeService}
        newBoard={this.newBoard}
        clearBoard={this.clearPlayground}
        saveBoard={this.saveBoard}
        isActionAvailable={this.isActionAvailable}
        serializeBoard={this.serializeBoard}
        onAction={(action: Action): boolean => {
          if (action.type === "toggleBoardSync") {
            this.setState({ boardSyncActive: !this.state.boardSyncActive });
            return true;
          } else if (action.type === "createBoardLink") {
            this.boardProviderRef?.state.serializeBoard().then(
              (data) =>
                data &&
                createBoardLink(
                  JSON.stringify({
                    runtimes: data.runtimes,
                    services: data.services,
                  })
                )
            );
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
        availableRuntimes={availableRuntimes.concat(restoredAvailableRuntimes)}
      >
        <BoardConsumer>
          {(boardContext) =>
            boardContext && (
              <div style={t.fill}>
                <Toolbar
                  board={this.state.boardName}
                  showRuntimeMenu={true}
                  onUpdateAvailableRuntimes={(runtimes) =>
                    localStorage.setItem(
                      "available-remote-runtimes",
                      JSON.stringify(
                        runtimes.filter((rt) => rt.type === "remote")
                      )
                    )
                  }
                  isCompact={boardContext.appViewMode !== "wide"}
                  boardSyncActive={this.state.boardSyncActive}
                />
                {requireLogin ? (
                  <Login board={`playground/${boardContext.boardName}`} />
                ) : (
                  <>
                    <SaveBoardPrompt
                      onRef={(prompt) => (this.prompt = prompt)}
                    />
                    {this.state.boardSyncActive &&
                      this.renderBoardSync(boardContext)}
                    {this.state.initialFetched
                      ? this.renderPlaceholderOrBoard(boardContext)
                      : this.renderLoadIndicator()}
                  </>
                )}

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
