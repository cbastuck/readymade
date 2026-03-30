import { Dispatch, RefObject, SetStateAction } from "react";
import {
  RuntimeDescriptor,
  ServiceDescriptor,
  ServiceRegistry,
  RuntimeScope,
  RuntimeApi,
  User,
  RuntimeApiMap,
} from "../types";

export type Props = {
  user: User | null;
  boardName?: string;
  children: JSX.Element | JSX.Element[];
  availableRuntimeEngines?: Array<import("../types").RuntimeClass>;
  runtimeApis?: RuntimeApiMap;
  fetchAfterMount?: boolean;
  initialState?: import("../BoardContext").EngineState;

  fetchBoard?: () => Promise<import("../types").BoardDescriptor>;
  isRuntimeInScope?: () => boolean;
  onRemoveRuntime?: (runtime: RuntimeDescriptor) => Promise<void>;
  newBoard?: (searchParams?: string) => void;
  onClearBoard?: (
    board: import("../types").BoardDescriptor,
    newBoardName: string,
  ) => Promise<void>;
  saveBoard?: () => void;
  shareBoard?: () => void;
  onRemoveService?: (
    service: import("../types").InstanceId,
    runtime: RuntimeDescriptor,
  ) => void;
  isActionAvailable?: (action: import("../types").Action) => boolean;
  onAction?: (action: any) => boolean;
  serializeBoard?: (
    desc: import("../types").BoardDescriptor,
  ) => Promise<import("../types").BoardDescriptor | null>;
  onUpdateBoardState?: (updated: import("../types").BoardDescriptor) => void;
  onLoad?: (context: import("../BoardContext").BoardContextState) => void;
};

export type BoardStateRefs = {
  userRef: RefObject<User | null>;
  boardNameRef: RefObject<string | undefined>;
  runtimesRef: RefObject<Array<RuntimeDescriptor>>;
  servicesRef: RefObject<{ [runtimeId: string]: Array<ServiceDescriptor> }>;
  registryRef: RefObject<{ [runtimeId: string]: ServiceRegistry }>;
  scopesRef: RefObject<{ [runtimeId: string]: RuntimeScope }>;
  availableRuntimeEnginesRef: RefObject<
    Array<import("../types").RuntimeClass>
  >;
  propsRef: RefObject<Props>;
  setRuntimes: Dispatch<SetStateAction<Array<RuntimeDescriptor>>>;
  setServices: Dispatch<
    SetStateAction<{ [runtimeId: string]: Array<ServiceDescriptor> }>
  >;
  setRegistry: Dispatch<
    SetStateAction<{ [runtimeId: string]: ServiceRegistry }>
  >;
  setScopes: Dispatch<
    SetStateAction<{ [runtimeId: string]: RuntimeScope }>
  >;
  setAvailableRuntimeEngines: Dispatch<
    SetStateAction<Array<import("../types").RuntimeClass>>
  >;
  setBoardNameState: Dispatch<SetStateAction<string | undefined>>;
  setIsFetching: Dispatch<SetStateAction<boolean>>;
  setErrorOnFetch: Dispatch<SetStateAction<Error | undefined>>;
};

export function getRuntimeScopeApi(
  runtimeId: string,
  refs: Pick<BoardStateRefs, "runtimesRef" | "scopesRef" | "propsRef">,
): [RuntimeScope | null, RuntimeApi | null] {
  const runtime =
    refs.runtimesRef.current!.find((rt) => rt.id === runtimeId) || null;
  const scope = refs.scopesRef.current![runtimeId] || null;
  return [
    scope,
    (runtime && refs.propsRef.current!.runtimeApis?.[runtime.type]) || null,
  ];
}
