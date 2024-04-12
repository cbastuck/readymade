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
} from "./types";
import { reorderService } from "./views/playground/BoardActions";
import { isUserAuthenticated } from "./runtime/remote/RemoteRuntimeApi";
import { AppContextState, AppCtx } from "./AppContext";

type BoardContextAPI = {
  addAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;
  removeAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;

  addRuntime: (rtClass: RuntimeClass) => void;
  removeRuntime: (runtime: RuntimeDescriptor) => void;
  removeAllServices: (runtime: RuntimeDescriptor) => void;

  addService: (desc: ServiceClass, rt: RuntimeDescriptor) => void;
  removeService: (svc: InstanceId, rt: RuntimeDescriptor) => void;

  arrangeService: (rt: RuntimeDescriptor, svcUuid: string, dst: number) => void;

  fetchBoard: () => Promise<void>;
  isActionAvailable: (action: Action) => boolean;
  onAction: (action: Action) => void;

  serializeBoard: () => Promise<BoardDescriptor | null>;
  setBoardState: (newState: BoardDescriptor) => void;

  isRuntimeInScope: (runtime: RuntimeDescriptor) => boolean;
  acquireRuntimeScope: (boardname: string, runtime: RuntimeDescriptor) => void;
  releaseRuntimeScope: (boardname: string, runtime: RuntimeDescriptor) => void;

  setRuntimeName: (runtimeId: string, newName: string) => void;
};

export type BoardContextState = BoardContextAPI & {
  user: User | null;

  boardName?: string;

  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: Array<ServiceDescriptor> };
  registry: { [runtimeId: string]: ServiceRegistry };
  scopes: { [runtimeId: string]: RuntimeScope };

  availableRuntimes: Array<RuntimeClass>;
  runtimeApis: RuntimeApiMap;

  appContext: AppContextState | null;
  awaitUserLogin: (() => void) | null;
};

type Props = {
  user: User | null;
  boardName?: string;
  children: JSX.Element | JSX.Element[];
  availableRuntimes?: Array<RuntimeClass>;
  runtimeApis?: RuntimeApiMap;
  fetchAfterMount?: boolean;

  fetchBoard?: () => Promise<BoardDescriptor>;
  isRuntimeInScope?: () => boolean;
  removeRuntime?: (runtime: RuntimeDescriptor) => Promise<void>;
  newBoard?: (searchParams?: string) => void; // TODO: why search params ??
  clearBoard?: (board: BoardDescriptor) => Promise<void>;
  saveBoard?: () => void;
  shareBoard?: () => void;
  onRemoveService?: (service: InstanceId, runtime: RuntimeDescriptor) => void;
  isActionAvailable?: (action: Action) => boolean;
  onAction?: (action: any) => boolean;
  serializeBoard?: (desc: BoardDescriptor) => Promise<BoardDescriptor | null>;
  onUpdateBoardState?: (updated: BoardDescriptor) => void;
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
    this.context = null;

    this.state = {
      // API
      fetchBoard: this.fetchBoard,
      addRuntime: this.addRuntime,
      addService: this.addService,
      arrangeService: this.arrangeServices,
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
    };
  }

  componentDidMount() {
    if (this.props.fetchAfterMount) {
      this.fetchBoard();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: BoardContextState) {
    const { user, boardName } = this.props;
    if (prevProps.user !== user) {
      this.setState({ user });
    }
    if (prevProps.boardName !== boardName) {
      this.setState({ boardName });
    }
    if (this.context !== prevState.appContext) {
      this.setState({ appContext: this.context });
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

    const {
      boardName = this.getBoardName(),
      runtimes = [],
      services = {},
    } = (await this.props.fetchBoard()) || {};

    const boardRequiresReauth = (
      await Promise.all(
        runtimes.map((rtClass) =>
          rtClass.type === "remote"
            ? isUserAuthenticated(rtClass, this.props.user)
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
        return api.restoreRuntime(rt, services[rt.id], user);
      })
    );

    const scopes = reduceByRuntimeId(restored, "scope");
    const registry = reduceByRuntimeId(restored, "registry");
    const validRuntimes = restored.flatMap((restoreResult) =>
      restoreResult && !!scopes[restoreResult?.runtime.id]
        ? [restoreResult.runtime]
        : []
    );

    this.setState({
      boardName,
      runtimes: validRuntimes,
      services,
      registry,
      scopes,
    });
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
    if (this.props && this.props.newBoard) {
      this.props.newBoard(searchParams);
    }
  };

  clearBoard = async () => {
    const { clearBoard } = this.props;
    if (!clearBoard) {
      throw new Error("BoardContext misses prop: clearBoard");
    }
    const { runtimes, services, registry, boardName } = this.state;
    this.setState(() => ({
      runtimes: [],
      services: {},
      registry: {},
    }));
    await clearBoard({ runtimes, services, registry, boardName });
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
        console.log("Unknown action", action);
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

    try {
      const result = await api.addRuntime(rtClass, user);
      if (result) {
        const { runtime, services, registry = [], scope } = result;
        const runtimeWithUser = { ...runtime, user };
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
    } catch (err) {
      await this.waitForUserLogin();
    }
  };

  addService = async (service: ServiceClass, runtime: RuntimeDescriptor) => {
    const [scope, api] = this.getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.addService() runtime api is missing: ${runtime.type}`
      );
    }
    const svc = await api.addService(scope, service);
    if (svc) {
      this.setState((state: BoardContextState) => ({
        services: {
          ...state.services,
          [runtime.id]: state.services[runtime.id].concat(svc),
        },
      }));
    }
  };

  removeService = async (service: InstanceId, runtime: RuntimeDescriptor) => {
    const [scope, api] = this.getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.const() runtime api is missing: ${runtime.type}`
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

  removeRuntime = async (runtime: RuntimeDescriptor) => {
    const { removeRuntime } = this.props;
    if (!removeRuntime) {
      throw new Error("BoardContext misses prop: removeRuntime");
    }
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

  removeAvailableRuntime = ({ name }: RuntimeClass) => {
    const availableRuntimes = this.state.availableRuntimes.filter(
      (rt) => rt.name !== name
    );
    this.setState({
      availableRuntimes,
    });
    return availableRuntimes;
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
    const services = await Object.keys(this.state.services).reduce(
      async (all, runtimeId) => {
        const runtimeServices = this.state.services[runtimeId];
        const [scope, api] = this.getRuntimeScopeApi(runtimeId);
        const runtime = this.state.runtimes.find((r) => r.id === runtimeId);
        if (!runtime) {
          throw new Error(
            `BoardContext.serializeBoard runtime with id: ${runtimeId} in: ${JSON.stringify(
              this.state.runtimes
            )}`
          );
        }
        const serviceConfigs = await Promise.all(
          runtimeServices.map(async (svc) => {
            const config =
              api && scope ? await api.getServiceConfig(scope, svc) : {};
            return {
              uuid: svc.uuid,
              serviceId: svc.serviceId,
              serviceName: svc.serviceName,
              ...config,
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
      state: {
        wrapServices: false,
        minimized: false,
      },
    }));

    const data = {
      runtimes,
      services,
      registry: this.state.registry,
    };

    return this.props.serializeBoard ? this.props.serializeBoard(data) : data;
  };

  setBoardState = (newState: BoardDescriptor) => {
    this.setState((state) => {
      const merged = { ...state, ...newState };
      this.props.onUpdateBoardState?.(merged);
      return merged;
    });
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

  render() {
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
