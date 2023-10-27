import {
  createRuntime,
  restoreRuntime as restoreRuntime_gql,
  createRuntimeService,
  removeRuntimeService,
  getRuntimeServiceConfig,
} from "./graphqlActions";
import {
  InstanceId,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceClass,
  ServiceDescriptor,
} from "../../types";
import RemoteRuntimeScope from "./RemoteRuntimeScope";

export async function addRuntime(rtClass: RuntimeClass) {
  const desc = await createRuntime(rtClass);
  if (!desc) {
    return null;
  }

  const scope = createScope(desc.id);
  const { registry, ...runtime } = desc;
  return {
    runtime: { ...rtClass, ...runtime },
    services: [],
    registry,
    scope,
  };
}

export async function restoreRuntime(
  rt: RuntimeDescriptor,
  services: Array<ServiceDescriptor>
) {
  const result = await restoreRuntime_gql(rt, services);
  const restoredRuntime = result.data?.restoreRuntime;

  const scope = createScope(rt.id);
  if (rt.id !== restoredRuntime.id) {
    return null;
  }

  return { runtime: rt, services, scope, registry: restoredRuntime.registry };
}

export async function processRuntime(
  scope: RuntimeScope,
  params: any,
  svc: InstanceId | null
): Promise<any> {
  throw new Error("RemoteRuntime processRuntime no implemented");
}

export async function addService(
  scope_: RuntimeScope,
  runtime: RuntimeDescriptor,
  service: ServiceClass
) {
  const svc = await createRuntimeService(runtime, service);
  return svc;
}

export async function removeService(
  scope: RuntimeScope,
  runtime: RuntimeDescriptor,
  service: InstanceId
): Promise<Array<ServiceDescriptor> | null> {
  return await removeRuntimeService(runtime, service);
}

export async function configureService(
  scope: RuntimeScope,
  runtime: RuntimeDescriptor,
  instance: InstanceId,
  config: any
): Promise<void> {
  throw new Error("RemoteRuntime configureService no implemented");
}

export async function getServiceConfig(
  scope: RuntimeScope,
  runtime: RuntimeDescriptor,
  service: InstanceId
): Promise<any> {
  const config = await getRuntimeServiceConfig(runtime, service);
  return config;
}

export async function processService(
  scope: RuntimeScope,
  uuid: string,
  params: any,
  requestId: string | null
): Promise<any> {
  throw new Error("RemoteRuntime processService no implemented");
}

const api: RuntimeApi = {
  addRuntime,
  restoreRuntime,
  processRuntime,
  addService,
  removeService,
  configureService,
  getServiceConfig,
  processService,
};

export default api;

function createScope(runtimeId: string): RemoteRuntimeScope {
  return new RemoteRuntimeScope(runtimeId);
}
