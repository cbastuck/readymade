import PeerJs, { DataConnection } from "peerjs";
import { ReactElement } from "react";

export type ServiceId = {
  uuid: string;
};

export type ServiceDescriptor = ServiceId & {
  serviceId: string;
  serviceName: string;
};

export type RuntimeClassType = "browser" | "remote" | "node";

export type RuntimeClass = {
  type: RuntimeClassType;
  name: string;
  url?: string;
};

export type RuntimeDescriptor = RuntimeClass & {
  id: string;
  state?: any;
};

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
    app: any,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => ServiceImpl;
  createUI?: React.ElementType;
};

export type ServiceRegistry = Array<ServiceModule>;
export type ServiceRegistryMap = { [runtimeId: string]: ServiceRegistry };

export type ServiceClass = {
  serviceName: string;
  serviceId: ServiceURI;
};

export type AddRuntimeResult = Promise<{
  runtime: RuntimeDescriptor;
  services: Array<ServiceDescriptor>;
  registry: ServiceRegistry;
} | null>;

export type AddServiceResult =
  | Promise<ServiceDescriptor>
  | ServiceDescriptor
  | undefined;

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
  "loadBoard",
  "update-peers",
  "flow-changed",
] as const;
export type ActionType = (typeof actionTypes)[number];
export type Action = {
  type: ActionType;
  board?: string;
  flow?: RuntimeFlowOutputOptions;
};

const serviceActionTypes = ["remove", "getConfig"] as const;
export type ServiceActionType = (typeof serviceActionTypes)[number];
export type ServiceAction = {
  action: ServiceActionType;
  service: ServiceImpl;
};

export type AppImpl = {
  notify: (svc: ServiceImpl, notification: any) => void;
  next: (svc: ServiceId | null, result: any) => void;
  getServiceById: (uuid: string) => ServiceImpl | null;
  sendAction: (action: ServiceAction) => void;
  storeServiceData: (serviceUuid: string, key: string, value: string) => void;
  restoreServiceData: (serviceUuid: string, key: string) => void;
  removeServiceData: (serviceUuid: string, key: string) => void;
  createSubService: (parent: ServiceImpl, service: ServiceDescriptor) => void;
  createSubServiceUI: (svc: ServiceImpl) => void;
};

export type ServiceImpl = {
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

  process: (params: any) => any;
  configure: (config: any) => void;
  destroy?: () => void;
};

export type RuntimeImpl = {
  getServiceById: (uuid: string) => ServiceImpl | null;
  processRuntime: (params: any, svc: ServiceId | null) => any;
  destroyService: (svcUuid: string) => void;
  destroyRuntime: () => void;
};

export type AppViewMode = "wide" | "narrow";

export type Bundles = Array<string>;

export type User = {
  username: string;
  userId: string;
  features?: {
    registry?: string; // stringified Array<string>;
  };
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
};

export type RuntimeServiceMap = {
  [runtimeId: string]: Array<ServiceDescriptor>;
};

export type BoardDescriptor = {
  runtimes: Array<RuntimeDescriptor>;
  services: RuntimeServiceMap;
  boardName?: string;
  registry?: ServiceRegistryMap;
  description?: string;
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
