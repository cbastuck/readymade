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
  User,
  ServiceInstance,
  RuntimeConfiguration,
} from "./types";
import { AppContextState, AppCtx } from "./AppContext";
import { connectDevTools } from "./core/DevTools";
import { restoreAvailableRuntimeEngines } from "./common";
import { BoardStateRefs, Props, getRuntimeScopeApi } from "./core/boardContextTypes";
import { FacadeDescriptor } from "./facade/types";
import {
  fetchBoard as fetchBoardOp,
  serializeBoard as serializeBoardOp,
  setBoardState as setBoardStateOp,
  clearBoard as clearBoardOp,
} from "./core/boardPersistence";
import {
  addRuntime as addRuntimeOp,
  removeRuntime as removeRuntimeOp,
  updateRuntime as updateRuntimeOp,
  arrangeRuntimes as arrangeRuntimesOp,
  addAvailableRuntime as addAvailableRuntimeOp,
  removeAvailableRuntime as removeAvailableRuntimeOp,
  setRuntimeName as setRuntimeNameOp,
  registerBrowserRuntime,
  unregisterBrowserRuntime,
  isRuntimeInScopeDefault,
} from "./core/runtimeOperations";
import {
  addService as addServiceOp,
  removeService as removeServiceOp,
  removeAllServices as removeAllServicesOp,
  arrangeServices as arrangeServicesOp,
  setServiceName as setServiceNameOp,
} from "./core/serviceOperations";

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
    facade?: FacadeDescriptor;

    availableRuntimeEngines: Array<RuntimeClass>;
    runtimeApis: RuntimeApiMap;

    appContext: AppContextState | null;
    awaitUserLogin: (() => void) | null;

    errorOnFetch?: Error;
    isFetching: boolean;
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
  const [facade, setFacade] = useState<FacadeDescriptor | undefined>(undefined);
  const [isFetching, setIsFetching] = useState(false);
  const [errorOnFetch, setErrorOnFetch] = useState<Error | undefined>(
    undefined,
  );
  const [awaitUserLogin, setAwaitUserLogin] = useState<(() => void) | null>(
    null,
  );
  const awaitUserLoginResolverRef = useRef<(() => void) | null>(null);

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

  // Sync props -> state
  useEffect(() => { setUser(userProp); }, [userProp]);
  useEffect(() => { setBoardNameState(boardNameProp); }, [boardNameProp]);
  useEffect(() => {
    if (availableRuntimeEnginesProp) {
      setAvailableRuntimeEngines(availableRuntimeEnginesProp);
    }
  }, [availableRuntimeEnginesProp]);

  // Build the refs bundle passed to operation functions
  const getRefs = (): BoardStateRefs => ({
    userRef,
    boardNameRef,
    runtimesRef,
    servicesRef,
    registryRef,
    scopesRef,
    availableRuntimeEnginesRef,
    propsRef,
    setRuntimes,
    setServices,
    setRegistry,
    setScopes,
    setAvailableRuntimeEngines,
    setBoardNameState,
    setIsFetching,
    setErrorOnFetch,
    setFacade,
  });

  const waitForUserLogin = async () => {
    await new Promise<void>((resolve) => {
      awaitUserLoginResolverRef.current = resolve;
      setAwaitUserLogin(() => resolve);
    });
    awaitUserLoginResolverRef.current = null;
    setAwaitUserLogin(null);
  };

  const cancelUserLoginWait = () => {
    if (awaitUserLoginResolverRef.current) {
      awaitUserLoginResolverRef.current();
      awaitUserLoginResolverRef.current = null;
    }
    setAwaitUserLogin(null);
  };

  // --- Wired operations ---

  const fetchBoard = () => fetchBoardOp(getRefs(), waitForUserLogin, buildContextValue);
  const removeRuntime = (runtime: RuntimeDescriptor) => removeRuntimeOp(runtime, getRefs());
  const clearBoard = (newBoardNameArg?: string) => {
    cancelUserLoginWait();
    return clearBoardOp(newBoardNameArg, getRefs(), removeRuntime);
  };

  const addRuntime = (rtClass: RuntimeClass) => addRuntimeOp(rtClass, getRefs(), waitForUserLogin);
  const updateRuntime = (runtimeId: string, updated: RuntimeConfiguration) => updateRuntimeOp(runtimeId, updated, getRefs());
  const arrangeRuntimes = (runtimeId: string, targetPosition: number) => arrangeRuntimesOp(runtimeId, targetPosition, getRefs());
  const addAvailableRuntime = (rtClass: RuntimeClass, overwriteIfExists: boolean) => addAvailableRuntimeOp(rtClass, overwriteIfExists, getRefs());
  const removeAvailableRuntime = (rtClass: RuntimeClass) => removeAvailableRuntimeOp(rtClass, getRefs());
  const setRuntimeName = (runtimeId: string, newName: string) => setRuntimeNameOp(runtimeId, newName, getRefs());

  const addService = (service: ServiceClass, runtime: RuntimeDescriptor, prototype?: ServiceInstance) =>
    addServiceOp(service, runtime, getRefs(), prototype);
  const removeService = (service: InstanceId, runtime: RuntimeDescriptor) => removeServiceOp(service, runtime, getRefs());
  const removeAllServices = (runtime: RuntimeDescriptor) => removeAllServicesOp(runtime, getRefs());
  const arrangeServices = (runtime: RuntimeDescriptor, serviceUuid: string, targetPosition: number) =>
    arrangeServicesOp(runtime, serviceUuid, targetPosition, getRefs());
  const setServiceName = (runtimeId: string, instanceId: string, newName: string) =>
    setServiceNameOp(runtimeId, instanceId, newName, getRefs());

  const serializeBoard = () => serializeBoardOp(getRefs());
  const setBoardState = (newState: BoardDescriptor) => setBoardStateOp(newState, getRefs(), waitForUserLogin);

  const setBoardName = (name: string) => { setBoardNameState(name); };

  const isRuntimeInScope = (runtime: RuntimeDescriptor) => {
    const { isRuntimeInScope: isRuntimeInScopeProp } = propsRef.current;
    if (isRuntimeInScopeProp) {
      return isRuntimeInScopeProp();
    }
    return isRuntimeInScopeDefault(runtime, boardNameRef);
  };

  const acquireRuntimeScope = (boardname: string, runtime: RuntimeDescriptor) => {
    if (runtime.type === "browser") {
      if (!isRuntimeInScope(runtime)) {
        registerBrowserRuntime(boardname, runtime.id);
        fetchBoard();
      }
    }
  };

  const releaseRuntimeScope = (boardname: string, runtime: RuntimeDescriptor) => {
    if (runtime.type === "browser") {
      unregisterBrowserRuntime(boardname, runtime.id);
      fetchBoard();
    }
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
          const [scope, api] = getRuntimeScopeApi(firstRuntime.id, getRefs());
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
        const [scope, api] = getRuntimeScopeApi(runtime.id, getRefs());
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

  // Resolve pending login awaiter when user becomes available
  useEffect(() => {
    if (awaitUserLogin && userProp) {
      awaitUserLogin();
    }
  }, [awaitUserLogin, userProp]);

  const buildContextValue = (): BoardContextState => ({
    user,
    boardName,
    facade,
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
