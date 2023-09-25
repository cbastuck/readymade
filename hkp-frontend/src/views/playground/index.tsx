import { Component } from "react";
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
import {
  importBoard,
  createBoardFromTemplate,
  reorderService,
  renameRuntime,
} from "./BoardActions";
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
  BoardState,
  ExternalInput,
  InputRouting,
  OutpoutRouting,
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

  /*
      this part of the state represents the board
      state as available on the backend (which does not
      exist in case of the playground)
    */
  registry: undefined | { [runtimeId: string]: any }; // TODO
  runtimes: undefined | Array<RuntimeDescriptor>;
  services: undefined | { [runtimeId: string]: Array<ServiceDescriptor> };

  sidechainRouting: { [runtimeId: string]: SidechainRouting };
  inputRouting: { [runtimeId: string]: InputRouting };
  outputRouting: { [runtimeId: string]: OutpoutRouting | null };
};

class Playground extends Component<Props, State> {
  static contextType = AppCtx;

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

    /*
      this part of the state represents the board
      state as available on the backend (which does not
      exist in case of the playground)
    */
    registry: undefined,
    runtimes: undefined,
    services: undefined,

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
    this.clearPlayground();
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

  fetchData = async (): Promise<BoardState> => {
    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles);
    }
    const {
      boardName = this.state.boardName || defaultName,
      runtimes = [],
      registry = undefined,
      services = {},
      description = "",
      sidechainRouting = {},
      outputRouting = {},
      inputRouting = {},
      // playground specific board data
      boardSyncActive = false,
      syncedPeer = undefined,
      acceptedSyncSenders = [],
      rejectedSyncSenders = [],
    }: State = this.state.initialFetched
      ? this.state
      : await this.setInitialPlayground();

    const data = {
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

    return data;
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
        return this.state; // use initial state
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

  serializeBoard = async ({
    name = undefined,
    description = "",
  }: {
    name: string | undefined;
    description: string;
  }): Promise<BoardState | null> => {
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
      runtimes = [],
      services = {},
      sidechainRouting = {},
      outputRouting = {},
      inputRouting = {},
      boardSyncActive = false,
      syncedPeer = undefined,
      acceptedSyncSenders = [],
      rejectedSyncSenders = [],
    }: State = this.state;

    const data = {
      runtimes: runtimes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        type: rt.type,
        state: board.getRuntimeById(rt.id).serialize(),
      })),
      services: Object.keys(services).reduce((all, runtimeId) => {
        const rt = board.getRuntimeById(runtimeId);
        return {
          ...all,
          [runtimeId]: services[runtimeId].map((s) => ({
            ...filterPrivateMembers(rt.getServiceById(s.uuid)),
            serviceId: s.serviceId,
            serviceName: s.serviceName,
          })),
        };
      }, {}),
      sidechainRouting,
      outputRouting,
      inputRouting,
      description,
      boardSyncActive,
      syncedPeer,
      acceptedSyncSenders,
      rejectedSyncSenders,
    };
    return data;
  };

  newBoard = async (searchParams = "") => {
    await this.clearPlayground();
    const name = generateRandomName();
    this.props.navigate(`/playground/${name}${searchParams}`, {
      replace: true,
    });
  };

  addService = (
    boardname: string,
    descriptor: ServiceDescriptor,
    runtimeId: string
  ) => {
    const { services = {}, runtimes } = this.state;
    const svc = {
      ...descriptor,
      uuid: uuid.v4(),
    };
    const runtime: RuntimeDescriptor | undefined = runtimes?.find(
      (rt) => rt.id === runtimeId
    );
    if (runtime?.type === "remote") {
      // TODO: GraphQL
    } else if (runtime?.type === "node") {
      addServiceREST(boardname, svc, runtimeId).then((created) =>
        console.log("CREATED SERVICE", created, svc)
      );
    } else {
      if (!this.board) {
        throw new Error("addService() board is undefined");
      }

      if (!this.board.getRuntimeById(runtimeId)) {
        console.warn("Could not find runtime for", runtimeId);
        return;
      }
    }
    this.setState({
      services: {
        ...services,
        [runtimeId]: [...services[runtimeId], svc],
      },
    });
    return svc;
  };

  removeService = async (
    boardName: string,
    runtimeId: string,
    service: ServiceDescriptor
  ) => {
    const { services = {} } = this.state;
    const runtime = this.board && this.board.getRuntimeById(runtimeId);
    if (!runtime) {
      return;
    }

    await runtime.destroyService(service.uuid);

    const runtimeServices = services[runtimeId];
    const updatedServices = runtimeServices.filter(
      (svc) => svc.uuid !== service.uuid
    );
    this.setState({
      services: {
        ...services,
        [runtimeId]: updatedServices,
      },
    });
  };

  addRuntime = async (boardname: string, desc: RuntimeDescriptor) => {
    const { runtimes = [], services = {} } = this.state;
    const runtimeId = uuid.v4();
    const { name, type, url } = desc;
    const rt = {
      id: runtimeId,
      name: `${name}-${runtimes ? runtimes.length + 1 : 1}`,
      type,
      url,
    };
    let registry;
    if (type === "remote") {
      console.log("Adding GraphQL runtime", rt);
      await createFreeRuntime(rt);
      registry = await getRuntimeRegistry(rt);
    } else if (type === "node") {
      const created = await addRuntimeREST(boardname, { ...desc, runtimeId });
      registry = await getRuntimeRegistryREST(name, created.id);
    } else {
      registry = this.defaultRegistry?.availableServices || [];
    }
    this.setState({
      runtimes: runtimes.concat(rt),
      services: {
        ...services,
        [runtimeId]: [],
      },
      registry: {
        ...this.state.registry,
        [runtimeId]: registry,
      },
    });
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

    const { runtimes = [], services = {} } = this.state;
    const updatedRuntimes = runtimes.filter((r) => r.id !== runtime.id);
    const updatedServices = Object.keys(services)
      .filter((rid) => rid !== runtime.id)
      .reduce((all, key) => ({ ...all, [key]: services[key] }), {});
    this.setState({
      runtimes: updatedRuntimes,
      services: updatedServices,
    });
  };

  clearPlayground = async () => {
    const { runtimes = [] } = this.state;
    for (const runtime of runtimes) {
      await this.destroyRuntime(runtime);
    }

    for (const ext of Object.keys(this.externalInputs)) {
      this.externalInputs[ext].close();
    }
    this.externalInputs = {};
    this.setState({ services: {}, runtimes: [] });
  };

  reorderService = (
    runtime: RuntimeDescriptor,
    serviceUuid: string,
    targetPosition: number
  ) => {
    const { services: allServices } = this.state;
    const rearranged = reorderService(
      allServices,
      runtime,
      serviceUuid,
      targetPosition
    );
    this.setState({
      services: {
        ...allServices,
        [runtime.id]: rearranged,
      },
    });
  };

  setRuntimeName = (runtimeId: string, newName: string) => {
    const runtimes = renameRuntime(this.state.runtimes, runtimeId, newName);
    this.setState({ runtimes });
  };

  saveBoard = async (showDialog = true) => {
    if (this.prompt && showDialog) {
      const suggested =
        this.props.match && this.props.match.params
          ? this.props.match.params.board
          : generateRandomName();
      const value = await this.prompt.getInput(
        suggested,
        this.state.description
      );
      if (value !== null) {
        const { name, description } = value;
        const data = await this.serializeBoard({ name, description });
        localStorage.setItem(
          `${localStoragePrefix}${name}`,
          JSON.stringify(data)
        );
        if (name !== suggested) {
          this.props.navigate(`/playground/${name}`, { replace: true });
        }
        return data;
      }
    } else if (this.state.boardName) {
      const { boardName: name, description } = this.state;
      const data = await this.serializeBoard({ name, description });
      localStorage.setItem(
        `${localStoragePrefix}${name}`,
        JSON.stringify(data)
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

  isActionAvailable = (action: string) => {
    switch (action) {
      case "shareBoard":
        return false;
      case "saveBoard":
      case "clearBoard":
        return this.state.runtimes;
      case "toggleBoardSync":
        return true;
      default:
        return true;
    }
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
        arrangeService={this.reorderService}
        isActionAvailable={this.isActionAvailable}
        setRuntimeName={this.setRuntimeName}
        serializeBoard={this.serializeBoard}
        onAction={(action) => {
          if (action.type === "toggleBoardSync") {
            this.setState({ boardSyncActive: !this.state.boardSyncActive });
            return true;
          }
        }}
        availableRuntimes={availableRuntimes.concat(restoredAvailableRuntimes)}
      >
        <BoardConsumer>
          {(boardContext) => (
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
          )}
        </BoardConsumer>
      </BoardProvider>
    );
  }
}

export default withRouter(Playground);
