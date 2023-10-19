import { Component, ReactElement, createContext } from "react";
import UAParser from "ua-parser-js";

import BrowserRegistry from "./runtime/BrowserRegistry";
import ResizeObserver from "./ResizeObserver";

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
  clearBoard,
} from "./core/actions";
import {
  Action,
  AddRuntimeResult,
  AddServiceResult,
  AppViewMode,
  BoardDescriptor,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceModule,
  ServiceDescriptor,
  ServiceRegistry,
  ServiceClass,
  ServiceId,
} from "./types";
import { reorderService } from "./views/playground/BoardActions";

type BoardContextAPI = {
  addAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;
  removeAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;

  addRuntime: (rtClass: RuntimeClass) => void;
  removeRuntime: (runtime: RuntimeDescriptor) => void;
  removeAllServices: (runtime: RuntimeDescriptor) => void;

  addService: (desc: ServiceClass, rt: RuntimeDescriptor) => void;
  removeService: (svc: ServiceId, rt: RuntimeDescriptor) => void;

  updateRegistry: (runtimeId: string, services: Array<ServiceModule>) => void;

  arrangeService: (rt: RuntimeDescriptor, svcUuid: string, dst: number) => void;

  fetchData: () => Promise<void>;
  isActionAvailable: (action: Action) => boolean;
  onAction: (action: Action) => void;

  serializeBoard: () => Promise<BoardDescriptor | null>;

  isRuntimeInScope: (runtime: RuntimeDescriptor) => boolean;
  acquireRuntimeScope: (boardname: string, runtime: RuntimeDescriptor) => void;
  releaseRuntimeScope: (boardname: string, runtime: RuntimeDescriptor) => void;

  setRuntimeName: (runtimeId: string, newName: string) => void;
};

export type BoardContextState = BoardContextAPI & {
  user: any;

  boardName: string;
  appViewMode: AppViewMode;
  viewportWidth: number | undefined;

  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: Array<ServiceDescriptor> };
  registry: { [runtimeId: string]: ServiceRegistry };

  availableRuntimes: Array<RuntimeClass>;
};

type Props = {
  user: any;
  boardName: string;
  availableRuntimes: Array<RuntimeClass>;
  children: ReactElement;

  fetchData: () => Promise<BoardDescriptor>;
  isRuntimeInScope: () => boolean;
  addRuntime: (rtClass: RuntimeClass) => AddRuntimeResult;
  removeRuntime: (runtime: RuntimeDescriptor) => void;
  addService: (svc: ServiceClass, rt: RuntimeDescriptor) => AddServiceResult;
  removeService: (svc: ServiceId, rt: RuntimeDescriptor) => void;
  newBoard: (searchParams?: string) => void; // TODO: why search params ??
  clearBoard: (board: BoardDescriptor) => Promise<void>;
  saveBoard?: () => void;
  shareBoard?: () => void;

  isActionAvailable: (action: Action) => boolean;

  onAction: (action: any) => boolean;
  serializeBoard: (desc: BoardDescriptor) => Promise<BoardDescriptor | null>;
};

const BoardCtx = createContext<BoardContextState | null>(null);
const { Provider, Consumer: BoardConsumer } = BoardCtx;

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
    const pruned = existing.filter((id: string) => id !== runtimeId);
    localStorage.setItem(`runtimes-${boardName}`, JSON.stringify(pruned));
  }

  constructor(props: Props) {
    super(props);

    this.state = {
      // API
      fetchData: this.fetchData,
      addRuntime: this.addRuntime,
      addService: this.addService,
      arrangeService: this.arrangeServices,
      removeService: this.removeService,
      removeRuntime: this.removeRuntime,
      removeAllServices: this.removeAllServices,
      updateRegistry: this.updateRegistry,
      onAction: this.onAction,
      isRuntimeInScope: props.isRuntimeInScope || this.isRuntimeInScope,
      acquireRuntimeScope: this.acquireRuntimeScope,
      releaseRuntimeScope: this.releaseRuntimeScope,
      isActionAvailable: this.isActionAvailable,
      setRuntimeName: this.setRuntimeName,
      availableRuntimes: props.availableRuntimes || [],
      addAvailableRuntime: this.addAvailableRuntime,
      removeAvailableRuntime: this.removeAvailableRuntime,
      serializeBoard: this.serializeBoard,

      // UI/App data
      viewportWidth: undefined,
      appViewMode: "wide",

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

  componentDidUpdate(prevProps: Props) {
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
      services = {},
      registry = {},
      runtimes = [],
    } = await fetchData();

    /*
    if (runtimes && services) {
      for (const runtime of runtimes) {
        for (const svc of services[runtime.id]) {
          // ensure service.configure function exists
          if (!(svc as any).configure) {
            // TODO: for BrowserRuntimes this happens in BrowserRuntime
            // this should be streamlined!
            // This implementation is only true for services in RemoteRuntimes
            (svc as any).configure = async (config: any) =>
              configureService(boardName, svc, config, runtime);
          }
        }
        if (registry && registry[runtime.id]) {
          runtime.registry = registry[runtime.id];
        }
      }
    }
    */

    this.setState({
      boardName,
      runtimes,
      registry,
      services,
    });
  };

  fetchDataDefault = async () => {
    const { user } = this.props;
    if (!user) {
      return {};
    }

    const boardName = this.getBoardName();
    const runtimes = await this.fetchRuntimes();
    const registry = await this.fetchRegistry(runtimes); // FIXME: always after fetchRuntimes
    const services = await this.fetchServices(runtimes);
    return { boardName, runtimes, registry, services };
  };

  setRuntimeName = async (runtimeId: string, newName: string) => {
    const runtimes = this.state.runtimes.map((rt) => {
      if (rt.type !== "browser") {
        throw new Error(
          "BoardContext.setRuntimeName() only supported for browser runtimes"
        );
      }
      return rt.id === runtimeId ? { ...rt, name: newName } : rt;
    });
    this.setState({ runtimes });
  };

  isActionAvailable = (action: Action) => {
    const { isActionAvailable = this.isActionAvailableDefaut } = this.props;
    return isActionAvailable(action);
  };

  isActionAvailableDefaut = (action: Action) => {
    switch (action.type) {
      case "clearBoard":
        return true;
      default:
        return true;
    }
  };

  updateRegistry = (runtimeId: string, registry: Array<ServiceModule>) => {
    this.setState((state) => ({
      registry: { ...state.registry, [runtimeId]: registry },
    }));
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

  fetchRegistry = async (runtimes: Array<RuntimeDescriptor>) => {
    if (!runtimes) {
      runtimes = this.state.runtimes;
    }
    const board = this.getBoardName();
    const registry: { [runtimeId: string]: Array<ServiceModule> } = {};
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

  fetchServices = async (runtimes: Array<RuntimeDescriptor>) => {
    if (!runtimes) {
      runtimes = this.state.runtimes;
    }
    const board = this.getBoardName();
    const services: { [runtimeId: string]: Array<ServiceDescriptor> } = {};
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

  newBoard = (searchParams: string = "") => {
    if (this.props && this.props.newBoard) {
      this.props.newBoard(searchParams);
    }
  };

  clearBoard = async () => {
    const { clearBoard = this.clearBoardDefault } = this.props;
    const { runtimes, services, registry, boardName } = this.state;
    this.setState(() => ({
      runtimes: [],
      services: {},
      registry: {},
    }));
    await clearBoard({ runtimes, services, registry, boardName });
  };

  clearBoardDefault = async (board: BoardDescriptor) => {
    const { runtimes } = board;
    if (runtimes) {
      for (const runtime of runtimes as Array<any>) {
        if (runtime.destroyRuntime) {
          await runtime.destroyRuntime();
        }
      }
    }
    await clearBoard(board.boardName);
  };

  saveBoard = () => {
    const { saveBoard } = this.props;
    if (saveBoard) {
      return saveBoard();
    }
  };

  onAction = async (action: Action) => {
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
            localStorage.getItem(`board-${boardname}`) || ""
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

  // TODO: do we need STILL this!!!???
  createBrowserRegistry = async () => {
    const { user } = this.state;
    const registry = await BrowserRegistry.create([], user);
    return registry.availableServices;
  };

  addRuntime = async (rtClass: RuntimeClass) => {
    const { addRuntime } = this.props;

    const { type, name, url } = rtClass;
    const params = {};
    const browser = type === "browser" ? new UAParser().getBrowser() : null;
    const desc = {
      type,
      name: `${browser?.name || name || "unnamed"}-${
        this.state.runtimes.length + 1
      }`,
      params,
      url,
    };
    const result = await addRuntime(desc);
    if (result) {
      const { runtime, services } = result;
      this.setState((state: BoardContextState) => ({
        runtimes: [...state.runtimes, runtime],
        services: {
          ...state.services,
          [runtime.id]: services,
        },
      }));
    }
  };

  // TODO: this is not needed for playground setups
  // probably this can go away once mixed board work with playground
  addRuntimeDefault = async (desc: RuntimeClass) => {
    const boardName = this.getBoardName();
    const created = await addRuntime(boardName, desc);
    if (desc.type === "browser") {
      BoardContext.registerBrowserRuntime(boardName, created.id);
    }
    return created;
  };

  addService = async (service: ServiceClass, runtime: RuntimeDescriptor) => {
    const { addService = this.addServiceDefault } = this.props;

    const svc = await addService(service, runtime);
    if (svc) {
      this.setState((state: BoardContextState) => ({
        services: {
          ...state.services,
          [runtime.id]: state.services[runtime.id].concat(svc),
        },
      }));
    }
  };

  addServiceDefault = (
    service: ServiceClass,
    runtime: RuntimeDescriptor
  ): Promise<AddServiceResult> => {
    return addService(this.getBoardName(), service, runtime.id);
  };

  removeService = async (service: ServiceId, runtime: RuntimeDescriptor) => {
    const { removeService } = this.props;
    await removeService(service, runtime);

    this.setState((state) => ({
      services: {
        ...state.services,
        [runtime.id]: state.services[runtime.id].filter(
          (svc) => svc.uuid !== service.uuid
        ),
      },
    }));
  };

  removeServiceDefault = async (
    service: ServiceDescriptor,
    runtime: RuntimeDescriptor
  ) => {
    const boardName = this.getBoardName();
    removeService(boardName, runtime.id, service.uuid);
  };

  removeRuntime = async (runtime: RuntimeDescriptor) => {
    const { removeRuntime = this.removeRuntimeDefault } = this.props;
    await removeRuntime(runtime);

    this.setState((state) => {
      const updatedRuntimes = state.runtimes.filter((r) => r.id !== runtime.id);
      const updatedServices = Object.keys(state.services)
        .filter((rid) => rid !== runtime.id)
        .reduce((all, key) => ({ ...all, [key]: state.services[key] }), {});
      return {
        runtimes: updatedRuntimes,
        services: updatedServices,
      };
    });
  };

  removeRuntimeDefault = async (runtime: RuntimeDescriptor) => {
    await this.removeAllServices(runtime);
    const boardName = this.getBoardName();
    await removeRuntime(boardName, runtime);
    await this.fetchData();
  };

  removeAllServices = async (runtime: RuntimeDescriptor) => {
    const { removeService = this.removeServiceDefault } = this.props;
    const boardName = this.getBoardName();
    if (!boardName) {
      throw new Error("removeAllServices() no boardname");
    }

    for (const service of this.state.services[runtime.id]) {
      await removeService(service, runtime);
    }

    this.setState((state) => ({
      services: {
        ...state.services,
        [runtime.id]: [],
      },
    }));
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

  serializeBoard = (): Promise<BoardDescriptor | null> => {
    const data = {
      runtimes: this.state.runtimes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        type: rt.type,
      })),
      services: Object.keys(this.state.services).reduce((all, runtimeId) => {
        return {
          ...all,
          [runtimeId]: this.state.services[runtimeId].map((s) => ({
            uuid: s.uuid,
            serviceId: s.serviceId,
            serviceName: s.serviceName,
          })),
        };
      }, {}),
      registry: this.state.registry,
    };
    return this.props.serializeBoard(data);
  };

  arrangeServices = (
    runtime: RuntimeDescriptor,
    serviceUuid: string,
    targetPosition: number
  ) => {
    this.setState((state) => {
      return {
        services: {
          ...state.services,
          [runtime.id]: reorderService(
            state.services,
            runtime,
            serviceUuid,
            targetPosition
          ),
        },
      };
    });
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

export { BoardConsumer, BoardCtx };
export default BoardContext;
