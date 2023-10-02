import PeerJs from "peerjs";

export type ServiceDescriptor = {
  uuid: string;
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
};

export type ExternalInput = {
  close: () => void;
};

export type AppContextState = {
  user: any;
};

export type SavedBoard = {
  url: string;
  description: string;
  value: BoardDescriptor;
  name: string;
};

export type InputRouteCompat = string;
export type InputRoute = { peer: string };
export type InputRoutingCompat = {
  [id: string]: InputRouteCompat | InputRoute;
};
export type InputRouting = { [id: string]: InputRoute };

export type OutputRoute = {
  peer?: any;
  flow?: any;
};
export type OutputRouting = { [runtimeId: string]: OutputRoute };

export type SidechainRoute = { runtimeId: string; serviceUuid: string };
export type SidechainRouting = { [runtimeId: string]: Array<SidechainRoute> };

export type Peer = PeerJs & {
  onConnectionClosed?: (dstName: string) => void;
  onConnectionOpened?: (dstName: string) => void;
};

export type PeerJsHostDescriptor = {
  host: string;
  port: number;
  path: string;
  secure: boolean;
};

export type PeerOutputActivation = PeerJsHostDescriptor & OutputRoute;
export type PeerInputActivation = InputRoute;

export type BoardDescriptor = {
  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: Array<ServiceDescriptor> };
  boardName?: string;
  registry?: { [runtimeId: string]: ServiceRegistry };
};

export type PlaygroundBoard = BoardDescriptor & {
  sidechainRouting: { [runtimeId: string]: SidechainRouting };
  outputRouting: { [runtimeId: string]: OutputRouting | null };
  inputRouting: { [runtimeId: string]: InputRouting };
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
  next: (svc: ServiceDescriptor | null, result: any) => void;
  getServiceById: (uuid: string) => ServiceImpl | null | undefined;
  sendAction: (action: ServiceAction) => void;
  storeServiceData: (serviceUuid: string, key: string, value: string) => void;
  restoreServiceData: (serviceUuid: string, key: string) => void;
  removeServiceData: (serviceUuid: string, key: string) => void;
  createSubService: (parent: ServiceImpl, service: ServiceDescriptor) => void;
  createSubServiceUI: (svc: ServiceImpl) => void;
};

export type ServiceImpl = {
  serviceId?: string; // TODO not sure about this
  __descriptor?: ServiceDescriptor; // TODOÖ: remove
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
  getServiceById: (uuid: string) => ServiceImpl;
  processRuntime: (params: any, svc: ServiceImpl | null | undefined) => any;
  destroyService: (svc: ServiceDescriptor) => void;
  destroyRuntime: () => void;
};

export type AppViewMode = "wide" | "narrow";
