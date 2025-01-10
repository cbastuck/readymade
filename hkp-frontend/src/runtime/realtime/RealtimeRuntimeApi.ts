import { v4 as uuidv4 } from "uuid";

import {
  InstanceId,
  ProcessContext,
  RestoreRuntimeResult,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceClass,
  ServiceDescriptor,
  User,
} from "@/types";
import RealtimeRuntimeScope from "./RealtimeRuntimeScope";

async function createScope(
  runtime: RuntimeDescriptor,
  runtimeOutputUrl: string
): Promise<RealtimeRuntimeScope> {
  return new RealtimeRuntimeScope(runtime, runtimeOutputUrl);
}

export async function addRuntime(rtClass: RuntimeClass, _user: User | null) {
  const { name: passedName, type, url } = rtClass;
  const runtimeId = uuidv4();
  const runtime = {
    id: runtimeId,
    name: passedName || "Browser Runtime",
    type,
    url,
  };

  const { scope, registry } = await createRuntimeRequest(runtime, []);
  return {
    runtime,
    services: [],
    scope,
    registry,
  };
}

export async function removeRuntime(
  _scope: RuntimeScope,
  runtime: RuntimeDescriptor,
  _user: User | null
): Promise<void> {
  const res = await fetch(`${runtime.url}/runtimes/${runtime.id}`, {
    method: "DELETE",
    headers: {},
  });
  if (!res.ok) {
    throw new Error("Failed to remove runtime" + res.statusText);
  }
}

async function restoreRuntime(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>,
  _user: User | null
): Promise<RestoreRuntimeResult | null> {
  const svcs = services.map((s) => ({
    uuid: s.uuid || uuidv4(),
    serviceName: s.serviceName,
    serviceId: s.serviceId,
    state: (s as any).state, // TODO:
  }));

  const {
    registry,
    scope,
    services: createdServices,
  } = await createRuntimeRequest(runtime, svcs);
  return {
    runtime,
    services: createdServices,
    scope,
    registry,
  };
}

export async function processRuntime(
  _scope_: RuntimeScope,
  _params: any,
  _svc: InstanceId | null,
  _context?: ProcessContext | null
): Promise<void> {}

export async function addService(_scope: RuntimeScope, _service: ServiceClass) {
  return null;
}

export async function removeService(
  _scope: RuntimeScope,
  _service: InstanceId
): Promise<Array<ServiceDescriptor> | null> {
  return null;
}

export async function configureService(
  scope: RuntimeScope,
  service: InstanceId,
  config: object
): Promise<object> {
  const runtime = scope.descriptor;
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}`,
    {
      method: "POST",
      body: JSON.stringify(config),
    }
  );
  if (!res.ok) {
    throw new Error("Failed to configure service" + res.statusText);
  }

  const data = await res.json();
  scope.onConfig?.(service.uuid, { state: data }); // TODO: this only works for full state due to see RealtimeRuntimeScope scope.onConfig = ...

  return data;
}

export async function getServiceConfig(
  _scope: RuntimeScope,
  _service: InstanceId
): Promise<any> {
  return {};
}

export async function processService(
  _scope: RuntimeScope,
  _service: InstanceId,
  _params: any,
  _context?: ProcessContext | null
): Promise<any> {
  throw new Error("RemoteRuntime processService no implemented");
}

export async function rearrangeServices(
  _scope: RuntimeScope,
  newOrder: Array<ServiceDescriptor>
): Promise<Array<ServiceDescriptor>> {
  return newOrder;
}

async function createRuntimeRequest(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>
) {
  const payload = {
    name: runtime.name,
    id: runtime.id,
    services: services.map((s) => ({
      uuid: s.uuid || uuidv4(),
      serviceId: s.serviceId,
      state: (s as any).state, // TODO:
    })),
  };
  const res = await fetch(`${runtime.url}/runtimes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Failed to create runtime" + res.statusText);
  }
  const { registry, runtimes } = await res.json();
  const rt = runtimes[0];
  if (!rt) {
    throw new Error("Failed to create runtime - no runtime was addeed");
  }
  const scope = await createScope(runtime, rt.outputUrl);

  return {
    runtime: rt,
    services: rt.services,
    scope,
    registry,
  };
}

const api: RuntimeApi = {
  addRuntime,
  removeRuntime,
  restoreRuntime,
  processRuntime,
  addService,
  removeService,
  configureService,
  getServiceConfig,
  processService,
  rearrangeServices,
};

export default api;
