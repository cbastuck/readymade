import React, { Component } from "react";
import { Loader } from "semantic-ui-react";
import * as uuid from "uuid";

import { withRouter, WithRouterProps } from "../../common";
import { AppCtx } from "../../AppContext";
import BoardProvider, {
  BoardConsumer,
  BoardContextState,
} from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";
import BrowserRegistry from "../../runtime/BrowserRegistry";
import SaveBoardPrompt from "../../components/SaveBoardPrompt";
import VSpacer from "../../components/shared/VSpacer";
import EmptySketch from "./EmptySketch";
import Board from "./Board";
import BoardSync from "./boardsync";
import LoadPanel from "./LoadPanel";
import Login from "../Login";
import { generateRandomName } from "../../core/board";
import { filterPrivateMembers, sleep } from "../../runtime/services/helpers";
import { s, t } from "../../styles";
import {
  localStoragePrefix,
  defaultBundles,
  allowedServices,
  defaultName,
  availableRuntimes,
} from "./common";
import { importBoard, createBoardFromTemplate } from "./BoardActions";
import {
  addRuntime as addRuntimeREST,
  addService as addServiceREST,
  setRuntime as setRuntimeREST,
  getRuntimeRegistry as getRuntimeRegistryREST,
} from "../../core/actions";
import {
  createFreeRuntime,
  getRuntimeRegistry,
} from "../../core/graphqlActions";
import {
  Action,
  AddServiceResult,
  BoardDescriptor,
  ExternalInput,
  InputRouting,
  OutpoutRouting,
  PlaygroundBoard,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceDescriptor,
  SidechainRouting,
} from "../../types";

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

  sidechainRouting: { [runtimeId: string]: SidechainRouting };
  inputRouting: { [runtimeId: string]: InputRouting };
  outputRouting: { [runtimeId: string]: OutpoutRouting | null };
};

class Playground extends Component<Props, State> {
  static contextType = AppCtx;
  context!: React.ContextType<typeof AppCtx>;

  boardProviderRef: BoardProvider | null = null;

  defaultRegistry: BrowserRegistry | undefined = undefined;
  board: Board | null = null;
  prompt: SaveBoardPrompt | null = null;
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
  }

  componentDidUpdate(prevProps: Props) {
    const board = this.props.match?.params?.board;
    const prevBoard = prevProps.match?.params?.board;
    if (board !== prevBoard && board) {
      this.clearPlayground().then(() =>
        this.setState({
          boardName: board,
          initialFetched: false,
        })
      );
    }
  }

  fetchData = async (): Promise<BoardDescriptor> => {
    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles);
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
      registry = undefined,
      services = {},
    }: State & BoardDescriptor = this.state.initialFetched
      ? this.state
      : await this.setInitialPlayground();

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
      registry: registry // for backwards compatiblity: when we only had browser runtimes on the playground
        ? registry
        : runtimes &&
          runtimes.reduce(
            (all, rt) => ({
              ...all,
              [rt.id]:
                rt.type === "browser"
                  ? this.defaultRegistry?.availableServices || []
                  : [],
            }),
            {}
          ),
    };
  };

  setInitialPlayground = async () => {
    const board = this.props.match?.params?.board;
    if (board) {
      const params = Object.fromEntries(
        new URLSearchParams(document.location.search)
      );

      if (params.template) {
        return createBoardFromTemplate(params.template, params);
      } else if (params.src) {
        return importBoard(params.src);
      } else {
        const localBoard = await this.restoreBoardFromLocalStorage(board);
        if (localBoard) {
          return localBoard;
        }
        return {};
      }
    }
  };

  restoreBoardFromLocalStorage = async (name: string) => {
    const storageName = name
      ? `${localStoragePrefix}${name}`
      : "hkp-playground";
    const data = localStorage.getItem(storageName);
    if (data) {
      const board = JSON.parse(data);
      if (!board.registry) {
        board.registry = {};
      }
      if (board && board.runtimes) {
        for (const runtime of board.runtimes) {
          if (runtime.type === "remote" || runtime.type === "node") {
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
          } else if (runtime.type === "browser") {
            board.registry[runtime.id] =
              this.defaultRegistry?.availableServices || [];
          }
        }
      }
      return board;
    }
  };

  serializeBoard = async (
    descriptor: BoardDescriptor
  ): Promise<PlaygroundBoard | null> => {
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
        state: board.getRuntimeById(rt.id).serialize(),
      })),
      services: Object.keys(descriptor.services).reduce((all, runtimeId) => {
        const rt = board.getRuntimeById(runtimeId);
        return {
          ...all,
          [runtimeId]: descriptor.services[runtimeId].map((s) => ({
            ...s,
            ...filterPrivateMembers(rt.getServiceById(s.uuid)),
          })),
        };
      }, {}),
    };
    return {
      ...data,
      sidechainRouting,
      outputRouting,
      inputRouting,
      description,
      boardSyncActive,
      syncedPeer,
      acceptedSyncSenders,
      rejectedSyncSenders,
    };
  };

  newBoard = async (searchParams = "") => {
    await this.clearPlayground();
    const name = generateRandomName();
    this.props.navigate(`/playground/${name}${searchParams}`, {
      replace: true,
    });
  };

  addService = (
    service: ServiceDescriptor,
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

  removeService = async (service: ServiceDescriptor, rt: RuntimeDescriptor) => {
    const runtime = this.board && this.board.getRuntimeById(rt.id);
    if (!runtime) {
      await runtime.destroyService(service.uuid);
    }
  };

  addRuntime = async (desc: RuntimeClass) => {
    const runtimeId = uuid.v4();
    const { name, type, url } = desc;
    const rt: RuntimeDescriptor = {
      id: runtimeId,
      name,
      type,
      url,
    };
    let registry;
    if (type === "remote") {
      console.log("Adding GraphQL runtime", rt);
      await createFreeRuntime(rt);
      registry = await getRuntimeRegistry(rt);
    } else if (type === "node") {
      const created = await addRuntimeREST(this.state.boardName, {
        ...desc,
        runtimeId,
      });
      registry = await getRuntimeRegistryREST(name, created.id);
    } else {
      registry = this.defaultRegistry?.availableServices || [];
    }
    return { runtime: rt, services: [], registry };
  };

  destroyRuntime = (runtime: RuntimeDescriptor) => {
    const externalInput = this.externalInputs[runtime.id];
    if (externalInput) {
      externalInput.close();
      delete this.externalInputs[runtime.id];
    }

    const rt = this.board && this.board.getRuntimeById(runtime.id);
    if (!rt) {
      return;
    }

    return rt.destroyRuntime();
  };

  removeRuntime = async (runtime: RuntimeDescriptor) => {
    await this.destroyRuntime(runtime);
  };

  clearPlayground = async () => {
    const { runtimes = [] } = this.boardProviderRef?.state || {};
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
        this.props.match && this.props.match.params
          ? this.props.match.params.board
          : generateRandomName();
      const userInput = await this.prompt.getInput(
        suggested,
        this.state.description
      );
      if (userInput !== null) {
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

  isActionAvailable = (action: Action, state: BoardContextState) => {
    switch (action.type) {
      case "shareBoard":
        return false;
      case "saveBoard":
      case "clearBoard":
        return !!this.boardProviderRef?.state.runtimes;
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
    const { boardName } = this.state;
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
        and continue later
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
            {isPlaygroundEmpty && (
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
        allowedServices={allowedServices}
        description={description}
        boardName={boardName}
        sidechainRouting={sidechainRouting}
        outputRouting={outputRouting}
        onChangeOutputRouting={(
          runtime: RuntimeDescriptor,
          value: OutpoutRouting
        ) => {
          if (value === null) {
            this.setState({
              outputRouting: {
                ...this.state.outputRouting,
                [runtime.id]: null,
              },
            });
          } else {
            const { peer, flow, ...rest } = value;
            const runtimeData = {
              ...outputRouting[runtime.id],
              ...rest,
            };

            if (peer || peer === null) {
              runtimeData.peer = peer;
            }

            if (flow) {
              runtimeData.flow = flow;
            }

            this.setState({
              outputRouting: {
                ...this.state.outputRouting,
                [runtime.id]: runtimeData,
              },
            });
          }
        }}
        inputRouting={inputRouting}
        onChangeInputRouting={(
          runtime: RuntimeDescriptor,
          value: InputRouting
        ) =>
          this.setState({
            inputRouting: {
              ...this.state.inputRouting,
              [runtime.id]: value,
            },
          })
        }
        onChangeSidechainRouting={(
          runtime: RuntimeDescriptor,
          routing: SidechainRouting
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
                    <SaveBoardPrompt ref={(prompt) => (this.prompt = prompt)} />
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
