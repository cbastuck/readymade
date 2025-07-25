import { Component, createContext } from "react";

import {
  Action,
  BoardDescriptor,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceDescriptor,
  ServiceRegistry,
  ServiceClass,
  InstanceId,
  RuntimeApiMap,
  RuntimeScope,
  RestoreRuntimeResult,
  RuntimeApi,
  User,
  ServiceInstance,
  RuntimeConfiguration,
} from "./types";
import {
  reorderRuntime,
  reorderService,
} from "./views/playground/BoardActions";
import { isUserAuthenticated } from "./runtime/remote/RemoteRuntimeApi";
import { AppContextState, AppCtx } from "./AppContext";
import { connectDevTools } from "./core/DevTools";
import { restoreAvailableRuntimeEngines } from "./common";

type BoardContextAPI = {
  addAvailableRuntime: (
    c: RuntimeClass,
    overwriteIfExists: boolean
  ) => Array<RuntimeClass>;
  removeAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;

  addRuntime: (rtClass: RuntimeClass) => void;
  removeRuntime: (runtime: RuntimeDescriptor) => void;
  updateRuntime: (
    runtimeId: string,
    updated: RuntimeConfiguration
  ) => Promise<void>;
  removeAllServices: (runtime: RuntimeDescriptor) => void;

  addService: (
    desc: ServiceClass,
    rt: RuntimeDescriptor,
    prototype?: ServiceInstance
  ) => void;
  removeService: (svc: InstanceId, rt: RuntimeDescriptor) => void;

  arrangeService: (rt: RuntimeDescriptor, svcUuid: string, dst: number) => void;
  arrangeRuntime: (runtimeId: string, dst: number) => void;

  clearBoard: (emptyBoardName?: string) => Promise<void>;

  fetchBoard: () => Promise<void>;
  isActionAvailable: (action: Action) => boolean;
  onAction: (action: Action) => void;

  serializeBoard: () => Promise<BoardDescriptor | null>;
  setBoardState: (newState: BoardDescriptor) => Promise<void>;
  setBoardName: (name: string) => void;

  isRuntimeInScope: (runtime: RuntimeDescriptor) => boolean;
  acquireRuntimeScope: (boardname: string, runtime: RuntimeDescriptor) => void;
  releaseRuntimeScope: (boardname: string, runtime: RuntimeDescriptor) => void;

  setRuntimeName: (runtimeId: string, newName: string) => void;
  setServiceName: (
    runtimeId: string,
    instanceId: string,
    newName: string
  ) => void;
};

export type EngineState = {
  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: Array<ServiceDescriptor> };
  registry: { [runtimeId: string]: ServiceRegistry };
  scopes: { [runtimeId: string]: RuntimeScope };
};

export type BoardContextState = BoardContextAPI &
  EngineState & {
    user: User | null;

    boardName?: string;

    availableRuntimeEngines: Array<RuntimeClass>;
    runtimeApis: RuntimeApiMap;

    appContext: AppContextState | null;
    awaitUserLogin: (() => void) | null;

    errorOnFetch?: Error;
    isFetching: boolean;
  };

type Props = {
  user: User | null;
  boardName?: string;
  children: JSX.Element | JSX.Element[];
  availableRuntimeEngines?: Array<RuntimeClass>;
  runtimeApis?: RuntimeApiMap;
  fetchAfterMount?: boolean;
  initialState?: EngineState;

  fetchBoard?: () => Promise<BoardDescriptor>;
  isRuntimeInScope?: () => boolean;
  onRemoveRuntime?: (runtime: RuntimeDescriptor) => Promise<void>;
  newBoard?: (searchParams?: string) => void; // TODO: why search params ??
  onClearBoard?: (
    board: BoardDescriptor,
    newBoardName: string
  ) => Promise<void>;
  saveBoard?: () => void;
  shareBoard?: () => void;
  onRemoveService?: (service: InstanceId, runtime: RuntimeDescriptor) => void;
  isActionAvailable?: (action: Action) => boolean;
  onAction?: (action: any) => boolean;
  serializeBoard?: (desc: BoardDescriptor) => Promise<BoardDescriptor | null>;
  onUpdateBoardState?: (updated: BoardDescriptor) => void;
  onLoad?: (context: BoardContextState) => void;
};

const BoardCtx = createContext<BoardContextState | null>(null);
const { Provider, Consumer: BoardConsumer } = BoardCtx;

class BoardProvider extends Component<Props, BoardContextState> {
  static contextType = AppCtx;
  declare context: React.ContextType<typeof AppCtx>;

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
    // this.context = null;

    this.state = {
      // API
      fetchBoard: this.fetchBoard,
      addRuntime: this.addRuntime,
      addService: this.addService,
      arrangeService: this.arrangeServices,
      arrangeRuntime: this.arrangeRuntimes,
      removeService: this.removeService,
      removeRuntime: this.removeRuntime,
      updateRuntime: this.updateRuntime,
      removeAllServices: this.removeAllServices,
      setBoardName: this.setBoardName,
      clearBoard: this.clearBoard,

      onAction: this.onAction,
      isRuntimeInScope: props.isRuntimeInScope || this.isRuntimeInScope,
      acquireRuntimeScope: this.acquireRuntimeScope,
      releaseRuntimeScope: this.releaseRuntimeScope,
      isActionAvailable: this.isActionAvailable,
      setRuntimeName: this.setRuntimeName,
      setServiceName: this.setServiceName,
      availableRuntimeEngines:
        props.availableRuntimeEngines || restoreAvailableRuntimeEngines(),
      addAvailableRuntime: this.addAvailableRuntime,
      removeAvailableRuntime: this.removeAvailableRuntime,
      serializeBoard: this.serializeBoard,
      setBoardState: this.setBoardState,

      // Board data
      user: props.user,
      boardName: props.boardName,
      runtimes: [],
      services: {},
      registry: {},
      scopes: {},
      runtimeApis: props.runtimeApis || {},
      appContext: this.context || null,
      awaitUserLogin: null,
      isFetching: false,
      errorOnFetch: undefined,
      ...(this.props.initialState || {}),
    };
  }

  componentDidMount() {
    if (this.props.fetchAfterMount) {
      this.fetchBoard();
    }

    const { boardName } = this.props;
    if (boardName) {
      document.title = boardName;
    }
  }

  componentDidUpdate(prevProps: Props, prevState: BoardContextState) {
    const { user, boardName, availableRuntimeEngines } = this.props;
    if (prevProps.user !== user) {
      this.setState({ user });
    }
    if (prevProps.boardName !== boardName) {
      this.setState({ boardName });
    }
    if (this.context !== prevState.appContext) {
      this.setState({ appContext: this.context });
    }

    if (
      prevProps.availableRuntimeEngines !== availableRuntimeEngines &&
      availableRuntimeEngines
    ) {
      this.setState({ availableRuntimeEngines });
    }
  }

  componentWillUnmount(): void {
    for (const runtime of this.state.runtimes) {
      const [scope, api] = this.getRuntimeScopeApi(runtime.id);
      if (api && scope) {
        api.removeRuntime(scope, runtime, this.state.user);
      } else {
        console.warn(
          `BoardProvider.componentWillUnmount runtime api or scope missing for runtime: ${runtime.id}`
        );
      }
    }
  }

  waitForUserLogin = async () => {
    await new Promise<void>((resolve) => {
      this.setState({ awaitUserLogin: resolve });
    });
    this.setState({ awaitUserLogin: null });
  };

  fetchBoard = async () => {
    if (!this.props.fetchBoard) {
      return;
    }

    this.setState({ isFetching: true });
    try {
      const board = await this.props.fetchBoard();
      const data = await this.restoreBoard(board);
      if (data) {
        this.setState(
          {
            ...data,
            isFetching: false,
          },
          () => setTimeout(() => this.props.onLoad?.(this.state), 1)
        );
      }
    } catch (err: any) {
      this.setState({ errorOnFetch: err, isFetching: false });
      return;
    }
  };

  restoreBoard = async (board: BoardDescriptor | undefined) => {
    const {
      boardName = this.getBoardName(),
      runtimes = [],
      services = {},
    } = board || {};

    const boardRequiresReauth = (
      await Promise.all(
        runtimes.map((rtClass) =>
          rtClass.type === "remote"
            ? isUserAuthenticated(rtClass, this.props.user).catch((err) => {
                throw new Error(`${err.message} for runtime ${rtClass.url}`);
              })
            : Promise.resolve(true)
        )
      )
    ).some((isAuthenticated) => !isAuthenticated);

    if (boardRequiresReauth && !this.state.user) {
      await this.waitForUserLogin();
    }

    const user = this.state.user;
    const restored: Array<RestoreRuntimeResult | null> = await Promise.all(
      runtimes.map((rt) => {
        const api = this.props.runtimeApis?.[rt.type];
        if (!api) {
          console.error(
            `BrowserContext.fetchBoard runtime api missing on restore runtime: ${JSON.stringify(
              rt
            )} with type: ${rt.type} with registered apis: ${JSON.stringify(
              Object.keys(this.props.runtimeApis || {})
            )}`
          );
          return Promise.resolve(null);
        }
        return api.restoreRuntime({ ...rt }, services[rt.id], user, boardName);
      })
    );

    const scopes = reduceByRuntimeId(restored, "scope");
    const registry = reduceByRuntimeId(restored, "registry");
    const restoredServicesWithState = reduceByRuntimeId(restored, "services");
    const validRuntimes = restored.flatMap((restoreResult) =>
      restoreResult && !!scopes[restoreResult?.runtime.id]
        ? [restoreResult.runtime]
        : []
    );

    return {
      boardName,
      runtimes: validRuntimes,
      services: restoredServicesWithState,
      registry,
      scopes,
    };
  };

  setRuntimeName = async (runtimeId: string, newName: string) => {
    const runtimes = this.state.runtimes.map((rt) => {
      if (rt.id === runtimeId && rt.type !== "browser") {
        throw new Error(
          "BoardContext.setRuntimeName() only supported for browser runtimes"
        );
      }
      return rt.id === runtimeId ? { ...rt, name: newName } : rt;
    });
    this.setState({ runtimes });
  };

  setServiceName = async (
    runtimeId: string,
    instanceId: string,
    newName: string
  ) => {
    const rt = this.state.runtimes.find((rt) => rt.id === runtimeId);
    if (!rt || rt.type !== "browser") {
      throw new Error(
        "BoardContext.setServiceName() only supported for browser runtimes"
      );
    }
    const svc = this.state.services[rt.id]?.find((s) => s.uuid === instanceId);
    if (!svc) {
      throw new Error(
        `BoardContext.setServiceName() service not found: ${instanceId}"`
      );
    }

    this.setState({
      services: {
        ...this.state.services,
        [rt.id]: this.state.services[rt.id].map((s) =>
          s.uuid === instanceId
            ? {
                ...s,
                serviceName: newName,
              }
            : s
        ),
      },
    });
  };

  isActionAvailable = (action: Action) => {
    const { isActionAvailable = this.isActionAvailableDefault } = this.props;
    return isActionAvailable(action);
  };

  isActionAvailableDefault = (action: Action) => {
    switch (action.type) {
      case "clearBoard":
        return true;
      default:
        return true;
    }
  };

  getBoardName = () => {
    return this.state.boardName;
  };

  newBoard = (searchParams: string = "") => {
    if (this.props?.newBoard) {
      this.props.newBoard?.(searchParams);
    } else {
      this.clearBoard("New Board");
    }
  };

  clearBoard = async (newBoardName: string = "New Idea") => {
    const { runtimes, services, registry, boardName } = this.state;
    const { onClearBoard } = this.props;
    for (const runtime of runtimes) {
      await this.removeRuntime(runtime);
    }

    if (onClearBoard) {
      await onClearBoard(
        { runtimes, services, registry, boardName },
        newBoardName
      );
    }

    this.setState(() => ({
      runtimes: [],
      services: {},
      registry: {},
      boardName: newBoardName || "",
    }));
  };

  saveBoard = async () => {
    const { saveBoard } = this.props;
    if (saveBoard) {
      return saveBoard();
    }
  };

  onAction = async (action: Action) => {
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
      case "playBoard": {
        const firstRuntime = this.state.runtimes[0];
        if (firstRuntime) {
          const [scope, api] = this.getRuntimeScopeApi(firstRuntime.id);
          if (scope && api) {
            api.processRuntime(scope, action.params || {}, null); // pass {} as default because undefined is not accepted in Gql queries and null ends process
          }
        }
        break;
      }
      default:
        console.warn("Unknown action", action);
        break;
    }
  };

  addRuntime = async (rtClass: RuntimeClass) => {
    const api = this.props.runtimeApis?.[rtClass.type];
    if (!api) {
      throw new Error(
        `BoardContext.addRuntime() runtime api is missing: ${rtClass.type}`
      );
    }
    const user = this.state.user;
    const boardName = this.getBoardName();
    try {
      const result = await api.addRuntime(rtClass, user, boardName);
      if (result) {
        const { runtime, services, registry = [], scope } = result;
        const runtimeWithUser = {
          ...runtime,
          user,
          state: { ...runtime.state, color: rtClass.color },
          boardName,
        };
        this.setState((state: BoardContextState) => ({
          runtimes: [...state.runtimes, runtimeWithUser],
          services: {
            ...state.services,
            [runtime.id]: services,
          },
          registry: {
            ...state.registry,
            [runtime.id]: registry,
          },
          scopes: {
            ...state.scopes,
            [runtime.id]: scope,
          },
        }));
      }
    } catch (err: any) {
      console.error("BoardContext.addRuntime", err, err.stack);
      await this.waitForUserLogin();
    }
  };

  addService = async (
    service: ServiceClass,
    runtime: RuntimeDescriptor,
    prototype?: ServiceInstance
  ): Promise<ServiceDescriptor | null> => {
    const [scope, api] = this.getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.addService() runtime api is missing: ${runtime.type}`
      );
    }
    const svc = await api.addService(scope, service, prototype?.uuid);
    if (svc) {
      this.setState((state: BoardContextState) => ({
        services: {
          ...state.services,
          [runtime.id]: state.services[runtime.id].concat(svc),
        },
      }));
    }
    if (prototype) {
      await api.configureService(
        scope,
        prototype,
        prototype.state || prototype
      );
    }

    return svc;
  };

  removeService = async (service: InstanceId, runtime: RuntimeDescriptor) => {
    const [scope, api] = this.getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.removeService() runtime api is missing: ${runtime.type}`
      );
    }

    if (this.props.onRemoveService) {
      this.props.onRemoveService(service, runtime);
    }
    await api.removeService(scope, service);

    this.setState((state) => ({
      services: {
        ...state.services,
        [runtime.id]: state.services[runtime.id].filter(
          (svc) => svc.uuid !== service.uuid
        ),
      },
    }));
  };

  removeAllServices = async (runtime: RuntimeDescriptor) => {
    for (const service of this.state.services[runtime.id]) {
      await this.removeService(service, runtime);
    }

    this.setState((state) => ({
      services: {
        ...state.services,
        [runtime.id]: [],
      },
    }));
  };

  setBoardName = (name: string) => {
    this.setState({ boardName: name });
  };

  removeRuntime = async (runtime: RuntimeDescriptor) => {
    const { onRemoveRuntime } = this.props;
    if (!onRemoveRuntime) {
      throw new Error("BoardContext misses prop: onRemoveRuntime");
    }
    await onRemoveRuntime(runtime);

    const [scope, api] = this.getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.removeRuntime() runtime api is missing: ${runtime.type}`
      );
    }

    api.removeRuntime(scope, runtime, this.state.user);

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

  getRuntimeById = (runtimeId: string) => {
    return this.state.runtimes.find((rt) => rt.id === runtimeId);
  };

  updateRuntime = async (runtimeId: string, updated: RuntimeConfiguration) => {
    const [scope, api] = this.getRuntimeScopeApi(runtimeId);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.updateRuntime() runtime api is missing: ${runtimeId}`
      );
    }
    const runtime = this.getRuntimeById(runtimeId);
    if (!runtime) {
      throw new Error(
        `BoardContext.updateRuntime() runtime not found: ${runtimeId}`
      );
    }
    if (runtimeId !== updated.runtime.id) {
      await api.removeRuntime(scope, runtime, this.state.user);
    }
    await api.restoreRuntime(
      updated.runtime,
      updated.services,
      this.state.user
    );
    scope.setState?.(updated.runtime.state);
    this.setState((state) => {
      const runtimes = state.runtimes.map((rt) =>
        rt.id === runtimeId ? updated.runtime : rt
      );
      return { runtimes };
    });
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
        BoardProvider.registerBrowserRuntime(boardname, runtime.id);
        this.fetchBoard();
      }
    }
  };

  releaseRuntimeScope = (boardname: string, runtime: RuntimeDescriptor) => {
    if (runtime.type === "browser") {
      BoardProvider.unregisterBrowserRuntime(boardname, runtime.id);

      this.fetchBoard();
    }
  };

  addAvailableRuntime = (
    { name, url, type, color }: RuntimeClass,
    overwriteIfExists: boolean
  ) => {
    const engines = overwriteIfExists
      ? this.state.availableRuntimeEngines.filter((rt) => rt.name !== name)
      : this.state.availableRuntimeEngines;
    const availableRuntimeEngines = engines.concat({
      name,
      type,
      url,
      color,
    });
    this.setState({
      availableRuntimeEngines,
    });
    return availableRuntimeEngines;
  };

  removeAvailableRuntime = ({ name }: RuntimeClass) => {
    const availableRuntimeEngines = this.state.availableRuntimeEngines.filter(
      (rt) => rt.name !== name
    );
    this.setState({
      availableRuntimeEngines,
    });
    return availableRuntimeEngines;
  };

  getRuntimeScopeApi(
    runtimeId: string
  ): [RuntimeScope | null, RuntimeApi | null] {
    const runtime =
      this.state.runtimes.find((rt) => rt.id === runtimeId) || null;
    const scope = this.state.scopes[runtimeId] || null;
    return [scope, (runtime && this.props.runtimeApis?.[runtime.type]) || null];
  }

  serializeBoard = async (): Promise<BoardDescriptor | null> => {
    const runtimeStates: { [rtId: string]: any } = {};
    const services = await Object.keys(this.state.services).reduce(
      async (all, runtimeId) => {
        const runtime = this.state.runtimes.find((r) => r.id === runtimeId);
        if (!runtime) {
          throw new Error(
            `BoardContext.serializeBoard runtime with id: ${runtimeId} in: ${JSON.stringify(
              this.state.runtimes
            )}`
          );
        }
        const [scope, api] = this.getRuntimeScopeApi(runtimeId);
        const runtimeServices = this.state.services[runtimeId];
        const serviceConfigs = await Promise.all(
          runtimeServices.map(async (svc) => {
            const config =
              api && scope ? await api.getServiceConfig(scope, svc) : {};
            const runtimeState = {
              ...runtime.state,
              ...scope?.serializeState?.(),
            };
            runtimeStates[runtimeId] = runtimeState;
            return {
              uuid: svc.uuid,
              serviceId: svc.serviceId,
              serviceName: svc.serviceName,
              state:
                svc.state || scope?.descriptor.type !== "browser"
                  ? config
                  : undefined,
              ...(svc.state ? {} : config), // add config plain if state is missing (old browser services)
            };
          })
        );
        return {
          ...(await all),
          [runtimeId]: serviceConfigs,
        };
      },
      Promise.resolve({})
    );

    const runtimes = this.state.runtimes.map((rt) => ({
      id: rt.id,
      name: rt.name,
      type: rt.type,
      url: rt.url,
      bundles: rt.bundles,
      state: runtimeStates[rt.id] || {
        wrapServices: false,
        minimized: false,
      },
    }));

    const data = {
      runtimes,
      services,
      // registry: this.state.registry,
    };

    return this.props.serializeBoard ? this.props.serializeBoard(data) : data;
  };

  setBoardState = async (newState: BoardDescriptor) => {
    const data = await this.restoreBoard(newState);
    if (data) {
      this.setState(data);
      this.props.onUpdateBoardState?.(data);
    }
  };

  arrangeServices = async (
    runtime: RuntimeDescriptor,
    serviceUuid: string,
    targetPosition: number
  ) => {
    const [scope, api] = this.getRuntimeScopeApi(runtime.id);
    if (!scope || !api) {
      throw new Error("BoardContext.arrangeServices, scope or api missing");
    }

    const { services } = this.state;
    const rearranged = await api.rearrangeServices(
      scope,
      reorderService(services, runtime, serviceUuid, targetPosition)
    );

    this.setState((state) => {
      return {
        services: {
          ...state.services,
          [runtime.id]: rearranged,
        },
      };
    });
  };

  arrangeRuntimes = async (runtimeId: string, targetPosition: number) => {
    const [scope, api] = this.getRuntimeScopeApi(runtimeId);
    if (!scope || !api) {
      throw new Error("BoardContext.arrangeServices, scope or api missing");
    }

    const { runtimes } = this.state;
    const rearranged = reorderRuntime(runtimes, runtimeId, targetPosition);

    this.setState((state) => {
      return {
        ...state,
        runtimes: rearranged,
      };
    });
  };

  render() {
    connectDevTools(this.state);
    const { children, user } = this.props;
    if (this.state.awaitUserLogin && user) {
      this.state.awaitUserLogin();
    }

    return <Provider value={this.state}>{children}</Provider>;
  }
}

export { BoardConsumer, BoardCtx };
export default BoardProvider;

function reduceByRuntimeId<T extends keyof RestoreRuntimeResult>(
  arr: Array<RestoreRuntimeResult | null>,
  prop: T
): { [runtimeId: string]: RestoreRuntimeResult[T] } {
  return arr.reduce((all, cur) => {
    if (cur === null) {
      return all;
    }
    return cur ? { ...all, [cur.runtime.id]: cur[prop] } : all;
  }, {});
}
