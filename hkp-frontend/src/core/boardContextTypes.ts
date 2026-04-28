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
import { BoardContextState, EngineState } from "../BoardContext";

export type Props = {
  user: User | null;
  initialBoardName?: string;
  boardName?: string;
  children: JSX.Element | JSX.Element[];
  availableRuntimeEngines?: Array<RuntimeClass>;
  runtimeApis?: RuntimeApiMap;
  fetchAfterMount?: boolean;
  initialState?: EngineState;

  fetchBoard?: () => Promise<BoardDescriptor>;
  isRuntimeInScope?: () => boolean;
  onRemoveRuntime?: (runtime: RuntimeDescriptor) => Promise<void>;
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
