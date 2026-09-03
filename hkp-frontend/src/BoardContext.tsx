import {
  createContext,
  Dispatch,
  forwardRef,
  RefObject,
  SetStateAction,
  useContext,
  useEffect,
  useImperativeHandle,
  useReducer,
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
  RuntimeClassType,
  isRuntimeBrowserClassType,
} from "./types";
import { AppContextState, AppCtx } from "./AppContext";
import {
  BoardCoordinator,
  createBoardCoordinator,
} from "./core/coordinator";
import {
  configureKey,
  pendingMountConfigures,
} from "./core/mountPublication";
import { connectDevTools } from "./core/DevTools";
import { restoreAvailableRuntimeEngines } from "./common";
import {
  BoardStateRefs,
  Props,
  getRuntimeScopeApi,
} from "./core/boardContextTypes";
import { FacadeDescriptor } from "./facade/types";
import { BoardLinkage } from "./runtime/board/units";
import {
  fetchBoard as fetchBoardOp,
  serializeBoard as serializeBoardOp,
  serializeBoardDocuments as serializeBoardDocumentsOp,
  BoardDocuments,
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
    insertAtIndex?: number,
  ) => void;
  removeService: (svc: InstanceId, rt: RuntimeDescriptor) => void;

  arrangeService: (rt: RuntimeDescriptor, svcUuid: string, dst: number) => void;
  arrangeRuntime: (runtimeId: string, dst: number) => void;

  clearBoard: (emptyBoardName?: string) => Promise<void>;

  /**
   * Gives up ownership of the board's remote runtimes.
   *
   * Deploying hands a board to a coordinator, which provisions the runtimes
   * itself — under the same ids, because they are the board's. From that moment
   * they are the coordinator's, and this browser tearing them down on its way
   * out would delete a board someone else now owns. Called before the handover
   * is attempted, so a navigation that lands in between cannot do that either.
   */
  handOverRuntimes: () => void;

  fetchBoard: () => Promise<void>;
  isActionAvailable: (action: Action) => boolean;
  onAction: (action: Action) => void;

  serializeBoard: () => Promise<BoardDescriptor | null>;
  /**
   * The board as the documents it came from, for saving. Identical to
   * `serializeBoard` wrapped in one document unless the board was assembled
   * from units. See `core/boardPersistence`.
   */
  serializeBoardDocuments: () => Promise<BoardDocuments | null>;
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

    /** The instance that owns this board's engine state and answers questions
     *  that span runtimes (see core/coordinator). */
    coordinator: BoardCoordinator;

    boardName?: string;
    facade?: FacadeDescriptor;
    /**
     * What linking this board produced: the units it was assembled from and the
     * views they contribute. Absent on a board that declares no units — which
     * is every board that is not a composition. See `runtime/board/units`.
     */
    linkage?: BoardLinkage;

    availableRuntimeEngines: Array<RuntimeClass>;
    runtimeApis: RuntimeApiMap;

    appContext: AppContextState | null;
    awaitUserLogin: (() => void) | null;

    errorOnFetch?: Error;
    isFetching: boolean;
  };

type ProviderState = EngineState & {
  availableRuntimeEngines: Array<RuntimeClass>;
  facade?: FacadeDescriptor;
  linkage?: BoardLinkage;
  isFetching: boolean;
  errorOnFetch?: Error;
};

type ProviderStateAction =
  | { type: "setRuntimes"; value: SetStateAction<Array<RuntimeDescriptor>> }
  | {
      type: "setServices";
      value: SetStateAction<{ [runtimeId: string]: Array<ServiceDescriptor> }>;
    }
  | {
      type: "setRegistry";
      value: SetStateAction<{ [runtimeId: string]: ServiceRegistry }>;
    }
  | {
      type: "setScopes";
      value: SetStateAction<{ [runtimeId: string]: RuntimeScope }>;
    }
  | {
      type: "setAvailableRuntimeEngines";
      value: SetStateAction<Array<RuntimeClass>>;
    }
  | {
      type: "setFacade";
      value: SetStateAction<FacadeDescriptor | undefined>;
    }
  | {
      type: "setLinkage";
      value: SetStateAction<BoardLinkage | undefined>;
    }
  | { type: "setIsFetching"; value: SetStateAction<boolean> }
  | {
      type: "setErrorOnFetch";
      value: SetStateAction<Error | undefined>;
    };

function resolveSetStateAction<T>(prev: T, value: SetStateAction<T>): T {
  return typeof value === "function" ? (value as (p: T) => T)(prev) : value;
}

function providerStateReducer(
  state: ProviderState,
  action: ProviderStateAction,
): ProviderState {
  switch (action.type) {
    case "setRuntimes":
      return {
        ...state,
        runtimes: resolveSetStateAction(state.runtimes, action.value),
      };
    case "setServices":
      return {
        ...state,
        services: resolveSetStateAction(state.services, action.value),
      };
    case "setRegistry":
      return {
        ...state,
        registry: resolveSetStateAction(state.registry, action.value),
      };
    case "setScopes":
      return {
        ...state,
        scopes: resolveSetStateAction(state.scopes, action.value),
      };
    case "setAvailableRuntimeEngines":
      return {
        ...state,
        availableRuntimeEngines: resolveSetStateAction(
          state.availableRuntimeEngines,
          action.value,
        ),
      };
    case "setFacade":
      return {
        ...state,
        facade: resolveSetStateAction(state.facade, action.value),
      };
    case "setLinkage":
      return {
        ...state,
        linkage: resolveSetStateAction(state.linkage, action.value),
      };
    case "setIsFetching":
      return {
        ...state,
        isFetching: resolveSetStateAction(state.isFetching, action.value),
      };
    case "setErrorOnFetch":
      return {
        ...state,
        errorOnFetch: resolveSetStateAction(state.errorOnFetch, action.value),
      };
    default:
      return state;
  }
}

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

const BoardProvider = forwardRef<BoardProviderHandle, Props>(
  function BoardProvider(props, ref) {
    const {
      user: userProp,
      initialBoardName,
      boardName: boardNameProp,
      availableRuntimeEngines: availableRuntimeEnginesProp,
      runtimeApis: runtimeApisProp,
      fetchAfterMount,
      initialState,
      coordinator: coordinatorProp,
    } = props;

    const appContext = useContext(AppCtx);

    // The user is owned by the host and arrives as a prop. Mirroring it into
    // state only added a render's worth of lag, which async work reading it
    // through a ref would observe as a null user.
    const user = userProp;
    const [boardName, setBoardNameState] = useState<string | undefined>(
      initialBoardName ?? boardNameProp,
    );
    const [state, dispatch] = useReducer(providerStateReducer, {
      runtimes: initialState?.runtimes || [],
      services: initialState?.services || {},
      registry: initialState?.registry || {},
      scopes: initialState?.scopes || {},
      availableRuntimeEngines:
        availableRuntimeEnginesProp || restoreAvailableRuntimeEngines(),
      facade: undefined,
      linkage: undefined,
      isFetching: false,
      errorOnFetch: undefined,
    });
    const {
      runtimes,
      services,
      registry,
      scopes,
      availableRuntimeEngines,
      facade,
      linkage,
      isFetching,
      errorOnFetch,
    } = state;
    const [awaitUserLogin, setAwaitUserLogin] = useState<(() => void) | null>(
      null,
    );
    const awaitUserLoginResolverRef = useRef<(() => void) | null>(null);
    const inFlightFetchesRef = useRef<Set<{ cancelled: boolean }>>(new Set());

    // Refs to latest state/props for use inside async closures
    const userRef = useRef(userProp);
    userRef.current = userProp;
    const boardNameRef = useRef(boardName);
    boardNameRef.current = boardName;
    const providerStateRef = useRef(state);
    providerStateRef.current = state;
    // A board is owned by whoever holds its engine state, which is this provider
    // unless the host says otherwise — a cloud board is coordinated by hkp-node,
    // and this browser is then a participant rather than the owner. One local
    // instance for the provider's lifetime, reading through the ref so the
    // services and hosts it is handed to always see current state.
    const localCoordinatorRef = useRef<BoardCoordinator | null>(null);
    if (!localCoordinatorRef.current) {
      localCoordinatorRef.current = createBoardCoordinator(
        () => providerStateRef.current,
      );
    }
    const coordinator = coordinatorProp ?? localCoordinatorRef.current;
    const propsRef = useRef(props);
    propsRef.current = props;
    const appContextRef = useRef(appContext);
    appContextRef.current = appContext;

    const asRef = <T,>(current: T): RefObject<T> =>
      ({ current }) as RefObject<T>;

    const setRuntimes: Dispatch<SetStateAction<Array<RuntimeDescriptor>>> = (
      value,
    ) => dispatch({ type: "setRuntimes", value });
    const setServices: Dispatch<
      SetStateAction<{ [runtimeId: string]: Array<ServiceDescriptor> }>
    > = (value) => dispatch({ type: "setServices", value });
    const setRegistry: Dispatch<
      SetStateAction<{ [runtimeId: string]: ServiceRegistry }>
    > = (value) => dispatch({ type: "setRegistry", value });
    const setScopes: Dispatch<
      SetStateAction<{ [runtimeId: string]: RuntimeScope }>
    > = (value) => dispatch({ type: "setScopes", value });
    const setAvailableRuntimeEngines: Dispatch<
      SetStateAction<Array<RuntimeClass>>
    > = (value) => dispatch({ type: "setAvailableRuntimeEngines", value });
    const setFacade: Dispatch<SetStateAction<FacadeDescriptor | undefined>> = (
      value,
    ) => dispatch({ type: "setFacade", value });
    const setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>> = (
      value,
    ) => dispatch({ type: "setLinkage", value });
    const setIsFetching: Dispatch<SetStateAction<boolean>> = (value) =>
      dispatch({ type: "setIsFetching", value });
    const setErrorOnFetch: Dispatch<SetStateAction<Error | undefined>> = (
      value,
    ) => dispatch({ type: "setErrorOnFetch", value });

    // Sync props -> state
    useEffect(() => {
      if (availableRuntimeEnginesProp) {
        setAvailableRuntimeEngines(availableRuntimeEnginesProp);
      }
    }, [availableRuntimeEnginesProp]);

    // Build the refs bundle passed to operation functions
    const getRefs = (): BoardStateRefs => ({
      userRef,
      appContextRef,
      boardNameRef,
      runtimesRef: asRef(providerStateRef.current.runtimes),
      servicesRef: asRef(providerStateRef.current.services),
      registryRef: asRef(providerStateRef.current.registry),
      scopesRef: asRef(providerStateRef.current.scopes),
      availableRuntimeEnginesRef: asRef(
        providerStateRef.current.availableRuntimeEngines,
      ),
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
      setLinkage,
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

    const fetchBoard = async () => {
      const cancellation = { cancelled: false };
      inFlightFetchesRef.current.add(cancellation);
      try {
        await fetchBoardOp(
          getRefs(),
          waitForUserLogin,
          buildContextValue,
          cancellation,
        );
      } finally {
        inFlightFetchesRef.current.delete(cancellation);
      }
    };
    const removeRuntime = (runtime: RuntimeDescriptor) =>
      removeRuntimeOp(runtime, getRefs());
    const clearBoard = (newBoardNameArg?: string) => {
      cancelUserLoginWait();
      return clearBoardOp(newBoardNameArg, getRefs(), removeRuntime);
    };

    const addRuntime = (rtClass: RuntimeClass) =>
      addRuntimeOp(rtClass, getRefs(), waitForUserLogin, (err) => {
        appContext?.pushNotification({
          message: `Failed to connect to "${rtClass.name}": ${err.message}`,
          type: "error",
        });
      });
    const updateRuntime = (runtimeId: string, updated: RuntimeConfiguration) =>
      updateRuntimeOp(runtimeId, updated, getRefs());
    const arrangeRuntimes = (runtimeId: string, targetPosition: number) =>
      arrangeRuntimesOp(runtimeId, targetPosition, getRefs());
    const addAvailableRuntime = (
      rtClass: RuntimeClass,
      overwriteIfExists: boolean,
    ) => addAvailableRuntimeOp(rtClass, overwriteIfExists, getRefs());
    const removeAvailableRuntime = (rtClass: RuntimeClass) =>
      removeAvailableRuntimeOp(rtClass, getRefs());
    const setRuntimeName = (runtimeId: string, newName: string) =>
      setRuntimeNameOp(runtimeId, newName, getRefs());

    const addService = (
      service: ServiceClass,
      runtime: RuntimeDescriptor,
      prototype?: ServiceInstance,
      insertAtIndex?: number,
    ) => addServiceOp(service, runtime, getRefs(), prototype, insertAtIndex);
    const removeService = (service: InstanceId, runtime: RuntimeDescriptor) =>
      removeServiceOp(service, runtime, getRefs());
    const removeAllServices = (runtime: RuntimeDescriptor) =>
      removeAllServicesOp(runtime, getRefs());
    const arrangeServices = (
      runtime: RuntimeDescriptor,
      serviceUuid: string,
      targetPosition: number,
    ) => arrangeServicesOp(runtime, serviceUuid, targetPosition, getRefs());
    const setServiceName = (
      runtimeId: string,
      instanceId: string,
      newName: string,
    ) => setServiceNameOp(runtimeId, instanceId, newName, getRefs());

    const serializeBoard = () => serializeBoardOp(getRefs());
    const serializeBoardDocuments = () =>
      serializeBoardDocumentsOp(getRefs(), providerStateRef.current.linkage);
    const setBoardState = (newState: BoardDescriptor) =>
      setBoardStateOp(newState, getRefs(), waitForUserLogin, removeRuntime);

    const setBoardName = (name: string) => {
      setBoardNameState(name);
    };

    const isRuntimeInScope = (runtime: RuntimeDescriptor) => {
      const { isRuntimeInScope: isRuntimeInScopeProp } = propsRef.current;
      if (isRuntimeInScopeProp) {
        return isRuntimeInScopeProp();
      }
      return isRuntimeInScopeDefault(runtime, boardNameRef);
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

    const isActionAvailableDefault = (action: Action) => {
      switch (action.type) {
        case "clearBoard":
          return true;
        default:
          return true;
      }
    };

    const isActionAvailable = (action: Action) => {
      const {
        isActionAvailable: isActionAvailableProp = isActionAvailableDefault,
      } = propsRef.current;
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
          const firstRuntime = providerStateRef.current.runtimes[0];
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

    // Set once the board is deployed; see handOverRuntimes. A ref rather than
    // state because the unmount cleanup below reads it, and that runs after the
    // last render.
    const handedOverRef = useRef(false);
    const handOverRuntimes = () => {
      handedOverRef.current = true;
    };

    // Mount + unmount in one effect so we share a per-mount cancellation token.
    // In React strict mode the sequence is: mount → unmount → remount.
    // The first fetch sees `cancelled = true` when it finishes and tears down
    // its own scopes. The second fetch runs normally on the real mount.
    useEffect(() => {
      if (fetchAfterMount) {
        fetchBoard();
      }

      const currentBoardName = boardNameRef.current;
      if (currentBoardName) {
        document.title = currentBoardName;
      }

      return () => {
        // Signal all in-flight fetches (including imperative calls from outside)
        // to self-clean when they resolve after unmount.
        for (const cancellation of inFlightFetchesRef.current) {
          cancellation.cancelled = true;
        }
        // Clean up runtimes that are already committed to state (real unmount path).
        const onUnmountRuntime = propsRef.current?.onUnmountRuntime;
        for (const runtime of providerStateRef.current.runtimes) {
          const [scope, api] = getRuntimeScopeApi(runtime.id, getRefs());
          if (api && scope) {
            const handedOver =
              handedOverRef.current &&
              !isRuntimeBrowserClassType(runtime.type as RuntimeClassType);
            const defaultHandler = () =>
              handedOver
                ? // Deleting would take down the deployed board: the runtime
                  //  under this id belongs to the coordinator now. Dropping the
                  //  connection is all this browser still owns.
                  scope.close?.()
                : api.removeRuntime(scope, runtime, userRef.current);
            if (onUnmountRuntime) {
              onUnmountRuntime(runtime, scope, defaultHandler);
            } else {
              defaultHandler();
            }
          } else {
            console.warn(
              `BoardProvider unmount: api or scope missing for runtime: ${runtime.id}`,
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

    // Notify on infrastructure changes (runtimes/services/boardName/facade).
    // Config-only changes (service params, bypass) do not touch these state slices.
    const isFirstInfraRenderRef = useRef(true);
    const infraDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const infraPendingCallRef = useRef<(() => void) | null>(null);
    useEffect(() => {
      if (isFirstInfraRenderRef.current) {
        isFirstInfraRenderRef.current = false;
        return;
      }
      if (infraDebounceRef.current) {
        clearTimeout(infraDebounceRef.current);
      }
      const call = () => {
        propsRef.current.onBoardInfrastructureChange?.({
          boardName,
          runtimes,
          services,
          registry,
          facade,
        });
        infraPendingCallRef.current = null;
      };
      infraPendingCallRef.current = call;
      infraDebounceRef.current = setTimeout(call, 500);
      return () => {
        if (infraDebounceRef.current) {
          clearTimeout(infraDebounceRef.current);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runtimes, services, boardName, registry, facade]);

    // Flush any pending infrastructure change notification when unmounting
    // so history is saved even if the user navigates away before the debounce fires.
    useEffect(() => {
      return () => {
        if (infraPendingCallRef.current) {
          infraPendingCallRef.current();
        }
      };
    }, []);

    // Services on remote runtimes cannot resolve a mount reference themselves —
    // only whoever owns the board sees across runtimes. When this browser is
    // that owner, hand them the address as soon as there is one. Board state
    // changes as runtimes come up, which is exactly when an address appears.
    const sentMountsRef = useRef(new Map<string, string>());
    useEffect(() => {
      const pending = pendingMountConfigures(
        { runtimes, services },
        coordinator,
        sentMountsRef.current,
        (type) => !isRuntimeBrowserClassType(type as RuntimeClassType),
      );
      for (const { runtimeId, serviceUuid, url } of pending) {
        const [scope, api] = getRuntimeScopeApi(runtimeId, getRefs());
        if (!scope || !api?.configureService) {
          continue;
        }
        sentMountsRef.current.set(configureKey(runtimeId, serviceUuid), url);
        void Promise.resolve(
          api.configureService(scope, { uuid: serviceUuid }, {
            __hkpMount: url,
          }),
        ).catch((err) => {
          // Let the next state change try again rather than leaving the
          // consumer configured in this browser's bookkeeping only.
          sentMountsRef.current.delete(configureKey(runtimeId, serviceUuid));
          console.error(
            `Failed to hand mount address to "${runtimeId}/${serviceUuid}"`,
            err,
          );
        });
      }
    }, [runtimes, services, coordinator]);

    const buildContextValue = (): BoardContextState => ({
      user,
      coordinator,
      boardName,
      facade,
      linkage,
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
      handOverRuntimes,
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
      serializeBoardDocuments,
      setBoardState,
    });

    const value = buildContextValue();

    useImperativeHandle(
      ref,
      () => ({
        ...value,
        state: value,
      }),
      [value],
    ); // eslint-disable-line react-hooks/exhaustive-deps

    connectDevTools(value);

    return <Provider value={value}>{props.children}</Provider>;
  },
);

export function useBoardContext() {
  return useContext(BoardCtx);
}

export { BoardCtx };
export default BoardProvider;
