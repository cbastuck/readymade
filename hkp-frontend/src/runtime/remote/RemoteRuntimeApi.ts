import {
  createRuntime,
  restoreRuntime as restoreRuntime_gql,
  createRuntimeService,
  removeRuntimeService,
  getRuntimeServiceConfig,
  configureService as configureService_gql,
  processRuntime as processRuntime_gql,
  getRuntimeOutputUrl,
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
  const scope = await createScope(runtime);
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

  const scope = await createScope(rt);
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
  const res = processRuntime_gql(scope.descriptor, params, svc);
  console.log("Remote Runtime process result", await res);

  // TODO: We don't return the result from the handler
  // instead onResult needs to be invoked from a websocket handler
  // const json = JSON.parse(result);
  //return await scope.onResult(null, json, null);
}

export async function addService(scope: RuntimeScope, service: ServiceClass) {
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
  config: object
): Promise<object> {
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

async function createScope(
  runtime: RuntimeDescriptor
): Promise<RemoteRuntimeScope> {
  const outputUrl = await getRuntimeOutputUrl(runtime);
  return new RemoteRuntimeScope(runtime, outputUrl);
}
