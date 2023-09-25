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
  value: any; // TODO: parsed BoardState?
  name: string;
};

export type InputRouting = {};

export type OutpoutRouting = {
  peer?: any;
  flow?: any;
};

export type SidechainRouting = {};

export type BoardState = {
  runtimes: Array<RuntimeDescriptor>;
  services: { [runtimeId: string]: ServiceDescriptor };
  sidechainRouting: { [runtimeId: string]: SidechainRouting };
  outputRouting: { [runtimeId: string]: OutpoutRouting | null };
  inputRouting: { [runtimeId: string]: InputRouting };
  description: string;
  boardSyncActive: boolean;
  syncedPeer: string | undefined;
  acceptedSyncSenders: Array<any>;
  rejectedSyncSenders: Array<any>;
};
