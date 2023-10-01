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

export type InputRouting = {};

export type OutpoutRouting = {
  peer?: any;
  flow?: any;
};

export type SidechainRouting = {};

export type BoardDescriptor = {
  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: Array<ServiceDescriptor> };
  boardName?: string;
  registry?: { [runtimeId: string]: ServiceRegistry };
};

export type PlaygroundBoard = BoardDescriptor & {
  sidechainRouting: { [runtimeId: string]: SidechainRouting };
  outputRouting: { [runtimeId: string]: OutpoutRouting | null };
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
    descriptor: ServiceDescriptor,
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

export type Action = { type: string; board?: string };

export type ServiceAction = {
  service: ServiceDescriptor;
  action: string;
};

export type ServiceImpl = {
  __descriptor?: ServiceDescriptor; // TODOÖ: remove
  process: (params: any) => any;
  configure: (config: any) => void;
};

export type RuntimeImpl = {
  getServiceById: (uuid: string) => ServiceImpl;
  processRuntime: (params: any, svc: ServiceImpl | null | undefined) => any;
  destroyService: (svc: ServiceDescriptor) => void;
  destroyRuntime: () => void;
};

export type AppViewMode = "wide" | "narrow";
