import {
  createRuntime,
  restoreRuntime as restoreRuntime_gql,
  createRuntimeService,
  removeRuntimeService,
  getRuntimeServiceConfig,
  configureService as configureService_gql,
  processRuntime as processRuntime_gql,
  getRuntimeOutputUrl,
  getHealth as getHealth_gql,
} from "./graphqlActions";
import {
  InstanceId,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceClass,
  ServiceDescriptor,
  User,
} from "../../types";
import RemoteRuntimeScope from "./RemoteRuntimeScope";

export async function isUserAuthenticated(
  rtClass: RuntimeClass,
  user?: User | null
) {
  const healthStatus = await getHealth(rtClass, user || null);
  if (healthStatus === "200") {
    return true;
  } else if (healthStatus === "401") {
    return false;
  } else {
    console.error(
      `RemoteRuntimeApi.isUserAuthenticated reports unexpected status: ${healthStatus}`
    );
    return false;
  }
}

export async function getHealth(rtClass: RuntimeClass, user: User | null) {
  return getHealth_gql(rtClass, user);
}

export async function addRuntime(rtClass: RuntimeClass, user: User | null) {
  const desc = await createRuntime(rtClass, user);
  if (!desc) {
    return null;
  }

  const { registry, ...rest } = desc;
  const runtime = { ...rtClass, ...rest, user };
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
  services: Array<ServiceDescriptor>,
  user: User | null
) {
  const restoredRuntime = await restoreRuntime_gql(rt, services, user);
  if (!restoredRuntime || restoredRuntime.id !== rt.id) {
    return null;
  }
  const runtime = { ...rt, user };
  const scope = await createScope(runtime);
  return { runtime, services, scope, registry: restoredRuntime.registry };
}

export async function processRuntime(
  scope_: RuntimeScope,
  params: any,
  svc: InstanceId | null
): Promise<any> {
  const scope = scope_ as RemoteRuntimeScope;
  if (!scope.isConnected()) {
    await scope.reconnect();
  }
  return processRuntime_gql(scope.descriptor, params, svc);
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
  getHealth,
};

export default api;

async function createScope(
  runtime: RuntimeDescriptor
): Promise<RemoteRuntimeScope> {
  const outputUrl = await getRuntimeOutputUrl(runtime);
  return new RemoteRuntimeScope(runtime, outputUrl);
}
