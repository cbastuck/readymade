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
} from "hkp-frontend/src/types";
import RuntimeRestScope from "./RuntimeRestScope";
import { EngineState } from "hkp-frontend/src/BoardContext";

function normalizeRegistry(registry: ServiceClass[]): ServiceClass[] {
  return registry.map((entry) => {
    if (entry.serviceId !== "sub-service") {
      return entry;
    }

    const capabilities = entry.capabilities ?? [];
    const hasSubservices = capabilities.some(
      (cap) => cap.trim().toLocaleLowerCase() === "subservices",
    );

    return hasSubservices
      ? entry
      : { ...entry, capabilities: [...capabilities, "subservices"] };
  });
}

async function createScope(
  runtime: RuntimeDescriptor,
  runtimeOutputUrl: string,
): Promise<RuntimeRestScope> {
  return new RuntimeRestScope(runtime, runtimeOutputUrl);
}

export async function addRuntime(
  rtClass: RuntimeClass,
  _user: User | null,
  boardName = "",
) {
  const { name: passedName, type, url } = rtClass;
  const runtimeId = uuidv4();
  const runtime = {
    id: runtimeId,
    name: passedName || "Browser Runtime",
    type,
    url,
  };

  const { scope, registry } = await createRuntimeRequest(
    runtime,
    [],
    boardName,
  );
  return {
    runtime,
    services: [],
    scope,
    registry,
  };
}

export async function removeRuntime(
  scope_: RuntimeScope,
  runtime: RuntimeDescriptor,
  _user: User | null,
): Promise<void> {
  const scope = scope_ as RuntimeRestScope;
  scope.close();

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
  _user: User | null,
  boardName?: string,
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
  } = await createRuntimeRequest(runtime, svcs, boardName);
  return {
    runtime,
    services: createdServices,
    scope,
    registry,
  };
}

type RestRuntimeData = {
  id: string;
  name: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    version?: string;
    capabilities?: string[];
    state: any;
    uuid: string;
  }>;
  outputUrl: string;
};

export async function attachRuntimes(
  rtClass: RuntimeClass,
  _user: User | null,
): Promise<EngineState> {
  const initState: EngineState = {
    runtimes: [],
    services: {},
    scopes: {},
    registry: {},
  };
  if (!rtClass) {
    return initState;
  }
  const url = `${rtClass.url}/runtimes`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch runtimes" + res.statusText);
  }
  const body = await res.json();
  const runtimes: RestRuntimeData[] = Array.isArray(body)
    ? body
    : (body.runtimes ?? []);
  const registry = normalizeRegistry(
    Array.isArray(body) ? [] : (body.registry ?? []),
  );

  // TODO: get rid of the any type
  return runtimes.reduce((acc: any, cur: RestRuntimeData) => {
    const rt: RuntimeDescriptor = { ...rtClass, ...cur };
    const scope = new RuntimeRestScope(rt, cur.outputUrl);
    scope.registry = registry;
    return {
      ...acc,
      runtimes: [...acc.runtimes, rt],
      services: { ...acc.services, [cur.id]: cur.services },
      registry: { ...acc.registry, [cur.id]: registry },
      scopes: { ...acc.scopes, [cur.id]: scope },
    };
  }, initState);
}

export async function processRuntime(
  scope_: RuntimeScope,
  params: any,
  _svc: InstanceId | null,
  context?: ProcessContext | null,
): Promise<void> {
  const scope = scope_ as RuntimeRestScope;
  const runtime = scope.descriptor;

  if (
    !scope.sendMessageViaWebsocket(params, context || null, "processRuntime")
  ) {
    // if sending failed, we probably don't have a runtimeOutput, we send a REST request
    // TODO what if params is not an object?
    const res = await fetch(`${runtime.url}/runtimes/${runtime.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to process ${runtime.id} runtime: ${res.statusText}`,
      );
    }
  }
}

export async function addService(scope: RuntimeScope, service: ServiceClass) {
  const runtime = scope.descriptor;
  const scopeRegistry = (scope as RuntimeRestScope).registry || [];
  const descriptor =
    scopeRegistry.find((entry) => entry.serviceId === service.serviceId) ||
    service;
  const payload = {
    ...descriptor,
    uuid: uuidv4(),
  };
  const res = await fetch(`${runtime.url}/runtimes/${runtime.id}/services`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Failed to add service: " + res.statusText);
  }

  const config = await res.json();
  const createdService = {
    ...descriptor,
    state: config,
    uuid: payload.uuid,
  };
  return createdService;
}

export async function removeService(
  scope: RuntimeScope,
  service: InstanceId,
): Promise<Array<ServiceDescriptor> | null> {
  const runtime = scope.descriptor;
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}`,
    {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to remove service from runtime" + res.statusText);
  }
  const data = await res.json();
  return data.services;
}

export async function configureService(
  scope: RuntimeScope,
  service: InstanceId,
  config: object,
): Promise<object> {
  const runtime = scope.descriptor;
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}`,
    {
      method: "POST",
      body: JSON.stringify(config),
      headers: {
        "content-type": "application/json",
      },
    },
  );
  if (!res.ok) {
    throw new Error("Failed to configure service" + res.statusText);
  }

  const data = await res.json();
  scope.onConfig?.(service.uuid, { state: data }); // TODO: this only works for full state due to see RuntimeRestScope scope.onConfig = ...

  return data;
}

export async function getServiceConfig(
  scope: RuntimeScope,
  service: InstanceId,
): Promise<any> {
  const runtime = scope.descriptor;
  const res = await fetch(
    `${runtime.url}/runtimes/${runtime.id}/services/${service.uuid}`,
  );
  if (!res.ok) {
    throw new Error("Failed to get service configure: " + res.statusText);
  }

  const state = await res.json();
  return state;
}

export async function processService(
  _scope: RuntimeScope,
  _service: InstanceId,
  _params: any,
  _context?: ProcessContext | null,
): Promise<any> {
  throw new Error("RemoteRuntime processService no implemented");
}

export async function rearrangeServices(
  scope: RuntimeScope,
  newOrder: Array<ServiceDescriptor>,
): Promise<Array<ServiceDescriptor>> {
  const runtime = scope.descriptor;
  const res = await fetch(`${runtime.url}/runtimes/${runtime.id}/rearrange`, {
    method: "POST",
    body: JSON.stringify(newOrder.map((s) => s.uuid)),
    headers: {
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Failed to rearrange services" + res.statusText);
  }

  const state = await res.json();
  return state.services;
}

async function createRuntimeRequest(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>,
  boardName?: string,
) {
  const payload = {
    name: runtime.name,
    id: runtime.id,
    services: services.map((s) => ({
      uuid: s.uuid || uuidv4(),
      serviceId: s.serviceId,
      state: (s as any).state, // TODO:
    })),
    boardName: boardName || undefined,
  };
  const res = await fetch(`${runtime.url}/runtimes`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Failed to create runtime" + res.statusText);
  }
  const { registry, runtimes } = await res.json();
  const normalizedRegistry = normalizeRegistry(registry ?? []);
  const rt = runtimes[0]; // TODO only considering the first runtime here
  if (!rt) {
    throw new Error("Failed to create runtime - no runtime was addeed");
  }
  const scope = await createScope(runtime, rt.outputUrl);
  scope.registry = normalizedRegistry;

  return {
    runtime: rt,
    services: rt.services,
    scope,
    registry: normalizedRegistry,
  };
}

const api: RuntimeApi = {
  addRuntime,
  removeRuntime,
  restoreRuntime,
  attachRuntimes,
  processRuntime,
  addService,
  removeService,
  configureService,
  getServiceConfig,
  processService,
  rearrangeServices,
};

export default api;
