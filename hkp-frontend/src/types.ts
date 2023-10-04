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

export type SavedBoard = {
  url: string;
  description: string;
  value: BoardDescriptor;
  name: string;
};

export type InputRouteCompat = string;
export type InputRoute = { peer: string | null };
export type InputRoutingCompat = {
  [id: string]: InputRouteCompat | InputRoute;
};
export type InputRouting = { [id: string]: InputRoute | null };

export type OutputRoute = {
  peer?: any;
  flow?: any;
};
export type OutputRouting = { [runtimeId: string]: OutputRoute | null };

export type SidechainRoute = { runtimeId: string; serviceUuid: string };
export type SidechainRouting = { [runtimeId: string]: Array<SidechainRoute> };

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

export type PeerOutputActivation = PeerJsHostDescriptor & OutputRoute;
export type PeerInputActivation = PeerJsHostDescriptor & InputRoute;

export type BoardDescriptor = {
  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: Array<ServiceDescriptor> };
  boardName?: string;
  registry?: { [runtimeId: string]: ServiceRegistry };
};

export type PlaygroundBoard = BoardDescriptor & {
  sidechainRouting: SidechainRouting;
  outputRouting: OutputRouting | null;
  inputRouting: InputRouting;
  description: string;
  boardSyncActive: boolean;
  syncedPeer: string | undefined;
  acceptedSyncSenders: Array<any>;
  rejectedSyncSenders: Array<any>;
};

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

export type ServiceClass = {
  serviceName: string;
  serviceId: ServiceURI;
};

export type AddRuntimeResult = Promise<{
  runtime: RuntimeDescriptor;
  services: Array<ServiceDescriptor>;
  registry: ServiceRegistry;
}>;

export type AddServiceResult =
  | Promise<ServiceDescriptor>
  | ServiceDescriptor
  | undefined;

export type Action = { type: string; board?: string; flow?: string };

export type ServiceAction = {
  service: ServiceDescriptor;
  action: string;
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
  __descriptor?: ServiceDescriptor; // TODO: remove - this only existed in old nodejs backend services
  __notificationTargets?: {
    notify: (svc: ServiceImpl, notification: any) => void;
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
