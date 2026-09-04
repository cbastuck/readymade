import { Dispatch, RefObject, SetStateAction } from "react";
import {
  Action,
  BoardDescriptor,
  InstanceId,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceDescriptor,
  ServiceRegistry,
  RuntimeScope,
  RuntimeApi,
  toCanonicalRuntimeClassType,
  User,
  RuntimeApiMap,
} from "../types";
import { FacadeDescriptor } from "../facade/types";
import { BoardLinkage } from "../runtime/board/units";
import { UnitOrigin } from "./linkUnits";
import { BoardContextState, EngineState } from "../BoardContext";
import { BoardCoordinator } from "./coordinator";
import { AppContextState } from "../AppContext";

export type Props = {
  user: User | null;
  initialBoardName?: string;
  boardName?: string;
  children: JSX.Element | JSX.Element[];
  availableRuntimeEngines?: Array<RuntimeClass>;
  runtimeApis?: RuntimeApiMap;
  fetchAfterMount?: boolean;
  initialState?: EngineState;
  /**
   * The instance that owns this board. Omit when this provider owns it — the
   * playground and Readymade, where the browser holds the engine state. A host
   * whose board is coordinated elsewhere (a cloud board, coordinated by
   * hkp-node) passes that coordinator instead, so services and runtime hosts
   * ask the owner rather than a local copy of it.
   */
  coordinator?: BoardCoordinator;

  fetchBoard?: () => Promise<BoardDescriptor>;
  /**
   * Where this board's units are to be looked for, when the host knows how the
   * board arrived — beside the URL it was fetched from, among the files it was
   * dropped with. Called per load, since that answer changes with the board.
   * Without one, units are looked for among saved boards.
   */
  unitOrigin?: () => UnitOrigin | undefined;
  isRuntimeInScope?: () => boolean;
  onRemoveRuntime?: (runtime: RuntimeDescriptor) => Promise<void>;
  /**
   * Called for each runtime when BoardProvider unmounts. Receives a
   * `defaultHandler` that performs the standard teardown (closes the WebSocket
   * and sends DELETE to the runtime server). Omit the call to `defaultHandler`
   * to suppress teardown for that runtime — useful for cloud boards where the
   * coordinator owns the runtime lifecycle.
   */
  onUnmountRuntime?: (
    runtime: RuntimeDescriptor,
    scope: RuntimeScope,
    defaultHandler: () => void,
  ) => void;
  newBoard?: (searchParams?: string) => void;
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
  onBoardInfrastructureChange?: (board: BoardDescriptor) => void;
};

export type BoardStateRefs = {
  userRef: RefObject<User | null>;
  /** Absent on hosts that build a partial refs bundle (e.g. tests). */
  appContextRef?: RefObject<AppContextState | null>;
  boardNameRef: RefObject<string | undefined>;
  runtimesRef: RefObject<Array<RuntimeDescriptor>>;
  servicesRef: RefObject<{ [runtimeId: string]: Array<ServiceDescriptor> }>;
  registryRef: RefObject<{ [runtimeId: string]: ServiceRegistry }>;
  scopesRef: RefObject<{ [runtimeId: string]: RuntimeScope }>;
  availableRuntimeEnginesRef: RefObject<Array<RuntimeClass>>;
  propsRef: RefObject<Props>;
  setRuntimes: Dispatch<SetStateAction<Array<RuntimeDescriptor>>>;
  setServices: Dispatch<
    SetStateAction<{ [runtimeId: string]: Array<ServiceDescriptor> }>
  >;
  setRegistry: Dispatch<
    SetStateAction<{ [runtimeId: string]: ServiceRegistry }>
  >;
  setScopes: Dispatch<SetStateAction<{ [runtimeId: string]: RuntimeScope }>>;
  setAvailableRuntimeEngines: Dispatch<SetStateAction<Array<RuntimeClass>>>;
  setBoardNameState: Dispatch<SetStateAction<string | undefined>>;
  setIsFetching: Dispatch<SetStateAction<boolean>>;
  setErrorOnFetch: Dispatch<SetStateAction<Error | undefined>>;
  setFacade: Dispatch<SetStateAction<FacadeDescriptor | undefined>>;
  setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>>;
};

export function getRuntimeScopeApi(
  runtimeId: string,
  refs: Pick<BoardStateRefs, "runtimesRef" | "scopesRef" | "propsRef">,
): [RuntimeScope | null, RuntimeApi | null] {
  const runtime =
    refs.runtimesRef.current!.find((rt) => rt.id === runtimeId) || null;
  const scope = refs.scopesRef.current![runtimeId] || null;
  const runtimeApiMap = refs.propsRef.current!.runtimeApis;
  return [
    scope,
    (runtime &&
      (runtimeApiMap?.[runtime.type] ||
        runtimeApiMap?.[toCanonicalRuntimeClassType(runtime.type)])) ||
      null,
  ];
}
