import React, { Component } from "react";
import { Loader } from "semantic-ui-react";
import uuid from "uuid";
import qs from "query-string";

import BoardProvider, { BoardConsumer } from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";
import BrowserRegistry from "../../runtime/BrowserRegistry";
import SaveBoardPrompt from "../../components/SaveBoardPrompt";
import VSpacer from "../../components/shared/VSpacer";
import EmptySketch from "./EmptySketch";
import Board from "./Board";
import BoardSync from "./boardsync";
import LoadPanel from "./LoadPanel";
import { generateRandomName } from "../../core/board";
import { filterPrivateMembers, sleep } from "../../runtime/services/helpers";
import { redirectTo } from "../../core/actions";
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

export default class Playground extends Component {
  state = {
    boardName:
      (this.props.match &&
        this.props.match.params &&
        this.props.match.params.board) ||
      defaultName,
    showRoutingOptions: false,
    placeholderAnimationRunning: false,
    description: "",
    initialFetched: false,
    initialTabLocation: "#usecase",

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

  externalInputs = {};

  componentDidMount() {
    const { hash } = window && window.location;
    this.setState({ initialTabLocation: hash || "#usecase" });
  }

  componentDidUpdate(prevProps) {
    const board = this.props.match.params.board;
    const prevBoard = prevProps.match.params.board;
    if (board !== prevBoard) {
      if (board === undefined) {
        this.setState({
          boardName: defaultName,
          runtimes: undefined,
          services: undefined,
          sidechainRouting: {},
          description: "",
          initialFetched: false,
          outputRouting: {},
          inputRouting: {},
        });
      } else {
        this.setState({
          boardName: board,
          initialFetched: false,
        });
      }
    }
  }

  componentWillUnmount() {
    this.clearPlayground();
  }

  fetchData = async () => {
    const {
      boardName = this.state.boardName || defaultName,
      runtimes = [],
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
    } = this.state.initialFetched
      ? this.state
      : await this.setInitialPlayground();

    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles);
    }

    const data = {
      boardName,
      runtimes,
      services,
      registry:
        runtimes &&
        runtimes.reduce(
          (all, rt) => ({
            ...all,
            [rt.id]: this.defaultRegistry.availableServices,
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

  setInitialPlayground = () => {
    const queryParams = new URLSearchParams(document.location.search);
    const { board } = this.props.match.params;
    if (board) {
      const params = qs.parse(document.location.search);
      if (params.template) {
        return createBoardFromTemplate(params.template, params);
      } else {
        const localBoard = this.restoreBoardFromLocalStorage(board);
        if (localBoard) {
          return localBoard;
        }
        return this.state; // use initial state
      }
    }

    const src = queryParams.get("src");
    if (src) {
      return importBoard(src);
    }

    return {};
  };

  restoreBoardFromLocalStorage = (name) => {
    const storageName = name
      ? `${localStoragePrefix}${name}`
      : "hkp-playground";
    const data = localStorage.getItem(storageName);
    if (data) {
      return JSON.parse(data);
    }
  };

  serializeBoard = async ({ name, description } = {}) => {
    const maxRetries = 10;
    for (let i = 0; i < maxRetries && !this.board; ++i) {
      await sleep(10); // retry later
      if (i + 1 === maxRetries) {
        console.error("Could not serialize board within retries");
        return null;
      }
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
    } = this.state;
    const data = {
      runtimes: runtimes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        type: rt.type,
      })),
      services: Object.keys(services).reduce((all, runtimeId) => {
        const rt = this.board.getRuntimeById(runtimeId);
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

  newBoard = () => {
    const name = generateRandomName();
    redirectTo(`/playground/${name}`);
  };

  addService = (boardName, descriptor, runtimeId) => {
    const { services = {} } = this.state;
    const runtime = this.board.getRuntimeById(runtimeId);
    if (!runtime) {
      return;
    }
    const svc = {
      ...descriptor,
      uuid: uuid.v4(),
    };
    this.setState({
      services: {
        ...services,
        [runtimeId]: [...services[runtimeId], svc],
      },
    });
    return svc;
  };

  removeService = async (boardName, runtimeId, service) => {
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

  addRuntime = async (boardname, desc) => {
    const { runtimes = [], services = {} } = this.state;
    const runtimeId = uuid.v4();
    const rt = {
      id: runtimeId,
      name: `Runtime-${runtimes ? runtimes.length + 1 : 1}`,
      type: "browser",
    };
    this.setState({
      runtimes: runtimes.concat(rt),
      services: {
        ...services,
        [runtimeId]: [],
      },
    });
  };

  destroyRuntime = (runtime) => {
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

  removeRuntime = async (runtime) => {
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
    this.externalInputs = [];
    this.setState({ services: {}, runtimes: [] });
  };

  reorderService = (runtime, serviceUuid, targetPosition) => {
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

  setRuntimeName = (runtimeId, newName) => {
    const runtimes = renameRuntime(this.state.runtimes, runtimeId, newName);
    this.setState({ runtimes });
  };

  saveBoard = async () => {
    if (this.prompt) {
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
          redirectTo(`/playground/${name}`);
        }
        return data;
      }
    }
  };

  isActionAvailable = (action) => {
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

  renderPlaceholderOrBoard = (boardContext) => {
    const { boardName } = this.state;
    const isPlaygroundEmpty =
      boardContext &&
      boardContext.runtimes &&
      boardContext.runtimes.length === 0;
    const isBoardUnnamed = boardName === defaultName;

    const content = isPlaygroundEmpty ? (
      <EmptySketch boardName={isBoardUnnamed ? undefined : boardName} />
    ) : (
      this.renderBoard(boardContext)
    );
    return (
      <div style={t.fill}>
        <div style={{ width: "99%", margin: "auto" }}>
          {isBoardUnnamed ? (
            <LoadPanel
              showSaveReminder={!isPlaygroundEmpty}
              initialTabLocation={this.state.initialTabLocation}
            >
              {content}
            </LoadPanel>
          ) : (
            <div style={{ marginTop: isPlaygroundEmpty && "15%" }}>
              {content}
            </div>
          )}
        </div>
        <VSpacer />
      </div>
    );
  };

  renderBoard = (boardContext) => {
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
        boardContext={boardContext}
        allowedServices={allowedServices}
        description={description}
        boardName={boardName}
        sidechainRouting={sidechainRouting}
        outputRouting={outputRouting}
        onChangeOutputRouting={(runtime, { peer, flow }) => {
          const runtimeData = {
            ...outputRouting[runtime.id],
          };

          if (peer) {
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
        onChangeSidechainRouting={(runtime, routing) =>
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

  renderBoardSync = (boardContext) => {
    return (
      <BoardSync
        active={this.state.boardSyncActive}
        syncedPeer={this.state.syncedPeer}
        onSyncedPeerChanged={(syncedPeer) => this.setState({ syncedPeer })}
        boardContext={boardContext}
        onUpdate={(update) => this.setState(update, boardContext.fetchData)}
        onClose={(closedPeer) => {
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
    return (
      <BoardProvider
        key={`playground-${this.state.boardName}`}
        user={this.user}
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
        shareBoard={this.shareBoard}
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
      >
        <BoardConsumer>
          {(boardContext) => (
            <div id="playground-root" style={t.fill}>
              <Toolbar
                board={this.state.boardName}
                availableRuntimes={availableRuntimes}
              />
              <SaveBoardPrompt ref={(prompt) => (this.prompt = prompt)} />
              {this.state.boardSyncActive && this.renderBoardSync(boardContext)}
              {this.state.initialFetched
                ? this.renderPlaceholderOrBoard(boardContext)
                : this.renderLoadIndicator()}
              <Footer />
            </div>
          )}
        </BoardConsumer>
      </BoardProvider>
    );
  }
}
