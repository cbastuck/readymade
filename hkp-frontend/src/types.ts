import { Component, FunctionComponent, ReactElement } from "react";
import PeerJs, { DataConnection } from "peerjs";

export type InstanceId = {
  uuid: string;
};

export type ServiceDescriptor = InstanceId & {
  serviceId: string;
  serviceName: string;
};

export type RuntimeClassType = "browser" | "remote" | "node";

export type RuntimeClass = {
  type: RuntimeClassType;
  name: string;
  url?: string;
  bundles?: Array<string>;
};

export type RuntimeDescriptor = RuntimeClass & {
  id: string;
  state?: any; // TODO: should this be here? Only for persisted Runtime states?
  user?: User | null;
};

export type OnResult = (
  uuid: string | null,
  result: any,
  requestId: string | null
) => Promise<void>;

export interface RuntimeScope {
  descriptor: RuntimeDescriptor;
  authenticatedUser: User | null;

  getApp(): AppImpl;
  // boardName: string; --> Remove the board name from the services and move it to AppImpl
  onResult: OnResult;
  onConfig?: (instanceId: string, config: object) => void;
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

const flowOptions = ["pass", "stop"] as const;
export type RuntimeFlowOutputOptions = (typeof flowOptions)[number];
export function isValidFlowOption(
  maybeOption: unknown
): maybeOption is RuntimeFlowOutputOptions {
  return (
    typeof maybeOption === "string" && flowOptions.includes(maybeOption as any)
  );
}

export type InputRoute = { peer: string | null };
export type OutputRoute = {
  flow: RuntimeFlowOutputOptions;
  peer: string | null;
};

export type InputRouting = { [runtimeId: string]: InputRoute };
export type OutputRouting = { [runtimeId: string]: OutputRoute };

export type SidechainRoute = { runtimeId: string; serviceUuid: string };
export type SidechainRouting = { [runtimeId: string]: Array<SidechainRoute> };

export type PeerOutputActivation = {
  route: OutputRoute;
  hostDescriptor: PeerJsHostDescriptor | null;
};

export type PeerInputActivation = {
  route: InputRoute;
  hostDescriptor: PeerJsHostDescriptor | null;
};

export type PeerInputRouting = { [id: string]: PeerInputActivation };
export type PeerOutputRouting = { [id: string]: PeerOutputActivation };

export type ServiceURI = string;
export type ServiceModule = ServiceClass & {
  create: (
    app: AppImpl,
    board: string,
    service: ServiceClass,
    instanceId: string
  ) => ServiceImpl;
  createUI?: typeof Component | FunctionComponent;
};
export type ServiceClass = {
  serviceName: string;
  serviceId: ServiceURI;
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

const actionTypes = [
  "logout",
  "newBoard",
  "clearBoard",
  "shareBoard",
  "saveBoard",
  "toggleBoardSync",
  "showBoardSource",
  "createBoardLink",
  "update-peers",
  "flow-changed",
  "update-peers",
  "flow-changed",
  "playBoard",
] as const;
export type ActionType = (typeof actionTypes)[number];
export type Action = {
  type: ActionType;
  board?: string;
  flow?: RuntimeFlowOutputOptions;
  params?: any;
};

const serviceActionTypes = ["remove", "getConfig"] as const;
export type ServiceActionType = (typeof serviceActionTypes)[number];
export type ServiceAction = {
  action: ServiceActionType;
  service: ServiceImpl;
};

export type AppImpl = {
  getAuthenticatedUser: () => User | null;
  notify: (svc: ServiceImpl, notification: any) => void;
  next: (svc: InstanceId | null, result: any) => void;
  getServiceById: (uuid: string) => ServiceImpl | null;
  sendAction: (action: ServiceAction) => void;
  storeServiceData: (serviceUuid: string, key: string, value: string) => void;
  restoreServiceData: (serviceUuid: string, key: string) => void;
  removeServiceData: (serviceUuid: string, key: string) => void;
  createSubService: (parent: ServiceImpl, service: ServiceDescriptor) => void;
  createSubServiceUI: (svc: ServiceImpl) => void;
};

// TODO: an open ended object - should be further defined
export type ServiceImpl = { [key: string]: any } & {
  serviceId?: string; // TODO not sure about this
  serviceName?: string; // TODO not sure about this
  __descriptor?: ServiceDescriptor; // TODO: remove - this only existed in old nodejs backend services
  __notificationTargets?: {
    notify: (svc: ServiceImpl, notification: any) => void;
    register: (
      id: string,
      cb: (svc: ServiceImpl, notification: any) => void
    ) => void;
    unregister: (id: string) => void;
  };

  bypass?: boolean;
  uuid: string;
  board: string;
  app: AppImpl;

  process: (params: any) => Promise<any>;
  configure: (config: any) => Promise<void>;
  destroy: () => Promise<void>;
};

export type RuntimeImpl = {
  configureService: (uuid: string, config: any) => Promise<void>;
  getServiceById: (uuid: string) => ServiceImpl | null;
  processRuntime: (params: any, svc: InstanceId | null) => Promise<any>;
  destroyService: (svcUuid: string) => Promise<void>;
  destroyRuntime: () => Promise<void>;
};

export type RuntimeApi = {
  addRuntime: (
    runtime: RuntimeClass,
    user: User | null
  ) => Promise<AddRuntimeResult | null>;
  restoreRuntime: (
    runtime: RuntimeDescriptor,
    services: Array<ServiceDescriptor>,
    user: User | null
  ) => Promise<RestoreRuntimeResult | null>;

  processRuntime: (
    scope: RuntimeScope,
    params: any,
    svc: InstanceId | null
  ) => Promise<any>;

  addService: (
    scope: RuntimeScope,
    service: ServiceClass
  ) => Promise<ServiceDescriptor | null>;

  removeService: (
    scope: RuntimeScope,
    service: InstanceId
  ) => Promise<Array<ServiceDescriptor> | null>;

  configureService: (
    scope: RuntimeScope,
    service: InstanceId,
    config: any
  ) => Promise<any>;

  getServiceConfig: (scope: RuntimeScope, service: InstanceId) => Promise<any>;

  processService: (
    scope: RuntimeScope,
    service: InstanceId,
    params: any,
    requestId: string | null
  ) => Promise<any>;
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

export type Notification = {
  type: "info" | "error";
  tag?: string;
  message: string;
  ctas?: Array<{
    icon: ReactElement;
    positive: boolean;
    callback: null | ((onClose: () => void) => void);
  }>;
  timeout?: number;
};

export type RuntimeServiceMap = {
  [runtimeId: string]: Array<ServiceDescriptor>;
};

export type BoardDescriptor = {
  runtimes: Array<RuntimeDescriptor>;
  services: RuntimeServiceMap;
  registry: ServiceRegistryMap;
  boardName?: string;
  description?: string;
};

export type SandboxRuntimeDescriptor = RuntimeDescriptor & {
  services: Array<ServiceDescriptor>;
};

export function isSandboxRuntimeDescriptor(
  obj: any
): obj is SandboxRuntimeDescriptor {
  return obj.id && obj.type && obj.services && Array.isArray(obj.services);
}

export type SandboxRuntimeDescriptorMap = {
  [id: string]: SandboxRuntimeDescriptor;
};

export type DeprecatedInputRouting = { [runtimeId: string]: string }; // old format with just a peer string

export type PlaygroundTemplate = BoardDescriptor & {
  sidechainRouting: SidechainRouting;
  inputRouting: DeprecatedInputRouting;
  outputRouting: OutputRouting;
};

export type PlaygroundBoard = BoardDescriptor & {
  sidechainRouting: SidechainRouting;
  outputRouting: PeerOutputRouting;
  inputRouting: PeerInputRouting;
};

export type PlaygroundState = PlaygroundBoard & {
  syncedPeer: string | undefined;
  boardSyncActive: boolean;
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
  url: string;
  description: string;
  value: BoardDescriptor;
  name: string;
};

export type AcceptedSyncSenders = Array<any>;
export type RejectedSyncSenders = Array<any>;

export enum RemoteRuntimeMessageType {
  RESULT = "result",
  CONFIGURATION = "config",
  NOTIFICATION = "notification",
}
