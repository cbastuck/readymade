import { Component, FunctionComponent, ReactElement, ReactNode } from "react";
import PeerJs, { DataConnection } from "peerjs";
import { BoardContextState, EngineState } from "./BoardContext";

export type InstanceId = {
  uuid: string;
};

export type ServiceDescriptor = ServiceClass &
  InstanceId & {
    state?: any;
  };

export type RuntimeClassType =
  | "browser"
  | "remote" // @deprecated use graphql
  | "graphql"
  | "realtime" // @deprecated use rest
  | "rest";

export type CanonicalRuntimeClassType = "browser" | "graphql" | "rest";

export function toCanonicalRuntimeClassType(
  type: RuntimeClassType,
): CanonicalRuntimeClassType {
  if (type === "remote") {
    return "graphql";
  }
  if (type === "realtime") {
    return "rest";
  }
  return type;
}

export function isRuntimeGraphQLClassType(type: RuntimeClassType): boolean {
  return toCanonicalRuntimeClassType(type) === "graphql";
}

export function isRuntimeRestClassType(type: RuntimeClassType): boolean {
  return toCanonicalRuntimeClassType(type) === "rest";
}

export function isRuntimeBrowserClassType(type: RuntimeClassType): boolean {
  return toCanonicalRuntimeClassType(type) === "browser";
}

export type RuntimeClass = {
  type: RuntimeClassType;
  name: string;
  url?: string;
  bundles?: Array<string>;
  color?: string;
};

export type RuntimeCustomAction = {
  name: string;
  targetRuntimeId: string;
  // If set, send only this service's state as the payload instead of the
  // full { runtime, services } runtime source.
  sourceServiceId?: string;
};

export type RuntimeDescriptor = RuntimeClass & {
  id: string;
  state?: any; // TODO: should this be here? Only for persisted Runtime states?
  user?: User | null;
  boardName?: string;
  customActions?: Array<RuntimeCustomAction>;
};

export type OnResult = (
  uuid: string | null,
  result: any,
  context?: ProcessContext | null,
) => Promise<void>;

export type ProcessRuntimeByName = (name: string, params: any) => Promise<any>;

export interface RuntimeScope {
  descriptor: RuntimeDescriptor;
  authenticatedUser: User | null;

  getApp(): AppImpl;
  getApi(): RuntimeApi;
  // boardName: string; --> Remove the board name from the services and move it to AppImpl
  onResult: OnResult;
  onConfig?: (instanceId: string, config: object) => void;
  onAction: (_action: ServiceAction) => boolean;

  serializeState?: () => any;
  setState?: (partialUpdate: { [key: string]: any }) => void;
}

export type ExternalInput = {
  close: () => void;
};

export type Peer = PeerJs & {
  onConnectionClosed?: (dstName: string) => void;
  onConnectionOpened?: (dstName: string, connection: DataConnection) => void;
};

export type ConnectionAndPeer = {
  connection: DataConnection;
  srcPeer: Peer;
};

export type PeerConnections = {
  [srcPeer: string]: { [dstPeerName: string]: DataConnection };
};

export type DataEnvelope = { sender: string; data: any };

export type PeerJsHostDescriptor = {
  host: string;
  port: number;
  path: string;
  secure: boolean;
};


export type ServiceURI = string;

export type InitialServiceFrameState = {
  collapsed: boolean;
};

export type ServiceUIProps = {
  service: ServiceInstance;
  showBypassOnlyIfExplicit?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  frameless?: boolean;
  customMenuEntries?: Array<CustomMenuEntry>;
  serviceFrameState?: InitialServiceFrameState;
  onServiceAction: (command: ServiceAction) => void;
};

export type ServiceUIComponent =
  | typeof Component<ServiceUIProps>
  | FunctionComponent<ServiceUIProps>;

export type ServiceModule = ServiceClass & {
  create?: (
    app: AppImpl,
    board: string,
    service: ServiceClass,
    instanceId: string,
  ) => ServiceInstance;
  createUI?: ServiceUIComponent;
};
export type ServiceClass = {
  serviceName: string;
  serviceId: ServiceURI;
  // Optional semantic metadata that can be used by runtime engines and UI selection.
  version?: string;
  capabilities?: Array<string>;
};

export type ServiceRegistry = Array<ServiceClass>;
export type ServiceRegistryMap = { [runtimeId: string]: ServiceRegistry };

export type AddRuntimeResult = {
  runtime: RuntimeDescriptor;
  services: Array<ServiceDescriptor>;
  scope: RuntimeScope;
  registry: ServiceRegistry;
};

export type RestoreRuntimeResult = AddRuntimeResult;

const _actionTypes = [
  "logout",
  "newBoard",
  "clearBoard",
  "shareBoard",
  "saveBoard",
  "toggleBoardSync",
  "showBoardSource",
  "createBoardLink",
  "playBoard",
] as const;
export type ActionType = (typeof _actionTypes)[number];
export type Action = {
  type: ActionType;
  board?: string;
  params?: any;
};

const _serviceActionTypes = [
  "remove",
  "getConfig",
  "notification",
  "rename",
] as const;
export type ServiceActionType = (typeof _serviceActionTypes)[number];
export type ServiceAction = {
  action: ServiceActionType;
  service: ServiceInstance;
  payload?: any;
};

export type AppInstance = AppImpl;

export type AppImpl = {
  getAuthenticatedUser: () => User | null;
  notify: (svc: InstanceId, notification: any) => void; // TODO: should be InstanceId instead of ServiceImpl
  next: (svc: InstanceId | null, result: any) => void;
  getServiceById: (uuid: string) => ServiceInstance | null;
  sendAction: (action: ServiceAction) => void;
  storeServiceData: (serviceUuid: string, key: string, value: string) => void;
  restoreServiceData: (serviceUuid: string, key: string) => string | undefined;
  removeServiceData: (serviceUuid: string, key: string) => void;
  listAvailableServices: () => Array<ServiceModule>;
  createSubService: (
    parent: ServiceInstance,
    service: ServiceClass,
    instanceId?: string,
  ) => Promise<ServiceInstance | null>;
  createSubServiceUI: (svc: ServiceInstance) => ReactElement | null;

  // TODO: should be available for both Browser and GraphQL/REST runtimes
  registerNotificationTarget?: (
    svc: ServiceInstance,
    onNotification: (notification: any) => void,
  ) => void;
  unregisterNotificationTarget?: (
    svc: ServiceInstance,
    onNotification: (notification: any) => void,
  ) => void;
  configureService?: (svc: ServiceDescriptor, config: any) => void;
  processRuntimeByName?: (name: string, params: any) => Promise<any>;
  configureServiceInRuntime?: (runtimeId: string, serviceUuid: string, config: any) => Promise<void>;
};

export type CustomMenuEntry = {
  name: string;
  icon: ReactNode;
  config?: any;
  disabled?: boolean;
  onClick?: () => void;
};

export type ServiceState = Record<string, any>;

export type ServiceRuntimeContract = {
  process: (params: any) => Promise<any> | any;
  configure: (config: any) => Promise<any> | any;
  destroy?: () => Promise<void> | void;
  getConfiguration?: () => Promise<any>;
};

export type ServiceInstance = ServiceState &
  ServiceRuntimeContract & {
    uuid: string;
    serviceId?: string;
    serviceName?: string;

    board: string;
    app: AppImpl;
    bypass?: boolean;
    state?: any;
    version?: string;
    capabilities?: Array<string>;

    //__descriptor?: ServiceDescriptor; // TODO: remove - this only existed in old nodejs backend services
    __notificationTargets?: {
      notify: (svc: ServiceInstance, notification: any) => void;
      register: (
        svc: ServiceInstance,
        cb: (svc: ServiceInstance, notification: any) => void,
      ) => void;
      unregister: (
        svc: ServiceInstance,
        cb: (svc: ServiceInstance, notification: any) => void,
      ) => void;
    };
  };

export type RuntimeImpl = {
  configureService: (uuid: string, config: any) => Promise<void>;
  getServiceById: (uuid: string) => ServiceInstance | null;
  processRuntime: (
    params: any,
    svc: InstanceId | null,
    context?: ProcessContext | null,
  ) => Promise<any>;
  destroyService: (svcUuid: string) => Promise<void>;
  destroyRuntime: () => Promise<void>;
};

export type ProcessContext = {
  requestId: string;
  onResolve?: (result: any) => void;
};

export type RuntimeApi = {
  getHealth?: (runtime: RuntimeClass, user: User | null) => void;
  addRuntime: (
    runtime: RuntimeClass,
    user: User | null,
    boardName?: string,
  ) => Promise<AddRuntimeResult | null>;

  restoreRuntime: (
    runtime: RuntimeDescriptor,
    services: Array<ServiceDescriptor>,
    user: User | null,
    boardName?: string,
  ) => Promise<RestoreRuntimeResult | null>;

  attachRuntimes?: (
    runtime: RuntimeClass,
    user: User | null,
  ) => Promise<EngineState>;

  removeRuntime: (
    scope: RuntimeScope,
    runtime: RuntimeDescriptor,
    user: User | null,
  ) => Promise<void>;

  processRuntime: (
    scope: RuntimeScope,
    params: any,
    svc: InstanceId | null,
    context?: ProcessContext | null,
  ) => Promise<void>;

  addService: (
    scope: RuntimeScope,
    service: ServiceClass,
    instanceId?: string,
  ) => Promise<ServiceDescriptor | null>;

  removeService: (
    scope: RuntimeScope,
    service: InstanceId,
  ) => Promise<Array<ServiceDescriptor> | null>;

  configureService: (
    scope: RuntimeScope,
    service: InstanceId,
    config: any,
  ) => Promise<any>;

  getServiceConfig: (scope: RuntimeScope, service: InstanceId) => Promise<any>;

  processService: (
    scope: RuntimeScope,
    service: InstanceId,
    params: any,
    context?: ProcessContext | null,
  ) => Promise<any>;

  rearrangeServices: (
    scope: RuntimeScope,
    newOrder: Array<ServiceDescriptor>,
  ) => Promise<Array<ServiceDescriptor>>;
};

export type RuntimeApiMap = {
  [type: string]: RuntimeApi;
};

export type AppViewMode = "wide" | "narrow";

export type Bundles = Array<string>;

export type User = {
  username: string;
  userId: string;
  picture?: string;
  updatedAt?: string;
  features?: {
    registry?: string; // stringified Array<string>;
  };
  idToken: string;
};

export type NotificationType = "success" | "info" | "error";

export type Notification = {
  type: NotificationType;
  message: string;
  action?: {
    label: string;
    callback: () => void;
  };
  timeout?: number;
  error?: Error;
};

export type RuntimeServiceMap = {
  [runtimeId: string]: Array<ServiceDescriptor>;
};

export type RuntimeConfiguration = {
  runtime: RuntimeDescriptor;
  services: Array<ServiceDescriptor>;
};

export function isRuntimeConfiguration(obj: any): obj is RuntimeConfiguration {
  return obj.runtime && obj.services && Array.isArray(obj.services);
}

export type BoardDescriptor = {
  runtimes: Array<RuntimeDescriptor>;
  services: RuntimeServiceMap;
  registry?: ServiceRegistryMap;
  boardName?: string;
  description?: string;
  facade?: import("./facade/types").FacadeDescriptor;
};

export function isBoardDescriptor(data: any): data is BoardDescriptor {
  return (
    data.runtimes &&
    Array.isArray(data.runtimes) &&
    data.services &&
    typeof data.services == "object"
  );
}

export type PlaygroundState = BoardDescriptor & {
  acceptedSyncSenders: Array<any>;
  rejectedSyncSenders: Array<any>;
};

export type UsecaseDescriptor = {
  name: string;
  url: string;
  metadata: string;
  description: string;
  template: string;
  repo: string;
  image?: string;
};

export type SavedBoard = {
  id: string;
  url: string;
  description: string;
  value: BoardDescriptor;
  name: string;
  createdAt?: string;
};

export function isSavedBoard(board: any): board is SavedBoard {
  // TODO: make better
  return (
    board.url !== undefined &&
    board.value !== undefined &&
    board.name !== undefined
  );
}

export type AcceptedSyncSenders = Array<any>;
export type RejectedSyncSenders = Array<any>;

export enum RemoteRuntimeMessageType {
  PONG = "pong",
  RESULT = "result",
  PROCESS_BOARD_FROM_RT = "process-board-from-runtime",
  CONFIGURATION = "config",
  NOTIFICATION = "notification",
}

export type BoardMenuItem = {
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
};

export type BoardMenuItemFactory = (
  boardContext: BoardContextState,
) => Array<BoardMenuItem>;
