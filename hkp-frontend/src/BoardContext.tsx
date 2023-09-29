import { Component, ReactElement, createContext } from "react";
import UAParser from "ua-parser-js";

import BrowserRegistry from "./runtime/BrowserRegistry";
import ResizeObserver from "./ResizeObserver";
import { redirectTo } from "./core/actions";

import {
  getServices,
  addService,
  removeService,
  loadBoard,
  getBoard,
  getRuntimes,
  getRuntimeRegistry,
  addRuntime,
  removeRuntime,
  configureService,
  clearBoard,
} from "./core/actions";
import {
  BoardState,
  RuntimeClass,
  RuntimeClassType,
  RuntimeDescriptor,
  ServiceDescriptor,
} from "./types";

export type BoardContextState = {
  user: any;

  boardName: string;
  appViewMode: "wide" | "narrow";
  runtimes: Array<RuntimeDescriptor>;
  availableRuntimes: Array<RuntimeClass>;

  addAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;
  removeAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;
  addRuntime: (type: RuntimeClassType, name: string, url?: string) => void;
  addService: (descriptor: ServiceDescriptor, runtimeId: string) => void;

  fetchData: () => void;
};

type Props = {
  children: ReactElement;
  user: any;
  boardName: string;
  fetchData: () => Promise<BoardState>;
  isRuntimeInScope: () => boolean;
  addRuntime: (boardname: string, desc: RuntimeDescriptor) => void;
  removeRuntime: (runtime: RuntimeDescriptor) => void;
  addService: (
    boardname: string,
    descriptor: ServiceDescriptor,
    runtimeId: string
  ) => void;
  removeService: (runtime: RuntimeDescriptor) => void;
  newBoard: (searchParams: string) => void;
  clearBoard: () => void;
  saveBoard?: () => void;
  shareBoard: () => void;
  arrangeService: (
    runtime: RuntimeDescriptor,
    serviceUuid: string,
    targetPosition: number
  ) => void;
  isActionAvailable: (action: string) => boolean;
  setRuntimeName: (runtimeId: string, newName: string) => void;
  serializeBoard: ({
    name,
    description,
  }: {
    name: string | undefined;
    description: string;
  }) => void;
  onAction: (action: any) => void;
  availableRuntimes: Array<RuntimeClass>;
};

const { Provider, Consumer: BoardConsumer } =
  createContext<BoardContextState>();

class BoardContext extends Component<Props, BoardContextState> {
  static registerBrowserRuntime(boardName: string, runtimeId: string) {
    // remember id of created runtime, it belongs to 'this' browser
    const existing = JSON.parse(
      localStorage.getItem(`runtimes-${boardName}`) || "[]"
    );
    localStorage.setItem(
      `runtimes-${boardName}`,
      JSON.stringify(existing.concat(runtimeId))
    );
  }

  static unregisterBrowserRuntime(boardName: string, runtimeId: string) {
    // unremember that the id belongs to 'this' browser
    const existing = JSON.parse(
      localStorage.getItem(`runtimes-${boardName}`) || "[]"
    );
    const pruned = existing.filter((id) => id !== runtimeId);
    localStorage.setItem(`runtimes-${boardName}`, JSON.stringify(pruned));
  }

  constructor(props: Props) {
    super(props);

    this.state = {
      // API
      fetchData: this.fetchData,
      addRuntime: this.addRuntime,
      addService: this.addService,
      arrangeService: this.arrangeService,
      removeService: this.removeService,
      removeRuntime: this.removeRuntime,
      removeAllServices: this.removeAllServices,
      onAction: this.onAction,
      isRuntimeInScope: props.isRuntimeInScope || this.isRuntimeInScope,
      acquireRuntimeScope: this.acquireRuntimeScope,
      releaseRuntimeScope: this.releaseRuntimeScope,
      isActionAvailable: this.isActionAvailable,
      setRuntimeName: this.setRuntimeName,
      availableRuntimes: props.availableRuntimes || [],
      addAvailableRuntime: this.addAvailableRuntime,
      removeAvailableRuntime: this.removeAvailableRuntime,
      serializeBoard: props.serializeBoard, // TODO: this must exist for PeerSync

      // UI/App data
      viewportWidth: undefined,
      appViewMode: "wide",
      savedBoards: [],

      // Board data
      user: props.user,
      boardName: props.boardName,
      runtimes: [],
      services: {},
      registry: {},
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const { user, boardName } = this.props;
    if (prevProps.user !== user) {
      this.setState({ user });
    }
    if (prevProps.boardName !== boardName) {
      this.setState({ boardName });
    }
  }

  fetchData = async () => {
    const { fetchData = this.fetchDataDefault } = this.props;
    const {
      boardName = this.getBoardName(),
      services,
      savedBoards,
      registry,
      runtimes = [],
    } = await fetchData();
    if (runtimes) {
      for (const runtime of runtimes) {
        // ensure service.configure function exists
        for (const svc of services[runtime.id]) {
          if (!svc.configure) {
            // TODO: for BrowserRuntimes this happens in BrowserRuntime
            // this should be streamlined!
            // This implementation is only true for services in RemoteRuntimes
            svc.configure = async (config) =>
              configureService(boardName, svc, config, runtime);
          }
        }
        if (registry && registry[runtime.id]) {
          runtime.registry = registry[runtime.id];
        }
      }
    }

    this.setState({
      //board,
      boardName,
      runtimes,
      registry,
      services,
      savedBoards,
    });
  };

  fetchDataDefault = async () => {
    const { user } = this.props;
    if (!user) {
      return {};
    }
    try {
      const board = await this.fetchBoard();
      const runtimes = await this.fetchRuntimes();
      const registry = await this.fetchRegistry(runtimes); // FIXME: always after fetchRuntimes
      const services = await this.fetchServices(runtimes);
      const userBoards = await this.fetchUserBoards();
      return { board, runtimes, registry, services, userBoards };
    } catch (error) {
      console.log("Fetching data failed", error);
      return {};
    }
  };

  setRuntimeName = async (runtimeId, newName) => {
    const { setRuntimeName = this.setRuntimeNameDefault } = this.props;
    await setRuntimeName(runtimeId, newName);
    await this.fetchData();
  };

  setRuntimeNameDefault = (runtimeId, newName) => {
    console.log("Implement setRuntimeNameDefault for remote services");
  };

  isActionAvailable = (action) => {
    const { isActionAvailable = this.isActionAvailableDefaut } = this.props;
    return isActionAvailable(action);
  };

  isActionAvailableDefaut = (action) => {
    switch (action) {
      case "clearBoard":
        return true;
      default:
        return true;
    }
  };

  getBoardName = () => {
    return this.state.boardName;
  };

  fetchBoard = async () => {
    const boardname = this.getBoardName();
    if (boardname) {
      const board = await getBoard(boardname);
      return board;
    }
  };

  fetchRuntimes = async () => {
    const board = this.getBoardName();
    const runtimes = board ? await getRuntimes(board) : [];
    return runtimes;
  };

  fetchRegistry = async (runtimes) => {
    if (!runtimes) {
      runtimes = this.state.runtimes;
    }
    const board = this.getBoardName();
    const registry = {};
    if (runtimes) {
      for (const runtime of runtimes) {
        registry[runtime.id] =
          runtime.type === "browser"
            ? await this.createBrowserRegistry() // TODO: prune registry - and warn on missing services
            : await getRuntimeRegistry(board, runtime.id);
      }
    }
    return registry;
  };

  fetchServices = async (runtimes) => {
    if (!runtimes) {
      runtimes = this.state.runtimes;
    }
    const board = this.getBoardName();
    const services = {};
    if (board && runtimes) {
      for (const runtime of runtimes) {
        const { services: runtimeServices } = await getServices(
          board,
          runtime.id
        );
        services[runtime.id] = runtimeServices;
      }
    }
    return services;
  };

  fetchUserBoards = async () => {
    const boards = Object.keys(localStorage)
      .filter((key) => key.startsWith("board-"))
      .map((key) => key.substr(6));
    return boards;
  };

  newBoard = () => {
    if (this.props && this.props.newBoard) {
      this.props.newBoard();
    } else {
      redirectTo("/playground"); // TODO: consolidate with remote boards
    }
  };

  clearBoard = async () => {
    const { clearBoard = this.clearBoardDefault } = this.props;
    await clearBoard();
    await this.fetchData();
  };

  clearBoardDefault = async () => {
    const { runtimes } = this.state;
    if (runtimes) {
      for (const runtime of runtimes) {
        if (runtime.destroyRuntime) {
          await runtime.destroyRuntime();
        }
      }
    }

    const boardname = this.getBoardName();
    await clearBoard(boardname);
  };

  saveBoard = () => {
    const { saveBoard } = this.props;
    if (saveBoard) {
      return saveBoard();
    }
  };

  onAction = async (action) => {
    const boardname = this.getBoardName();
    const { onAction } = this.props;
    if (onAction) {
      if (onAction(action)) {
        return;
      }
    }
    switch (action.type) {
      case "newBoard":
        this.newBoard();
        break;
      case "clearBoard":
        await this.clearBoard();
        break;
      case "saveBoard":
        await this.saveBoard();
        break;
      case "loadBoard":
        try {
          const loadState = JSON.parse(
            localStorage.getItem(`board-${boardname}`)
          );
          await loadBoard(action.board, loadState);
          await this.fetchData();
        } catch (error) {
          console.error("Loading board failed with error", error);
        }
        break;
      default:
        console.log("Unknown action", action);
        break;
    }
  };

  arrangeService = async (
    runtime: RuntimeDescriptor,
    serviceUuid: string,
    targetPosition: number
  ) => {
    const { arrangeService = this.arrangeServiceDefault } = this.props;
    await arrangeService(runtime, serviceUuid, targetPosition);
    await this.fetchData();
  };

  arrangeServiceDefault = () => {};

  createBrowserRegistry = async () => {
    const { user } = this.state;
    const registry = await BrowserRegistry.create([], user);
    return registry.availableServices;
  };

  addRuntime = async (type: RuntimeClassType, name: string, url?: string) => {
    const { addRuntime = this.addRuntimeDefault } = this.props;
    const boardName = this.getBoardName();
    if (!boardName) {
      console.error("Board name missing for adding a runtime");
      return;
    }

    const params =
      type === "browser"
        ? { registry: await this.createBrowserRegistry() }
        : {};

    const browser = new UAParser().getBrowser();
    const desc = {
      type,
      name: (type === "browser" && browser ? browser.name : name) || "unnamed",
      params,
      url,
    };
    await addRuntime(boardName, desc);
    await this.fetchData();
  };

  addRuntimeDefault = async (boardName: string, desc: RuntimeDescriptor) => {
    const created = await addRuntime(boardName, desc);
    if (desc.type === "browser") {
      BoardContext.registerBrowserRuntime(boardName, created.id);
    }
    return created;
  };

  addService = async (descriptor: ServiceDescriptor, runtimeId: string) => {
    const { addService = this.addServiceDefault } = this.props;
    const boardName = this.getBoardName();
    if (boardName) {
      await addService(boardName, descriptor, runtimeId);
      await this.fetchData(); // TODO: fetching too much data
    }
  };

  addServiceDefault = (
    boardName: string,
    descriptor: ServiceDescriptor,
    runtimeId: string
  ) => {
    return addService(boardName, descriptor, runtimeId);
  };

  removeService = async (
    runtime: RuntimeDescriptor,
    service: ServiceDescriptor,
    fetchData = true
  ) => {
    const { removeService = this.removeServiceDefault } = this.props;
    const boardName = this.getBoardName();

    await removeService(boardName, runtime.id, service);
    if (fetchData) {
      await this.fetchData();
    }
  };

  removeServiceDefault = async (
    boardName: string,
    runtimeId: string,
    service: ServiceDescriptor
  ) => removeService(boardName, runtimeId, service.uuid);

  removeRuntime = async (runtime: RuntimeDescriptor) => {
    const { removeRuntime = this.removeRuntimeDefault } = this.props;
    await removeRuntime(runtime);
    await this.fetchData();
  };

  removeRuntimeDefault = async (runtime: RuntimeDescriptor) => {
    await this.removeAllServices(runtime);
    const boardName = this.getBoardName();
    await removeRuntime(boardName, runtime);
    await this.fetchData();
  };

  removeAllServices = async (runtime: RuntimeDescriptor) => {
    const { services } = this.state;
    const boardName = this.getBoardName();
    if (boardName) {
      for (const service of services[runtime.id]) {
        await this.removeService(runtime, service, false);
      }
    }
    await this.fetchData();
  };

  isRuntimeInScope = (runtime: RuntimeDescriptor) => {
    if (runtime.type !== "browser") {
      return true; // TODO: take user into account if shared
    }

    const board = this.getBoardName();
    const ownedRuntimes = JSON.parse(
      localStorage.getItem(`runtimes-${board}`) || "[]"
    );
    return !!ownedRuntimes.find(
      (runtimeId: string) => runtimeId === runtime.id
    );
  };

  acquireRuntimeScope = (boardname: string, runtime: RuntimeDescriptor) => {
    if (runtime.type === "browser") {
      if (!this.isRuntimeInScope(runtime)) {
        BoardContext.registerBrowserRuntime(boardname, runtime.id);
        this.fetchData();
      }
    }
  };

  releaseRuntimeScope = (boardname: string, runtime: RuntimeDescriptor) => {
    if (runtime.type === "browser") {
      BoardContext.unregisterBrowserRuntime(boardname, runtime.id);
      let releasedRT;
      this.browserRuntimes = this.browserRuntimes.filter((rt) => {
        if (rt.id === runtime.id) {
          releasedRT = rt;
          return false;
        }
        return true;
      });
      if (releasedRT) {
        releasedRT.destroyRuntime();
      }
      this.fetchData();
    }
  };

  addAvailableRuntime = ({ name, url, type }: RuntimeClass) => {
    const availableRuntimes = this.state.availableRuntimes.concat({
      name,
      type,
      url,
    });
    this.setState({
      availableRuntimes,
    });
    return availableRuntimes;
  };

  removeAvailableRuntime = ({ name, url, type }: RuntimeClass) => {
    const availableRuntimes = this.state.availableRuntimes.filter(
      (rt) => rt.name !== name
    );
    this.setState({
      availableRuntimes,
    });
    return availableRuntimes;
  };

  render() {
    const { children } = this.props;
    return (
      <Provider value={this.state}>
        {children}
        <ResizeObserver onChange={(data) => this.setState({ ...data })} />
      </Provider>
    );
  }
}

export { BoardConsumer };
export default BoardContext;
