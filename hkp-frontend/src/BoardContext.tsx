import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

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
    overwriteIfExists: boolean,
  ) => Array<RuntimeClass>;
  removeAvailableRuntime: (c: RuntimeClass) => Array<RuntimeClass>;

  addRuntime: (rtClass: RuntimeClass) => void;
  removeRuntime: (runtime: RuntimeDescriptor) => void;
  updateRuntime: (
    runtimeId: string,
    updated: RuntimeConfiguration,
  ) => Promise<void>;
  removeAllServices: (runtime: RuntimeDescriptor) => void;

  addService: (
    desc: ServiceClass,
    rt: RuntimeDescriptor,
    prototype?: ServiceInstance,
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
    newName: string,
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
    newBoardName: string,
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
const { Provider } = BoardCtx;

/**
 * Imperative handle exposed via ref on BoardProvider.
 * Mirrors the previously-class-based interface so that existing ref call-sites
 * (e.g. boardProviderRef.current?.fetchBoard(), boardProviderRef.current?.state)
 * continue to work without changes.
 */
export type BoardProviderHandle = BoardContextState & {
  state: BoardContextState;
};

// Static helpers (previously static class methods)
function registerBrowserRuntime(boardName: string, runtimeId: string) {
  const existing = JSON.parse(
    localStorage.getItem(`runtimes-${boardName}`) || "[]",
  );
  localStorage.setItem(
    `runtimes-${boardName}`,
    JSON.stringify(existing.concat(runtimeId)),
  );
}

function unregisterBrowserRuntime(boardName: string, runtimeId: string) {
  const existing = JSON.parse(
    localStorage.getItem(`runtimes-${boardName}`) || "[]",
  );
  const pruned = existing.filter((id: string) => id !== runtimeId);
  localStorage.setItem(`runtimes-${boardName}`, JSON.stringify(pruned));
}

const BoardProvider = forwardRef<BoardProviderHandle, Props>(function BoardProvider(props, ref) {
  const {
    user: userProp,
    boardName: boardNameProp,
    availableRuntimeEngines: availableRuntimeEnginesProp,
    runtimeApis: runtimeApisProp,
    fetchAfterMount,
    initialState,
  } = props;

  const appContext = useContext(AppCtx);

  const [user, setUser] = useState<User | null>(userProp);
  const [boardName, setBoardNameState] = useState<string | undefined>(
    boardNameProp,
  );
  const [runtimes, setRuntimes] = useState<Array<RuntimeDescriptor>>(
    initialState?.runtimes || [],
  );
  const [services, setServices] = useState<{
    [runtimeId: string]: Array<ServiceDescriptor>;
  }>(initialState?.services || {});
  const [registry, setRegistry] = useState<{
    [runtimeId: string]: ServiceRegistry;
  }>(initialState?.registry || {});
  const [scopes, setScopes] = useState<{ [runtimeId: string]: RuntimeScope }>(
    initialState?.scopes || {},
  );
  const [availableRuntimeEngines, setAvailableRuntimeEngines] = useState<
    Array<RuntimeClass>
  >(availableRuntimeEnginesProp || restoreAvailableRuntimeEngines());
  const [isFetching, setIsFetching] = useState(false);
  const [errorOnFetch, setErrorOnFetch] = useState<Error | undefined>(
    undefined,
  );
  const [awaitUserLogin, setAwaitUserLogin] = useState<(() => void) | null>(
    null,
  );

  // Refs to latest state/props for use inside async closures
  const userRef = useRef(user);
  userRef.current = user;
  const boardNameRef = useRef(boardName);
  boardNameRef.current = boardName;
  const runtimesRef = useRef(runtimes);
  runtimesRef.current = runtimes;
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const registryRef = useRef(registry);
  registryRef.current = registry;
  const scopesRef = useRef(scopes);
  scopesRef.current = scopes;
  const availableRuntimeEnginesRef = useRef(availableRuntimeEngines);
  availableRuntimeEnginesRef.current = availableRuntimeEngines;
  const propsRef = useRef(props);
  propsRef.current = props;
  const appContextRef = useRef(appContext);
  appContextRef.current = appContext;

  // Sync props -> state (equivalent to componentDidUpdate prop-syncing)
  useEffect(() => {
    setUser(userProp);
  }, [userProp]);

  useEffect(() => {
    setBoardNameState(boardNameProp);
  }, [boardNameProp]);

  useEffect(() => {
    if (availableRuntimeEnginesProp) {
      setAvailableRuntimeEngines(availableRuntimeEnginesProp);
    }
  }, [availableRuntimeEnginesProp]);

  // --- Helpers ---

  const getRuntimeScopeApi = (
    runtimeId: string,
  ): [RuntimeScope | null, RuntimeApi | null] => {
    const runtime =
      runtimesRef.current.find((rt) => rt.id === runtimeId) || null;
    const scope = scopesRef.current[runtimeId] || null;
    return [
      scope,
      (runtime && propsRef.current.runtimeApis?.[runtime.type]) || null,
    ];
  };

  const getBoardName = () => boardNameRef.current;

  const isRuntimeInScopeDefault = (runtime: RuntimeDescriptor) => {
    if (runtime.type !== "browser") {
      return true;
    }
    const board = getBoardName();
    const ownedRuntimes = JSON.parse(
      localStorage.getItem(`runtimes-${board}`) || "[]",
    );
    return !!ownedRuntimes.find(
      (runtimeId: string) => runtimeId === runtime.id,
    );
  };

  // --- Public API ---

  const waitForUserLogin = async () => {
    await new Promise<void>((resolve) => {
      setAwaitUserLogin(() => resolve);
    });
    setAwaitUserLogin(null);
  };

  const restoreBoard = async (board: BoardDescriptor | undefined) => {
    const {
      boardName: restoredBoardName = getBoardName(),
      runtimes: boardRuntimes = [],
      services: boardServices = {},
    } = board || {};

    const boardRequiresReauth = (
      await Promise.all(
        boardRuntimes.map((rtClass) =>
          rtClass.type === "remote"
            ? isUserAuthenticated(rtClass, propsRef.current.user).catch(
                (err) => {
                  throw new Error(
                    `${err.message} for runtime ${rtClass.url}`,
                  );
                },
              )
            : Promise.resolve(true),
        ),
      )
    ).some((isAuthenticated) => !isAuthenticated);

    if (boardRequiresReauth && !userRef.current) {
      await waitForUserLogin();
    }

    const currentUser = userRef.current;
    const restored: Array<RestoreRuntimeResult | null> = await Promise.all(
      boardRuntimes.map((rt) => {
        const api = propsRef.current.runtimeApis?.[rt.type];
        if (!api) {
          console.error(
            `BrowserContext.fetchBoard runtime api missing on restore runtime: ${JSON.stringify(
              rt,
            )} with type: ${rt.type} with registered apis: ${JSON.stringify(
              Object.keys(propsRef.current.runtimeApis || {}),
            )}`,
          );
          return Promise.resolve(null);
        }
        return api.restoreRuntime(
          { ...rt },
          boardServices[rt.id],
          currentUser,
          restoredBoardName,
        );
      }),
    );

    const newScopes = reduceByRuntimeId(restored, "scope");
    const newRegistry = reduceByRuntimeId(restored, "registry");
    const restoredServicesWithState = reduceByRuntimeId(restored, "services");
    const validRuntimes = restored.flatMap((restoreResult) =>
      restoreResult && !!newScopes[restoreResult?.runtime.id]
        ? [restoreResult.runtime]
        : [],
    );

    return {
      boardName: restoredBoardName,
      runtimes: validRuntimes,
      services: restoredServicesWithState,
      registry: newRegistry,
      scopes: newScopes,
    };
  };

  const fetchBoard = async () => {
    if (!propsRef.current.fetchBoard) {
      return;
    }

    setIsFetching(true);
    try {
      const board = await propsRef.current.fetchBoard();
      const data = await restoreBoard(board);
      if (data) {
        setBoardNameState(data.boardName);
        setRuntimes(data.runtimes);
        setServices(data.services);
        setRegistry(data.registry);
        setScopes(data.scopes);
        setIsFetching(false);
        setTimeout(() => {
          // onLoad receives a snapshot; build it from refs (which will be updated by next render)
          propsRef.current.onLoad?.({
            ...buildContextValue(),
            ...data,
            isFetching: false,
          });
        }, 1);
      }
    } catch (err: any) {
      setErrorOnFetch(err);
      setIsFetching(false);
      return;
    }
  };

  const setRuntimeName = async (runtimeId: string, newName: string) => {
    setRuntimes((prev) =>
      prev.map((rt) => {
        if (rt.id === runtimeId && rt.type !== "browser") {
          throw new Error(
            "BoardContext.setRuntimeName() only supported for browser runtimes",
          );
        }
        return rt.id === runtimeId ? { ...rt, name: newName } : rt;
      }),
    );
  };

  const setServiceName = async (
    runtimeId: string,
    instanceId: string,
    newName: string,
  ) => {
    const rt = runtimesRef.current.find((r) => r.id === runtimeId);
    if (!rt || rt.type !== "browser") {
      throw new Error(
        "BoardContext.setServiceName() only supported for browser runtimes",
      );
    }
    const svc = servicesRef.current[rt.id]?.find((s) => s.uuid === instanceId);
    if (!svc) {
      throw new Error(
        `BoardContext.setServiceName() service not found: ${instanceId}"`,
      );
    }

    setServices((prev) => ({
      ...prev,
      [rt.id]: prev[rt.id].map((s) =>
        s.uuid === instanceId
          ? {
              ...s,
              serviceName: newName,
            }
          : s,
      ),
    }));
  };

  const isActionAvailableDefault = (action: Action) => {
    switch (action.type) {
      case "clearBoard":
        return true;
      default:
        return true;
    }
  };

  const isActionAvailable = (action: Action) => {
    const { isActionAvailable: isActionAvailableProp = isActionAvailableDefault } =
      propsRef.current;
    return isActionAvailableProp(action);
  };

  const clearBoard = async (newBoardNameArg: string = "New Idea") => {
    const currentRuntimes = runtimesRef.current;
    const currentServices = servicesRef.current;
    const currentRegistry = registryRef.current;
    const currentBoardName = boardNameRef.current;
    const { onClearBoard } = propsRef.current;
    for (const runtime of currentRuntimes) {
      await removeRuntime(runtime);
    }

    if (onClearBoard) {
      await onClearBoard(
        {
          runtimes: currentRuntimes,
          services: currentServices,
          registry: currentRegistry,
          boardName: currentBoardName,
        },
        newBoardNameArg,
      );
    }

    setRuntimes([]);
    setServices({});
    setRegistry({});
    setBoardNameState(newBoardNameArg || "");
  };

  const saveBoard = async () => {
    const { saveBoard: saveBoardProp } = propsRef.current;
    if (saveBoardProp) {
      return saveBoardProp();
    }
  };

  const newBoard = (searchParams: string = "") => {
    if (propsRef.current?.newBoard) {
      propsRef.current.newBoard?.(searchParams);
    } else {
      clearBoard("New Board");
    }
  };

  const onAction = async (action: Action) => {
    const { onAction: onActionProp } = propsRef.current;
    if (onActionProp) {
      if (onActionProp(action)) {
        return;
      }
    }
    switch (action.type) {
      case "newBoard":
        newBoard();
        break;
      case "clearBoard":
        await clearBoard();
        break;
      case "saveBoard":
        await saveBoard();
        break;
      case "playBoard": {
        const firstRuntime = runtimesRef.current[0];
        if (firstRuntime) {
          const [scope, api] = getRuntimeScopeApi(firstRuntime.id);
          if (scope && api) {
            api.processRuntime(scope, action.params || {}, null);
          }
        }
        break;
      }
      default:
        console.warn("Unknown action", action);
        break;
    }
  };

  const addRuntime = async (rtClass: RuntimeClass) => {
    const api = propsRef.current.runtimeApis?.[rtClass.type];
    if (!api) {
      throw new Error(
        `BoardContext.addRuntime() runtime api is missing: ${rtClass.type}`,
      );
    }
    const currentUser = userRef.current;
    const currentBoardName = getBoardName();
    try {
      const result = await api.addRuntime(rtClass, currentUser, currentBoardName);
      if (result) {
        const { runtime, services: newServices, registry: newRegistry = [], scope } =
          result;
        const runtimeWithUser = {
          ...runtime,
          user: currentUser,
          state: { ...runtime.state, color: rtClass.color },
          boardName: currentBoardName,
        };
        setRuntimes((prev) => [...prev, runtimeWithUser]);
        setServices((prev) => ({
          ...prev,
          [runtime.id]: newServices,
        }));
        setRegistry((prev) => ({
          ...prev,
          [runtime.id]: newRegistry,
        }));
        setScopes((prev) => ({
          ...prev,
          [runtime.id]: scope,
        }));
      }
    } catch (err: any) {
      console.error("BoardContext.addRuntime", err, err.stack);
      await waitForUserLogin();
    }
  };

  const addService = async (
    service: ServiceClass,
    runtime: RuntimeDescriptor,
    prototype?: ServiceInstance,
  ): Promise<ServiceDescriptor | null> => {
    const [scope, api] = getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.addService() runtime api is missing: ${runtime.type}`,
      );
    }
    const svc = await api.addService(scope, service, prototype?.uuid);
    if (svc) {
      setServices((prev) => ({
        ...prev,
        [runtime.id]: prev[runtime.id].concat(svc),
      }));
    }
    if (prototype) {
      await api.configureService(
        scope,
        prototype,
        prototype.state || prototype,
      );
    }

    return svc;
  };

  const removeService = async (
    service: InstanceId,
    runtime: RuntimeDescriptor,
  ) => {
    const [scope, api] = getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.removeService() runtime api is missing: ${runtime.type}`,
      );
    }

    if (propsRef.current.onRemoveService) {
      propsRef.current.onRemoveService(service, runtime);
    }
    await api.removeService(scope, service);

    setServices((prev) => ({
      ...prev,
      [runtime.id]: prev[runtime.id].filter(
        (svc) => svc.uuid !== service.uuid,
      ),
    }));
  };

  const removeAllServices = async (runtime: RuntimeDescriptor) => {
    for (const service of servicesRef.current[runtime.id]) {
      await removeService(service, runtime);
    }

    setServices((prev) => ({
      ...prev,
      [runtime.id]: [],
    }));
  };

  const setBoardName = (name: string) => {
    setBoardNameState(name);
  };

  const removeRuntime = async (runtime: RuntimeDescriptor) => {
    const { onRemoveRuntime } = propsRef.current;
    if (!onRemoveRuntime) {
      throw new Error("BoardContext misses prop: onRemoveRuntime");
    }
    await onRemoveRuntime(runtime);

    const [scope, api] = getRuntimeScopeApi(runtime.id);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.removeRuntime() runtime api is missing: ${runtime.type}`,
      );
    }

    await api.removeRuntime(scope, runtime, userRef.current);

    setRuntimes((prev) => prev.filter((r) => r.id !== runtime.id));
    setServices((prev) =>
      Object.keys(prev)
        .filter((rid) => rid !== runtime.id)
        .reduce((all, key) => ({ ...all, [key]: prev[key] }), {}),
    );
    setScopes((prev) =>
      Object.keys(prev)
        .filter((rid) => rid !== runtime.id)
        .reduce((all, key) => ({ ...all, [key]: prev[key] }), {}),
    );
    setRegistry((prev) =>
      Object.keys(prev)
        .filter((rid) => rid !== runtime.id)
        .reduce((all, key) => ({ ...all, [key]: prev[key] }), {}),
    );
  };

  const updateRuntime = async (
    runtimeId: string,
    updated: RuntimeConfiguration,
  ) => {
    const [scope, api] = getRuntimeScopeApi(runtimeId);
    if (!api || !scope) {
      throw new Error(
        `BoardContext.updateRuntime() runtime api is missing: ${runtimeId}`,
      );
    }
    const runtime = runtimesRef.current.find((rt) => rt.id === runtimeId);
    if (!runtime) {
      throw new Error(
        `BoardContext.updateRuntime() runtime not found: ${runtimeId}`,
      );
    }
    if (runtimeId !== updated.runtime.id) {
      await api.removeRuntime(scope, runtime, userRef.current);
      const result = await api.restoreRuntime(
        updated.runtime,
        updated.services,
        userRef.current,
      );
      if (result) {
        setRuntimes((prev) =>
          prev.map((rt) => (rt.id === runtimeId ? updated.runtime : rt)),
        );
        setServices((prev) => ({
          ...prev,
          [updated.runtime.id]: updated.services,
        }));
        setScopes((prev) => ({
          ...prev,
          [updated.runtime.id]: result.scope,
        }));
      }
    } else {
      await Promise.all(
        updated.services.map((svc) => api.configureService(scope, svc, svc)),
      );
      scope.setState?.(updated.runtime.state);
      setRuntimes((prev) =>
        prev.map((rt) => (rt.id === runtimeId ? updated.runtime : rt)),
      );
    }
  };

  const isRuntimeInScope = (runtime: RuntimeDescriptor) => {
    const { isRuntimeInScope: isRuntimeInScopeProp } = propsRef.current;
    if (isRuntimeInScopeProp) {
      return isRuntimeInScopeProp();
    }
    return isRuntimeInScopeDefault(runtime);
  };

  const acquireRuntimeScope = (
    boardname: string,
    runtime: RuntimeDescriptor,
  ) => {
    if (runtime.type === "browser") {
      if (!isRuntimeInScope(runtime)) {
        registerBrowserRuntime(boardname, runtime.id);
        fetchBoard();
      }
    }
  };

  const releaseRuntimeScope = (
    boardname: string,
    runtime: RuntimeDescriptor,
  ) => {
    if (runtime.type === "browser") {
      unregisterBrowserRuntime(boardname, runtime.id);
      fetchBoard();
    }
  };

  const addAvailableRuntime = (
    { name, url, type, color }: RuntimeClass,
    overwriteIfExists: boolean,
  ) => {
    const current = availableRuntimeEnginesRef.current;
    const engines = overwriteIfExists
      ? current.filter((rt) => rt.name !== name)
      : current;
    const updated = engines.concat({ name, type, url, color });
    setAvailableRuntimeEngines(updated);
    return updated;
  };

  const removeAvailableRuntime = ({ name }: RuntimeClass) => {
    const updated = availableRuntimeEnginesRef.current.filter(
      (rt) => rt.name !== name,
    );
    setAvailableRuntimeEngines(updated);
    return updated;
  };

  const serializeBoard = async (): Promise<BoardDescriptor | null> => {
    const runtimeStates: { [rtId: string]: any } = {};
    const currentRuntimes = runtimesRef.current;
    const currentServices = servicesRef.current;
    const serializedServices = await Object.keys(currentServices).reduce(
      async (all, runtimeId) => {
        const runtime = currentRuntimes.find((r) => r.id === runtimeId);
        if (!runtime) {
          throw new Error(
            `BoardContext.serializeBoard runtime with id: ${runtimeId} in: ${JSON.stringify(
              currentRuntimes,
            )}`,
          );
        }
        const [scope, api] = getRuntimeScopeApi(runtimeId);
        const runtimeServices = currentServices[runtimeId];
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
              state: config,
            };
          }),
        );
        return {
          ...(await all),
          [runtimeId]: serviceConfigs,
        };
      },
      Promise.resolve({}),
    );

    const serializedRuntimes = currentRuntimes.map((rt) => ({
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
      runtimes: serializedRuntimes,
      services: serializedServices,
    };

    return propsRef.current.serializeBoard
      ? propsRef.current.serializeBoard(data)
      : data;
  };

  const setBoardState = async (newState: BoardDescriptor) => {
    const data = await restoreBoard(newState);
    if (data) {
      setBoardNameState(data.boardName);
      setRuntimes(data.runtimes);
      setServices(data.services);
      setRegistry(data.registry);
      setScopes(data.scopes);
      propsRef.current.onUpdateBoardState?.(data);
    }
  };

  const arrangeServices = async (
    runtime: RuntimeDescriptor,
    serviceUuid: string,
    targetPosition: number,
  ) => {
    const [scope, api] = getRuntimeScopeApi(runtime.id);
    if (!scope || !api) {
      throw new Error("BoardContext.arrangeServices, scope or api missing");
    }

    const currentServices = servicesRef.current;
    const rearranged = await api.rearrangeServices(
      scope,
      reorderService(currentServices, runtime, serviceUuid, targetPosition),
    );

    setServices((prev) => ({
      ...prev,
      [runtime.id]: rearranged,
    }));
  };

  const arrangeRuntimes = async (runtimeId: string, targetPosition: number) => {
    const [scope, api] = getRuntimeScopeApi(runtimeId);
    if (!scope || !api) {
      throw new Error("BoardContext.arrangeServices, scope or api missing");
    }

    const currentRuntimes = runtimesRef.current;
    const rearranged = reorderRuntime(currentRuntimes, runtimeId, targetPosition);

    setRuntimes(rearranged);
  };

  // componentDidMount equivalent
  useEffect(() => {
    if (fetchAfterMount) {
      fetchBoard();
    }

    const currentBoardName = boardNameRef.current;
    if (currentBoardName) {
      document.title = currentBoardName;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentWillUnmount equivalent
  useEffect(() => {
    return () => {
      for (const runtime of runtimesRef.current) {
        const [scope, api] = getRuntimeScopeApi(runtime.id);
        if (api && scope) {
          api.removeRuntime(scope, runtime, userRef.current);
        } else {
          console.warn(
            `BoardProvider.componentWillUnmount runtime api or scope missing for runtime: ${runtime.id}`,
          );
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Equivalent of the render()-time awaitUserLogin check:
  // when user becomes available and there's a pending login awaiter, resolve it
  useEffect(() => {
    if (awaitUserLogin && userProp) {
      awaitUserLogin();
    }
  }, [awaitUserLogin, userProp]);

  // Helper to build a context snapshot (used in onLoad callback)
  const buildContextValue = (): BoardContextState => ({
    user,
    boardName,
    runtimes,
    services,
    registry,
    scopes,
    availableRuntimeEngines,
    runtimeApis: runtimeApisProp || {},
    appContext,
    awaitUserLogin,
    isFetching,
    errorOnFetch,
    fetchBoard,
    addRuntime,
    addService,
    arrangeService: arrangeServices,
    arrangeRuntime: arrangeRuntimes,
    removeService,
    removeRuntime,
    updateRuntime,
    removeAllServices,
    setBoardName,
    clearBoard,
    onAction,
    isRuntimeInScope,
    acquireRuntimeScope,
    releaseRuntimeScope,
    isActionAvailable,
    setRuntimeName,
    setServiceName,
    addAvailableRuntime,
    removeAvailableRuntime,
    serializeBoard,
    setBoardState,
  });

  const value = buildContextValue();

  // Expose imperative handle for legacy ref usage on this component
  useImperativeHandle(ref, () => ({
    ...value,
    state: value,
  }), [value]); // eslint-disable-line react-hooks/exhaustive-deps

  connectDevTools(value);

  return <Provider value={value}>{props.children}</Provider>;
});

export function useBoardContext() {
  return useContext(BoardCtx);
}

export { BoardCtx };
export default BoardProvider;

function reduceByRuntimeId<T extends keyof RestoreRuntimeResult>(
  arr: Array<RestoreRuntimeResult | null>,
  prop: T,
): { [runtimeId: string]: RestoreRuntimeResult[T] } {
  return arr.reduce((all, cur) => {
    if (cur === null) {
      return all;
    }
    return cur ? { ...all, [cur.runtime.id]: cur[prop] } : all;
  }, {});
}
