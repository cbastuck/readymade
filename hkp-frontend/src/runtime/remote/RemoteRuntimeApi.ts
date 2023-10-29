import {
  createRuntime,
  restoreRuntime as restoreRuntime_gql,
  createRuntimeService,
  removeRuntimeService,
  getRuntimeServiceConfig,
  configureService as configureService_gql,
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

  const { registry, ...rest } = desc;
  const runtime = { ...rtClass, ...rest };
  const scope = createScope(runtime);
  return {
    runtime,
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

  const scope = createScope(rt);
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

export async function addService(scope: RuntimeScope, service: ServiceClass) {
  console.log("CREATE RUNTIME WITH DESC", scope.descriptor);
  const svc = await createRuntimeService(scope.descriptor, service);
  return svc;
}

export async function removeService(
  scope: RuntimeScope,
  service: InstanceId
): Promise<Array<ServiceDescriptor> | null> {
  return await removeRuntimeService(scope.descriptor, service);
}

export async function configureService(
  scope: RuntimeScope,
  service: InstanceId,
  config: any
): Promise<void> {
  return await configureService_gql(scope.descriptor, service, config);
}

export async function getServiceConfig(
  scope: RuntimeScope,
  service: InstanceId
): Promise<any> {
  const config = await getRuntimeServiceConfig(scope.descriptor, service);
  return config;
}

export async function processService(
  scope: RuntimeScope,
  service: InstanceId,
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

function createScope(runtime: RuntimeDescriptor): RemoteRuntimeScope {
  return new RemoteRuntimeScope(runtime);
}
